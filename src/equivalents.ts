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
  { emoji: "🧃", name: "ペットボトル", unit: "本", price: 160 },
  { emoji: "🥐", name: "菓子パン", unit: "個", price: 200 },
  { emoji: "🍟", name: "フライドポテト", unit: "個", price: 330 },
  { emoji: "☕", name: "カフェラテ", unit: "杯", price: 450 },
  { emoji: "🍚", name: "牛丼", unit: "杯", price: 500 },
  { emoji: "📖", name: "マンガ", unit: "冊", price: 550 },
  { emoji: "🍔", name: "ハンバーガーセット", unit: "回", price: 750 },
  { emoji: "🍜", name: "ラーメン", unit: "杯", price: 1000 },
  { emoji: "🎤", name: "カラオケ", unit: "回", price: 1500 },
  { emoji: "🎬", name: "映画", unit: "回", price: 2000 },
  { emoji: "👕", name: "Tシャツ", unit: "枚", price: 3000 },
  { emoji: "🍖", name: "焼肉食べ放題", unit: "回", price: 4000 },
  { emoji: "🍣", name: "回らないお寿司", unit: "回", price: 5000 },
  { emoji: "🎮", name: "ゲームソフト", unit: "本", price: 7000 },
  { emoji: "🎢", name: "テーマパーク1日券", unit: "枚", price: 10000 },
  { emoji: "👟", name: "スニーカー", unit: "足", price: 15000 },
  { emoji: "🎧", name: "ワイヤレスイヤホン", unit: "個", price: 25000 },
  { emoji: "♨️", name: "温泉旅行", unit: "回", price: 30000 },
  { emoji: "🕹️", name: "ゲーム機", unit: "台", price: 50000 },
  { emoji: "✈️", name: "沖縄旅行", unit: "回", price: 80000 },
  { emoji: "📱", name: "スマホ", unit: "台", price: 120000 },
  { emoji: "💻", name: "ノートパソコン", unit: "台", price: 180000 },
  { emoji: "🏝️", name: "ハワイ旅行", unit: "回", price: 300000 },
  { emoji: "🚗", name: "中古の軽自動車", unit: "台", price: 600000 },
];

export interface EquivalentResult extends Equivalent {
  count: number;
}

const MIN_COUNT = 2;
const MAX_COUNT = 10;

/**
 * 金額を身近なモノに置き換える。
 * 2〜10個買えるモノを候補にし、金額から決まる番号で1つ選ぶ（同じ金額なら同じモノ、金額が変わると入れ替わる）。
 * 候補が無いとき（少額・高額）は、1個以上買える中でいちばん高いモノ。いちばん安いモノも買えなければ null
 */
export function pickEquivalent(amount: number): EquivalentResult | null {
  if (amount < EQUIVALENTS[0].price) return null;
  const withCount = EQUIVALENTS.map((eq) => ({ ...eq, count: Math.floor(amount / eq.price) }));
  const candidates = withCount.filter((eq) => eq.count >= MIN_COUNT && eq.count <= MAX_COUNT);
  if (candidates.length === 0) return withCount.filter((eq) => eq.count >= 1).at(-1) ?? null;
  const index = (Math.imul(amount, 2654435761) >>> 0) % candidates.length;
  return candidates[index];
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
