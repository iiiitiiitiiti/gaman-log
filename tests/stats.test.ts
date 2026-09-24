import { describe, expect, it } from "vitest";
import { annualPace, balance, daysSinceFirst, exportDue, goalProgress, monthRanking, recentMonths, saveStreak, startOfWeek, totals } from "../src/stats";
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

describe("goalProgress", () => {
  it("目標を決めた日からのがまん額だけ数える", () => {
    const now = new Date(2026, 8, 24, 20);
    const goal = { name: "旅行", emoji: "✈️", price: 10000, startAt: at(2026, 9, 20, 0) };
    const list = [entry("saved", 500, at(2026, 9, 19)), entry("saved", 300, at(2026, 9, 21)), entry("wasted", 999, at(2026, 9, 22))];
    expect(goalProgress(list, goal, now)).toBe(300);
  });
});

describe("saveStreak", () => {
  const now = new Date(2026, 8, 24, 20);
  it("記録ゼロなら0日", () => {
    expect(saveStreak([], now)).toEqual({ days: 0, today: false });
  });
  it("今日まで続いていれば今日を含めて数える", () => {
    const list = [entry("saved", 1, at(2026, 9, 24)), entry("saved", 1, at(2026, 9, 23)), entry("saved", 1, at(2026, 9, 22)), entry("saved", 1, at(2026, 9, 20))];
    expect(saveStreak(list, now)).toEqual({ days: 3, today: true });
  });
  it("今日まだなら昨日までの連続を数え、今日は未記録と返す", () => {
    const list = [entry("saved", 1, at(2026, 9, 23)), entry("saved", 1, at(2026, 9, 22)), entry("wasted", 1, at(2026, 9, 24))];
    expect(saveStreak(list, now)).toEqual({ days: 2, today: false });
  });
  it("月をまたいでも続く", () => {
    const n = new Date(2026, 9, 1, 9);
    const list = [entry("saved", 1, at(2026, 10, 1, 8)), entry("saved", 1, at(2026, 9, 30))];
    expect(saveStreak(list, n).days).toBe(2);
  });
});

describe("recentMonths / monthRanking", () => {
  const now = new Date(2026, 8, 24, 20);
  const list = [
    entry("saved", 100, at(2026, 9, 1)),
    entry("saved", 200, at(2026, 8, 31)),
    entry("wasted", 50, at(2026, 9, 2)),
    entry("saved", 999, at(2027, 1, 1)),
  ];
  it("古い順に月ごとの合計（未来は除く）", () => {
    expect(recentMonths(list, 2026, 8, 3, now)).toEqual([
      { year: 2026, month: 6, saved: 0, wasted: 0 },
      { year: 2026, month: 7, saved: 200, wasted: 0 },
      { year: 2026, month: 8, saved: 100, wasted: 50 },
    ]);
  });
  it("年をまたいで数える", () => {
    expect(recentMonths([], 2027, 0, 2, now).map((m) => [m.year, m.month])).toEqual([[2026, 11], [2027, 0]]);
  });
  it("品名でまとめて金額の大きい順", () => {
    const l = [
      { ...entry("saved", 160, at(2026, 9, 1)), name: "水" },
      { ...entry("saved", 160, at(2026, 9, 2)), name: "水" },
      { ...entry("saved", 300, at(2026, 9, 3)), name: "菓子" },
    ];
    expect(monthRanking(l, "saved", 2026, 8, now).map((r) => [r.name, r.total, r.count])).toEqual([["水", 320, 2], ["菓子", 300, 1]]);
  });
});

describe("exportDue", () => {
  const now = new Date(2026, 8, 24, 20);
  const base = { version: 1 as const, presets: [] };
  it("記録が無ければ勧めない", () => {
    expect(exportDue({ ...base, entries: [] }, now)).toBe(false);
  });
  it("書き出したことが無ければ最初の記録から30日で勧める", () => {
    expect(exportDue({ ...base, entries: [entry("saved", 1, at(2026, 8, 26))] }, now)).toBe(false);
    expect(exportDue({ ...base, entries: [entry("saved", 1, at(2026, 8, 25))] }, now)).toBe(true);
  });
  it("書き出してから30日たつまでは勧めない", () => {
    expect(exportDue({ ...base, entries: [entry("saved", 1, at(2026, 1, 1))], lastExportAt: at(2026, 9, 1) }, now)).toBe(false);
  });
});
