import { useEffect, useState } from "react";
import { yen } from "./equivalents";
import { renderBragImage, shareOrDownload } from "./shareImage";
import { Sheet } from "./Sheet";
import { monthRanking, monthSummary, recentMonths, type RankItem } from "./stats";
import type { AppData, Equivalent, Kind } from "./types";

const CHART_MONTHS = 6;

/** 月ごとの振り返り。月を選んで、合計・直近6か月の推移・品目ランキング・自慢用の画像を見る */
export function ReviewView({ data, table, now }: { data: AppData; table: Equivalent[]; now: Date }) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [brag, setBrag] = useState<{ file: File; url: string } | null>(null);
  const [making, setMaking] = useState(false);
  const [message, setMessage] = useState("");

  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const move = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const summary = monthSummary(data.entries, year, month, now);
  const months = recentMonths(data.entries, year, month, CHART_MONTHS, now);
  const max = Math.max(1, ...months.flatMap((m) => [m.saved, m.wasted]));
  const diff = summary.saved - summary.wasted;

  useEffect(
    () => () => {
      if (brag) URL.revokeObjectURL(brag.url);
    },
    [brag],
  );

  // 画像を作る処理は非同期なので、共有はプレビューを見てからもう一度押してもらう（共有シートは操作の直後にしか開けない）
  const makeImage = async () => {
    setMaking(true);
    setMessage("");
    try {
      const blob = await renderBragImage({ year, month, saved: summary.saved, wasted: summary.wasted, table });
      const file = new File([blob], `gaman-log-${year}-${String(month + 1).padStart(2, "0")}.png`, { type: "image/png" });
      setBrag({ file, url: URL.createObjectURL(blob) });
    } catch {
      setMessage("画像を作れませんでした");
    } finally {
      setMaking(false);
    }
  };

  return (
    <>
      <div className="month-nav">
        <button type="button" className="icon-button" onClick={() => move(-1)} aria-label="前の月">
          ‹
        </button>
        <h2 className="section-title month-title">
          {year}年{month + 1}月
        </h2>
        <button type="button" className="icon-button" onClick={() => move(1)} disabled={isCurrent} aria-label="次の月">
          ›
        </button>
      </div>

      <dl className="stats review-stats">
        <div className="stat stat--saved">
          <dt>がまん</dt>
          <dd>{yen(summary.saved)}</dd>
        </div>
        <div className="stat stat--wasted">
          <dt>むだづかい</dt>
          <dd>{yen(summary.wasted)}</dd>
        </div>
        <div className="stat stat--diff">
          <dt>差し引き</dt>
          <dd>
            {diff >= 0 ? "+" : "−"}
            {yen(Math.abs(diff))}
          </dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="chart-title">
        <h2 id="chart-title" className="section-title">
          直近{CHART_MONTHS}か月
        </h2>
        <div className="chart" role="img" aria-label={months.map((m) => `${m.month + 1}月 がまん${m.saved}円 むだづかい${m.wasted}円`).join("、")}>
          {months.map((m) => (
            <div key={`${m.year}-${m.month}`} className={`chart-col${m.year === year && m.month === month ? " is-current" : ""}`}>
              <div className="chart-bars">
                <span className="chart-bar chart-bar--saved" style={{ height: `${(m.saved / max) * 100}%` }} />
                <span className="chart-bar chart-bar--wasted" style={{ height: `${(m.wasted / max) * 100}%` }} />
              </div>
              <span className="chart-label">{m.month + 1}月</span>
            </div>
          ))}
        </div>
        <p className="chart-legend">
          <span className="legend legend--saved">がまん</span>
          <span className="legend legend--wasted">むだづかい</span>
        </p>
      </section>

      <Ranking kind="saved" items={monthRanking(data.entries, "saved", year, month, now)} />
      <Ranking kind="wasted" items={monthRanking(data.entries, "wasted", year, month, now)} />

      <section className="section">
        <button type="button" className="preset preset--other brag-button" onClick={makeImage} disabled={making}>
          <span className="preset-emoji" aria-hidden="true">
            📸
          </span>
          <span className="preset-name">{making ? "画像を作っています…" : "この月の自慢画像を作る"}</span>
        </button>
        {message && <p className="form-error">{message}</p>}
      </section>

      {brag && (
        <Sheet title="自慢画像" onClose={() => setBrag(null)} placement="center">
          <img className="brag-preview" src={brag.url} alt={`${month + 1}月に${yen(summary.saved)}がまんした画像`} />
          <div className="form-actions">
            <button type="button" className="button button--ghost" onClick={() => setBrag(null)}>
              閉じる
            </button>
            <button type="button" className="button" onClick={() => void shareOrDownload(brag.file)}>
              共有・保存する
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Ranking({ kind, items }: { kind: Kind; items: RankItem[] }) {
  const saved = kind === "saved";
  return (
    <section className={`settings-block settings-block--${kind} ranking`}>
      <h3>{saved ? "よくがまんしたもの" : "よく使ってしまったもの"}</h3>
      {items.length === 0 ? (
        <p className="settings-hint">この月の記録はありません。</p>
      ) : (
        <ol className="ranking-list">
          {items.map((item, i) => (
            <li key={item.name} className="ranking-row">
              <span className="ranking-rank">{i + 1}</span>
              <span className="ranking-emoji" aria-hidden="true">
                {item.emoji || "💰"}
              </span>
              <span className="ranking-name">{item.name}</span>
              <span className="ranking-count">{item.count}回</span>
              <span className="ranking-total">{yen(item.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
