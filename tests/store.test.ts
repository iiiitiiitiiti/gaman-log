import { describe, expect, it } from "vitest";
import { BACKUP_KEY, emptyData, loadData, mergeData, parseData, parseDataDetailed, parsePrice, saveData, serializeForExport, STORAGE_KEY } from "../src/store";
import { pickEquivalent } from "../src/equivalents";
import type { AppData } from "../src/types";

const sample = (): AppData => ({
  version: 1,
  entries: [{ id: "a", kind: "saved", name: "水🥤", emoji: "🧃", price: 160, createdAt: 1 }],
  presets: [{ id: "p", kind: "wasted", name: "ガチャ", emoji: "🎰", price: null }],
});

describe("parsePrice", () => {
  it("全角・カンマ・円を許す", () => {
    expect(parsePrice("１，２００円")).toBe(1200);
    expect(parsePrice(" 160 ")).toBe(160);
  });
  it("0・小数・負数・空・上限超えは null", () => {
    for (const s of ["0", "1.5", "-3", "", "abc", "10000001"]) expect(parsePrice(s)).toBeNull();
  });
});

describe("parseData", () => {
  it("書き出し→読み込みで元に戻る（絵文字を含む）", () => {
    expect(parseData(serializeForExport(sample()))).toEqual(sample());
  });
  it("壊れた JSON・違う形は null、壊れた項目だけ捨てる", () => {
    expect(parseData("{")).toBeNull();
    expect(parseData(JSON.stringify({ version: 2, entries: [], presets: [] }))).toBeNull();
    const bad = { ...sample(), entries: [...sample().entries, { id: "b", kind: "saved", name: "x", price: -1, createdAt: 1 }] };
    expect(parseData(JSON.stringify(bad))?.entries).toHaveLength(1);
  });
});

describe("loadData / saveData", () => {
  it("未保存なら初期データ、保存したものを読める", () => {
    localStorage.clear();
    expect(loadData().presets.length).toBeGreaterThan(0);
    expect(saveData(sample())).toBe(true);
    expect(loadData()).toEqual(sample());
  });
  it("壊れた保存データは初期データ扱いにし、元データを退避する", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(loadData().entries).toEqual([]);
    expect(localStorage.getItem(BACKUP_KEY)).toBe("not json");
  });
  it("書き込み失敗は false", () => {
    const broken = { setItem: () => { throw new Error("quota"); } } as unknown as Storage;
    expect(saveData(emptyData(), broken)).toBe(false);
  });
});

describe("重複 id と部分的な破損", () => {
  it("同じ id は最初の1件だけ残し、捨てた数を返す", () => {
    const e = sample().entries[0];
    const raw = JSON.stringify({ ...sample(), entries: [e, { ...e, kind: "wasted", price: 200 }] });
    const result = parseDataDetailed(raw);
    expect(result?.data.entries).toEqual([e]);
    expect(result?.dropped).toBe(1);
  });
  it("一部だけ壊れた保存データも元のまま退避する", () => {
    localStorage.clear();
    const bad = { id: "b", kind: "saved", name: "x", price: -1, createdAt: 1 };
    const raw = JSON.stringify({ ...sample(), entries: [...sample().entries, bad] });
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadData().entries).toHaveLength(1);
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw);
  });
  it("壊れていなければ退避しない", () => {
    localStorage.clear();
    saveData(sample());
    loadData();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});

describe("mergeData", () => {
  it("id で統合し、同じ id は読み込んだ側を採る", () => {
    const current = sample();
    const incoming: AppData = {
      version: 1,
      entries: [
        { ...current.entries[0], price: 200 },
        { id: "z", kind: "wasted", name: "y", emoji: "", price: 10, createdAt: 0 },
      ],
      presets: [],
    };
    const merged = mergeData(current, incoming);
    expect(merged.entries.map((e) => [e.id, e.price])).toEqual([["z", 10], ["a", 200]]);
    expect(merged.presets).toHaveLength(1);
  });
});

describe("pickEquivalent", () => {
  it("少額は1個でも買えるモノ、何も買えなければ null", () => {
    expect(pickEquivalent(0)).toBeNull();
    expect(pickEquivalent(29)).toBeNull();
    expect(pickEquivalent(30)).toMatchObject({ name: "駄菓子", count: 1 });
  });
  it("ふだんは2〜10個買えるモノから選び、同じ金額なら同じモノ", () => {
    for (let amount = 60; amount <= 100000; amount += 37) {
      const eq = pickEquivalent(amount);
      expect(eq?.count).toBeGreaterThanOrEqual(2);
      expect(eq?.count).toBeLessThanOrEqual(10);
      expect(eq!.price * eq!.count).toBeLessThanOrEqual(amount);
    }
    expect(pickEquivalent(3000)).toEqual(pickEquivalent(3000));
  });
  it("金額が変われば別のモノも出る（牛丼を含む）", () => {
    const names = new Set<string>();
    for (let amount = 2500; amount < 3500; amount += 10) names.add(pickEquivalent(amount)!.name);
    expect(names.size).toBeGreaterThan(5);
    expect(names.has("牛丼")).toBe(true);
  });
  it("高すぎて候補が無いときは、いちばん高いモノを何個分か", () => {
    expect(pickEquivalent(10_000_000)).toMatchObject({ name: "中古の軽自動車", count: 16 });
  });
});

describe("後から足した項目", () => {
  it("目標・上限・換算表・書き出し日を読み書きでき、壊れた項目は無視する", () => {
    const data: AppData = {
      ...sample(),
      goal: { name: "旅行", emoji: "✈️", price: 10000, startAt: 5 },
      wasteLimit: 20000,
      lastExportAt: 9,
      equivalents: [{ emoji: "🍚", name: "牛丼", unit: "杯", price: 500 }],
    };
    expect(parseData(serializeForExport(data))).toEqual(data);
    const broken = { ...sample(), goal: { name: "x", price: -1, startAt: 1 }, wasteLimit: "a", equivalents: [{ name: "x", price: 0 }] };
    expect(parseData(JSON.stringify(broken))).toEqual(sample());
  });
  it("自分の換算表を使える", () => {
    expect(pickEquivalent(1000, [{ emoji: "🍚", name: "牛丼", unit: "杯", price: 500 }])).toMatchObject({ name: "牛丼", count: 2 });
    expect(pickEquivalent(1000, [])).toBeNull();
  });
  it("読み込みでは、ファイルにある目標・上限を採り、書き出し日は新しいほう", () => {
    const current: AppData = { ...sample(), wasteLimit: 1000, lastExportAt: 50 };
    const incoming: AppData = { ...sample(), goal: { name: "g", emoji: "", price: 100, startAt: 1 }, lastExportAt: 10 };
    const merged = mergeData(current, incoming);
    expect(merged.wasteLimit).toBe(1000);
    expect(merged.goal?.name).toBe("g");
    expect(merged.lastExportAt).toBe(50);
  });
  it("読み込むファイルの目標・上限が null でも、手元の設定は消さない", () => {
    const current: AppData = { ...sample(), goal: { name: "g", emoji: "", price: 100, startAt: 1 }, wasteLimit: 1000 };
    const merged = mergeData(current, { ...sample(), goal: null, wasteLimit: null });
    expect(merged.goal?.name).toBe("g");
    expect(merged.wasteLimit).toBe(1000);
  });
});
