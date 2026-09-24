import type { Entry, Kind } from "./types";

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
