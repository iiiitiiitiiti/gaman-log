/** saved = がまんした（使わなかった）、wasted = むだづかいした */
export type Kind = "saved" | "wasted";

export interface Entry {
  id: string;
  kind: Kind;
  name: string;
  emoji: string;
  /** 円。1 以上の整数 */
  price: number;
  /** 記録した時刻（epoch ミリ秒） */
  createdAt: number;
  /** ワンタップで記録した元の定番ボタン。定番を編集・削除しても記録は変わらない（参照用のみ） */
  presetId?: string;
}

export interface Preset {
  id: string;
  kind: Kind;
  name: string;
  emoji: string;
  /** null ならタップ後に金額を聞く（むだづかいのように毎回金額が違うもの） */
  price: number | null;
}

/** 金額を身近なモノに置き換えるための目安（値段はおおよそ） */
export interface Equivalent {
  emoji: string;
  name: string;
  unit: string;
  price: number;
}

/** がまんの目標。決めた日（startAt）からのがまん額でたまっていく */
export interface Goal {
  name: string;
  emoji: string;
  price: number;
  startAt: number;
}

/*
 * 目標・上限・書き出し日・自分用の換算表は後から足した項目なので、すべて省略可能にして
 * version 1 のまま読み書きする（古い書き出しファイルもそのまま読める）。
 */
export interface AppData {
  version: 1;
  entries: Entry[];
  presets: Preset[];
  goal?: Goal | null;
  /** むだづかいの月の上限（円）。null / 省略なら上限なし */
  wasteLimit?: number | null;
  /** 最後に書き出した（ファイル・コピー）時刻 */
  lastExportAt?: number;
  /** 自分で編集した換算表。省略なら既定の表 */
  equivalents?: Equivalent[];
}
