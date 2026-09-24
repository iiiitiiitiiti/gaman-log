import type { AppData, Entry, Kind, Preset } from "./types";

export const STORAGE_KEY = "gaman-log:v1";
/** 読めなかった保存データの退避先（次の保存で上書きして消さないため） */
export const BACKUP_KEY = "gaman-log:unreadable-backup";
export const MAX_PRICE = 10_000_000;

export const DEFAULT_PRESETS: Preset[] = [
  { id: "p-saved-bottle", kind: "saved", emoji: "🧃", name: "ペットボトル", price: 160 },
  { id: "p-saved-snack", kind: "saved", emoji: "🍫", name: "お菓子", price: 200 },
  { id: "p-saved-kaigui", kind: "saved", emoji: "🍢", name: "買い食い", price: 300 },
  { id: "p-saved-latte", kind: "saved", emoji: "☕", name: "カフェラテ", price: 450 },
  { id: "p-saved-conbini", kind: "saved", emoji: "🏪", name: "コンビニスイーツ", price: 350 },
  { id: "p-saved-lunch", kind: "saved", emoji: "🍱", name: "外食ランチ", price: 1000 },
  { id: "p-wasted-impulse", kind: "wasted", emoji: "🛍️", name: "衝動買い", price: null },
  { id: "p-wasted-gacha", kind: "wasted", emoji: "🎰", name: "ガチャ・課金", price: null },
  { id: "p-wasted-conbini", kind: "wasted", emoji: "🏪", name: "コンビニ寄り道", price: null },
  { id: "p-wasted-bottle", kind: "wasted", emoji: "🧃", name: "ペットボトル", price: 160 },
  { id: "p-wasted-snack", kind: "wasted", emoji: "🍫", name: "お菓子", price: 200 },
  { id: "p-wasted-delivery", kind: "wasted", emoji: "🛵", name: "デリバリー", price: null },
];

export function emptyData(): AppData {
  return { version: 1, entries: [], presets: DEFAULT_PRESETS.map((p) => ({ ...p })) };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_PRICE;
}

/** 全角数字・カンマ・「円」を許して金額を読む。読めなければ null */
export function parsePrice(input: string): number | null {
  const normalized = input.normalize("NFKC").replace(/[,，円\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return isValidPrice(value) ? value : null;
}

const isKind = (v: unknown): v is Kind => v === "saved" || v === "wasted";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function toEntry(v: unknown): Entry | null {
  if (!isObj(v)) return null;
  const { id, kind, name, emoji, price, createdAt, presetId } = v;
  if (typeof id !== "string" || !id || !isKind(kind) || typeof name !== "string" || !isValidPrice(price)) return null;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
  return {
    id,
    kind,
    name,
    emoji: typeof emoji === "string" ? emoji : "",
    price,
    createdAt,
    ...(typeof presetId === "string" ? { presetId } : {}),
  };
}

function toPreset(v: unknown): Preset | null {
  if (!isObj(v)) return null;
  const { id, kind, name, emoji, price } = v;
  if (typeof id !== "string" || !id || !isKind(kind) || typeof name !== "string") return null;
  if (price !== null && !isValidPrice(price)) return null;
  return { id, kind, name, emoji: typeof emoji === "string" ? emoji : "", price };
}

/** 同じ id が重なっていたら最初の1件だけ残す（読み込みの統合で黙って上書きし合わないように） */
function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

export interface ParseResult {
  data: AppData;
  /** 壊れていた・id が重なっていたために捨てた項目の数 */
  dropped: number;
}

/** 保存データや書き出しファイルを検証して読む。形が違えば null（壊れた項目・重なった id は1件ずつ捨てる） */
export function parseDataDetailed(raw: string): ParseResult | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(json) || json.version !== 1 || !Array.isArray(json.entries) || !Array.isArray(json.presets)) return null;
  const entries = uniqueById(json.entries.map(toEntry).filter((e): e is Entry => e !== null));
  const presets = uniqueById(json.presets.map(toPreset).filter((p): p is Preset => p !== null));
  const dropped = json.entries.length - entries.length + (json.presets.length - presets.length);
  return { data: { version: 1, entries, presets }, dropped };
}

export function parseData(raw: string): AppData | null {
  return parseDataDetailed(raw)?.data ?? null;
}

function backupRaw(raw: string, storage: Storage) {
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // 退避できなくても起動は続ける
  }
}

export function loadData(storage: Storage = localStorage): AppData {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyData();
  }
  if (raw === null) return emptyData();
  const parsed = parseDataDetailed(raw);
  // 全体が読めない・一部を捨てた、のどちらでも元データを残す（次の保存で捨てた分が消えるため）
  if (!parsed || parsed.dropped > 0) backupRaw(raw, storage);
  return parsed ? parsed.data : emptyData();
}

/** 保存に失敗したら false（プライベートモード・容量不足） */
export function saveData(data: AppData, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function serializeForExport(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** 読み込み: id で統合する。同じ id は読み込んだ側で上書き、手元にしかないものは残す */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const mergeById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map(a.map((x) => [x.id, x]));
    for (const x of b) map.set(x.id, x);
    return [...map.values()];
  };
  return {
    version: 1,
    entries: mergeById(current.entries, incoming.entries).sort((x, y) => x.createdAt - y.createdAt),
    presets: mergeById(current.presets, incoming.presets),
  };
}
