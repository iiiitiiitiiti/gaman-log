import { describe, expect, it } from "vitest";
import { annualPace, balance, daysSinceFirst, startOfWeek, totals } from "../src/stats";
import type { Entry, Kind } from "../src/types";

let seq = 0;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const entry = (kind: Kind, price: number, createdAt: number): Entry => ({
  id: `e${seq++}`,
  kind,
  name: "x",
  emoji: "",
  price,
  createdAt,
});

describe("startOfWeek", () => {
  it("月曜始まり（日曜は前の週）", () => {
    expect(startOfWeek(new Date(2026, 8, 27)).getDate()).toBe(21); // 9/27(日) → 9/21(月)
    expect(startOfWeek(new Date(2026, 8, 21)).getDate()).toBe(21); // 月曜はそのまま
  });
  it("月・年をまたぐ", () => {
    const w = startOfWeek(new Date(2027, 0, 1)); // 2027/1/1(金)
    expect([w.getFullYear(), w.getMonth(), w.getDate()]).toEqual([2026, 11, 28]);
  });
});

describe("totals", () => {
  it("記録ゼロならすべて 0", () => {
    expect(totals([], "saved", new Date())).toEqual({ today: 0, week: 0, month: 0, all: 0 });
  });
  it("期間ごとに集計し、種類を混ぜない", () => {
    const now = new Date(2026, 8, 24, 20); // 9/24(木)
    const list = [
      entry("saved", 100, at(2026, 9, 24)),
      entry("saved", 200, at(2026, 9, 21)), // 今週の月曜
      entry("saved", 300, at(2026, 9, 1)),
      entry("saved", 400, at(2026, 8, 31)), // 先月
      entry("wasted", 999, at(2026, 9, 24)),
    ];
    expect(totals(list, "saved", now)).toEqual({ today: 100, week: 300, month: 600, all: 1000 });
  });
  it("月初（月をまたいだ直後）は先月分を含めない", () => {
    const now = new Date(2026, 9, 1, 9);
    const list = [entry("saved", 500, at(2026, 9, 30)), entry("saved", 50, at(2026, 10, 1, 8))];
    const t = totals(list, "saved", now);
    expect(t.month).toBe(50);
    expect(t.week).toBe(550); // 9/28(月)〜
  });
});

describe("annualPace", () => {
  it("記録ゼロ・初日・7日未満は null", () => {
    const now = new Date(2026, 8, 24, 20);
    expect(annualPace([], "wasted", now)).toBeNull();
    expect(annualPace([entry("wasted", 300, at(2026, 9, 24))], "wasted", now)).toBeNull();
    expect(annualPace([entry("wasted", 300, at(2026, 9, 19))], "wasted", now)).toBeNull(); // 6日目
  });
  it("7日目から経過日数でならす", () => {
    const now = new Date(2026, 8, 24, 20);
    const list = [entry("wasted", 700, at(2026, 9, 18))]; // 7日目
    expect(daysSinceFirst(list, "wasted", now)).toBe(7);
    expect(annualPace(list, "wasted", now)).toBe(36500);
  });
  it("30日を超えたら直近30日だけで計算", () => {
    const now = new Date(2026, 8, 30, 20);
    const list = [
      entry("saved", 100000, at(2026, 6, 1)), // 古い大きな記録は窓の外
      entry("saved", 3000, at(2026, 9, 1)), // 窓の初日（9/1〜9/30）
    ];
    expect(annualPace(list, "saved", now)).toBe(36500);
  });
  it("年またぎでも日数を正しく数える", () => {
    const now = new Date(2027, 0, 3, 10);
    const list = [entry("saved", 700, at(2026, 12, 28))];
    expect(daysSinceFirst(list, "saved", now)).toBe(7);
    expect(annualPace(list, "saved", now)).toBe(36500);
  });
});

describe("balance", () => {
  it("がまん − むだづかい", () => {
    const now = new Date();
    expect(balance([], now)).toBe(0);
    expect(balance([entry("saved", 1000, 0), entry("wasted", 1500, 0)], now)).toBe(-500);
  });
});

describe("未来の日時の記録", () => {
  it("どの集計にも入れない", () => {
    const now = new Date(2026, 8, 24, 20);
    const list = [entry("saved", 700, at(2026, 9, 18)), entry("saved", 10000, at(2027, 1, 1))];
    expect(totals(list, "saved", now)).toEqual({ today: 0, week: 0, month: 700, all: 700 });
    expect(annualPace(list, "saved", now)).toBe(36500);
    expect(balance(list, now)).toBe(700);
    expect(daysSinceFirst([entry("wasted", 1, at(2027, 1, 1))], "wasted", now)).toBe(0);
  });
});
