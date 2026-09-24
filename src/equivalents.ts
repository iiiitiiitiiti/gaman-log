/** 金額を身近なモノに置き換えるための目安（値段はおおよそ） */
export interface Equivalent {
  emoji: string;
  name: string;
  unit: string;
  price: number;
}

export const EQUIVALENTS: Equivalent[] = [
  { emoji: "🍬", name: "駄菓子", unit: "個", price: 30 },
  { emoji: "🍦", name: "アイス", unit: "本", price: 100 },
  { emoji: "🍙", name: "おにぎり", unit: "個", price: 150 },
  { emoji: "📖", name: "マンガ", unit: "冊", price: 550 },
  { emoji: "🍜", name: "ラーメン", unit: "杯", price: 1000 },
  { emoji: "🎬", name: "映画", unit: "回", price: 2000 },
  { emoji: "🍣", name: "回らないお寿司", unit: "回", price: 5000 },
  { emoji: "🎮", name: "ゲームソフト", unit: "本", price: 7000 },
  { emoji: "🎢", name: "テーマパーク1日券", unit: "枚", price: 10000 },
  { emoji: "♨️", name: "温泉旅行", unit: "回", price: 30000 },
  { emoji: "📱", name: "スマホ", unit: "台", price: 120000 },
  { emoji: "🏝️", name: "ハワイ旅行", unit: "回", price: 300000 },
];

export interface EquivalentResult extends Equivalent {
  count: number;
}

/** 1個以上買える中でいちばん高いモノを選ぶ。1円も無ければ null */
export function pickEquivalent(amount: number): EquivalentResult | null {
  if (amount < EQUIVALENTS[0].price) return null;
  let best = EQUIVALENTS[0];
  for (const eq of EQUIVALENTS) if (eq.price <= amount) best = eq;
  return { ...best, count: Math.floor(amount / best.price) };
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
