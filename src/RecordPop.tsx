import { useEffect, useMemo } from "react";
import { pickEquivalent, yen } from "./equivalents";
import type { Entry, Equivalent } from "./types";

export interface PopInfo {
  entry: Entry;
  /** 記録後のこれまでの合計 */
  total: number;
  /** 年間ペース（まだ出せないときは null） */
  pace: number | null;
  /** この記録で目標に届いたら、その目標名 */
  goalReached?: string;
  /** この記録で月の上限を超えたら、超えた金額 */
  overLimit?: number;
}

const AUTO_CLOSE_MS = 5000;
const COINS = 18;

export function RecordPop({
  info,
  table,
  onClose,
  onUndo,
}: {
  info: PopInfo;
  table: Equivalent[];
  onClose: () => void;
  onUndo: (id: string) => void;
}) {
  const { entry, total, pace } = info;
  const saved = entry.kind === "saved";
  const eq = pickEquivalent(total, table);

  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [info, onClose]);

  // 降らせるコインの位置・速さは記録ごとに1回だけ決める（再描画で飛ばない）
  const coins = useMemo(
    () =>
      Array.from({ length: COINS }, (_, i) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 500),
        duration: 1100 + Math.round(Math.random() * 900),
        size: 1.4 + Math.random() * 1.6,
        spin: Math.random() > 0.5 ? 1 : -1,
        key: i,
      })),
    [info],
  );

  let line: string;
  if (saved) {
    line = eq ? `これまで ${yen(total)}＝${eq.emoji}${eq.name}${eq.count}${eq.unit}ぶん！` : `これまで ${yen(total)}！`;
  } else if (pace !== null) {
    line = `このままだと1年で ${yen(pace)} 消えます`;
  } else {
    line = eq ? `これまで ${yen(total)}＝${eq.emoji}${eq.name}${eq.count}${eq.unit}ぶんが消えた` : `これまで ${yen(total)}`;
  }

  return (
    <div className={`pop pop--${entry.kind}`} role="dialog" aria-modal="true" aria-labelledby="pop-title" onClick={onClose}>
      {saved && (
        <div className="coins" aria-hidden="true">
          {coins.map((c) => (
            <span
              key={c.key}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}ms`,
                animationDuration: `${c.duration}ms`,
                fontSize: `${c.size}rem`,
                ["--spin" as string]: c.spin,
              }}
            >
              🪙
            </span>
          ))}
        </div>
      )}
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <p className="pop-kicker">{saved ? "がまん成功！" : "むだづかい発生"}</p>
        <p className="pop-item">
          <span aria-hidden="true">{entry.emoji || "💰"}</span> {entry.name}
        </p>
        <p id="pop-title" className="pop-amount" style={{ ["--len" as string]: yen(entry.price).length }}>
          {saved ? "+" : "−"}
          {yen(entry.price)}
        </p>
        <p className="pop-line">{line}</p>
        {info.goalReached && <p className="pop-extra pop-extra--goal">🎉 目標「{info.goalReached}」達成！</p>}
        {info.overLimit !== undefined && <p className="pop-extra pop-extra--over">🚨 今月の上限を {yen(info.overLimit)} 超えました</p>}
        <div className="pop-actions">
          <button type="button" className="button button--ghost" onClick={() => onUndo(entry.id)}>
            取り消す
          </button>
          <button type="button" className="button" onClick={onClose} autoFocus>
            {saved ? "やったね" : "反省する"}
          </button>
        </div>
      </div>
    </div>
  );
}
