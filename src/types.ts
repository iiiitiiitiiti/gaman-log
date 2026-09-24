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

export interface AppData {
  version: 1;
  entries: Entry[];
  presets: Preset[];
}
