import { describe, expect, it } from "vitest";
import { BACKUP_KEY, emptyData, loadData, mergeData, parseData, parsePrice, saveData, serializeForExport, STORAGE_KEY } from "../src/store";
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
  it("買える中でいちばん高いモノと個数", () => {
    expect(pickEquivalent(0)).toBeNull();
    expect(pickEquivalent(29)).toBeNull();
    expect(pickEquivalent(30)).toMatchObject({ name: "駄菓子", count: 1 });
    expect(pickEquivalent(4500)).toMatchObject({ name: "映画", count: 2 });
  });
});
