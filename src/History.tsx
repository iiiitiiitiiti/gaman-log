import { useState } from "react";
import { yen } from "./equivalents";
import type { Entry, Kind } from "./types";

const PAGE = 30;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]}) ${hh}:${mm}`;
}

export function History({ kind, entries, onDelete }: { kind: Kind; entries: Entry[]; onDelete: (id: string) => void }) {
  const [limit, setLimit] = useState(PAGE);
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = entries.filter((e) => e.kind === kind).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="section" aria-labelledby="history-title">
      <h2 id="history-title" className="section-title">
        履歴
      </h2>
      {list.length === 0 ? (
        <p className="history-empty">{kind === "saved" ? "がまんしたら、上のボタンをタップ。" : "むだづかいはまだありません。"}</p>
      ) : (
        <ul className="history">
          {list.slice(0, limit).map((e) => (
            <li key={e.id} className="history-row">
              <span className="history-emoji" aria-hidden="true">
                {e.emoji || "💰"}
              </span>
              <span className="history-main">
                <span className="history-name">{e.name}</span>
                <span className="history-when">{formatWhen(e.createdAt)}</span>
              </span>
              <span className="history-price">{yen(e.price)}</span>
              {confirming === e.id ? (
                <span className="history-confirm">
                  <button type="button" className="mini mini--danger" onClick={() => onDelete(e.id)}>
                    消す
                  </button>
                  <button type="button" className="mini" onClick={() => setConfirming(null)}>
                    やめる
                  </button>
                </span>
              ) : (
                <button type="button" className="mini" onClick={() => setConfirming(e.id)} aria-label={`${e.name}の記録を消す`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && (
        <button type="button" className="button button--ghost button--wide" onClick={() => setLimit(limit + PAGE)}>
          もっと見る（残り{list.length - limit}件）
        </button>
      )}
    </section>
  );
}
