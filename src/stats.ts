import type { AppData, Entry, Goal, Kind } from "./types";

const DAY = 24 * 60 * 60 * 1000;
/** 年間ペースを出すのに必要な、最初の記録からの日数 */
export const PACE_MIN_DAYS = 7;
const PACE_WINDOW_DAYS = 30;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 週は月曜始まり */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 暦日の差（夏時間のずれを避けるため日付だけで数える） */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY);
}

/** 端末の時計ずれなどで未来の日時になった記録は、どの集計にも入れない */
const notFuture = (entries: Entry[], now: Date) => entries.filter((e) => e.createdAt <= now.getTime());
const ofKind = (entries: Entry[], kind: Kind) => entries.filter((e) => e.kind === kind);
const sum = (entries: Entry[]) => entries.reduce((acc, e) => acc + e.price, 0);

export interface Totals {
  today: number;
  week: number;
  month: number;
  all: number;
}

export function totals(entries: Entry[], kind: Kind, now: Date): Totals {
  const list = ofKind(notFuture(entries, now), kind);
  const since = (t: Date) => sum(list.filter((e) => e.createdAt >= t.getTime()));
  return {
    today: since(startOfDay(now)),
    week: since(startOfWeek(now)),
    month: since(startOfMonth(now)),
    all: sum(list),
  };
}

/** 最初の記録日を1日目とした今日の日数。記録が無ければ 0 */
export function daysSinceFirst(entries: Entry[], kind: Kind, now: Date): number {
  const list = ofKind(notFuture(entries, now), kind);
  if (list.length === 0) return 0;
  const first = Math.min(...list.map((e) => e.createdAt));
  return Math.max(1, calendarDaysBetween(new Date(first), now) + 1);
}

/**
 * このペースで1年続けたらいくらになるか。
 * 直近 min(30, 経過日数) 日の合計を1日あたりにならして365倍する。
 * 記録開始から7日未満は振れ幅が大きすぎる（初日の1件で年10万円になる）ので null
 */
export function annualPace(entries: Entry[], kind: Kind, now: Date): number | null {
  const elapsed = daysSinceFirst(entries, kind, now);
  if (elapsed < PACE_MIN_DAYS) return null;
  const windowDays = Math.min(PACE_WINDOW_DAYS, elapsed);
  const today = startOfDay(now);
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (windowDays - 1));
  const recent = ofKind(notFuture(entries, now), kind).filter((e) => e.createdAt >= from.getTime());
  return Math.round((sum(recent) / windowDays) * 365);
}

/** がまんした合計 − むだづかいの合計 */
export function balance(entries: Entry[], now: Date): number {
  const list = notFuture(entries, now);
  return sum(ofKind(list, "saved")) - sum(ofKind(list, "wasted"));
}

/** 目標を決めた日からのがまん額 */
export function goalProgress(entries: Entry[], goal: Goal, now: Date): number {
  return sum(ofKind(notFuture(entries, now), "saved").filter((e) => e.createdAt >= goal.startAt));
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export interface Streak {
  /** 連続してがまんを記録した日数 */
  days: number;
  /** 今日すでに記録したか（false なら今日記録しないと途切れる） */
  today: boolean;
}

/** 今日（まだなら昨日）からさかのぼって、がまんを記録した日が何日続いているか */
export function saveStreak(entries: Entry[], now: Date): Streak {
  const days = new Set(ofKind(notFuture(entries, now), "saved").map((e) => dayKey(new Date(e.createdAt))));
  const today = startOfDay(now);
  const hasToday = days.has(dayKey(today));
  let cursor = hasToday ? today : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return { days: count, today: hasToday };
}

export interface MonthSummary {
  year: number;
  /** 0 始まり */
  month: number;
  saved: number;
  wasted: number;
}

function inMonth(e: Entry, year: number, month: number): boolean {
  const d = new Date(e.createdAt);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthSummary(entries: Entry[], year: number, month: number, now: Date): MonthSummary {
  const list = notFuture(entries, now).filter((e) => inMonth(e, year, month));
  return { year, month, saved: sum(ofKind(list, "saved")), wasted: sum(ofKind(list, "wasted")) };
}

/** 指定した月までの直近 n か月（古い順） */
export function recentMonths(entries: Entry[], year: number, month: number, n: number, now: Date): MonthSummary[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(year, month - (n - 1 - i), 1);
    return monthSummary(entries, d.getFullYear(), d.getMonth(), now);
  });
}

export interface RankItem {
  name: string;
  emoji: string;
  total: number;
  count: number;
}

/** その月に金額の大きかった品目（品名でまとめる） */
export function monthRanking(entries: Entry[], kind: Kind, year: number, month: number, now: Date, top = 5): RankItem[] {
  const map = new Map<string, RankItem>();
  for (const e of ofKind(notFuture(entries, now), kind)) {
    if (!inMonth(e, year, month)) continue;
    const item = map.get(e.name) ?? { name: e.name, emoji: e.emoji, total: 0, count: 0 };
    item.total += e.price;
    item.count += 1;
    map.set(e.name, item);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, top);
}

/** 書き出しを勧める間隔 */
export const EXPORT_REMIND_DAYS = 30;

/** 記録があり、前回の書き出し（まだなら最初の記録）から30日たっていれば true */
export function exportDue(data: AppData, now: Date): boolean {
  if (data.entries.length === 0) return false;
  const since = data.lastExportAt ?? Math.min(...data.entries.map((e) => e.createdAt));
  return now.getTime() - since >= EXPORT_REMIND_DAYS * DAY;
}
