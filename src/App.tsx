import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmountSheet, type AmountRequest } from "./AmountSheet";
import { EntrySheet } from "./EntrySheet";
import { EQUIVALENTS, pickEquivalent, yen } from "./equivalents";
import { History } from "./History";
import { RecordPop, type PopInfo } from "./RecordPop";
import { ReviewView } from "./ReviewView";
import { SettingsView } from "./SettingsView";
import { annualPace, balance, daysSinceFirst, exportDue, goalProgress, PACE_MIN_DAYS, saveStreak, totals } from "./stats";
import { loadData, newId, saveData } from "./store";
import type { AppData, Entry, Goal, Kind, Preset } from "./types";

const TAPE_TEXT = "むだづかい警報　".repeat(12);
type Tab = Kind | "review" | "settings";
const THEME_COLOR: Record<Tab, string> = { saved: "#FFE14D", wasted: "#2B0A3D", review: "#B8F5DC", settings: "#9BE3FF" };
/** 振り返り・設定タブは、がまん画面の部品の見た目を土台に地の色だけ変える */
const APP_CLASS: Record<Tab, string> = {
  saved: "app app--saved",
  wasted: "app app--wasted",
  review: "app app--saved app--review",
  settings: "app app--saved app--settings",
};

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [tab, setTab] = useState<Tab>("saved");
  const [wipe, setWipe] = useState<Tab | null>(null);
  const [pop, setPop] = useState<PopInfo | null>(null);
  const [amountRequest, setAmountRequest] = useState<AmountRequest | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [exportReminderClosed, setExportReminderClosed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [bump, setBump] = useState(0);
  const firstRender = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);
  // 振り返り・設定タブでは記録画面の集計を使わないが、フックの呼び出し順を保つため種類を1つ決めておく
  const mode: Kind = tab === "wasted" ? "wasted" : "saved";
  const table = data.equivalents ?? EQUIVALENTS;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveFailed(!saveData(data));
  }, [data]);

  // 日付をまたいでも「今日」の集計がずれないよう、表に戻ったとき・次の午前0時に時刻を取り直す
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setNow(new Date()), next.getTime() - now.getTime() + 1000);
    return () => window.clearTimeout(timer);
  }, [now]);

  useEffect(() => {
    document.documentElement.dataset.mode = tab;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[tab]);
  }, [tab]);

  // 端末の「視差効果を減らす」設定に関わらず演出を出す（ユーザー指示 2026-09-24）
  const switchTab = (next: Tab) => {
    if (next === tab || wipe) return;
    setWipe(next);
    window.setTimeout(() => {
      setBump(0);
      setTab(next);
      scroller.current?.scrollTo({ top: 0 });
    }, 260);
    window.setTimeout(() => setWipe(null), 620);
  };

  const record = (kind: Kind, name: string, emoji: string, price: number, presetId?: string) => {
    const at = new Date();
    const entry: Entry = { id: newId(), kind, name, emoji, price, createdAt: at.getTime(), ...(presetId ? { presetId } : {}) };
    const entries = [...data.entries, entry];
    setData({ ...data, entries });
    setNow(at);
    if (kind === tab) setBump((n) => n + 1);
    const info: PopInfo = { entry, total: totals(entries, kind, at).all, pace: annualPace(entries, kind, at) };
    // この記録で目標に届いた・上限を超えた、の瞬間だけポップで知らせる
    const goal = data.goal;
    if (kind === "saved" && goal && goalProgress(data.entries, goal, at) < goal.price && goalProgress(entries, goal, at) >= goal.price) {
      info.goalReached = goal.name || "目標";
    }
    const limit = data.wasteLimit;
    if (kind === "wasted" && limit) {
      const month = totals(entries, "wasted", at).month;
      if (month > limit && month - price <= limit) info.overLimit = month - limit;
    }
    setPop(info);
  };

  const onPreset = (preset: Preset) => {
    if (preset.price === null) setAmountRequest({ kind: preset.kind, preset });
    else record(preset.kind, preset.name || "名前なし", preset.emoji, preset.price, preset.id);
  };

  const undo = (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
    setPop(null);
  };

  const closePop = useCallback(() => setPop(null), []);

  const deleteEntry = (id: string) => setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  const saveEntry = (entry: Entry) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entry.id ? entry : e)).sort((a, b) => a.createdAt - b.createdAt) }));
    setNow(new Date());
    setEditing(null);
  };

  const view = useMemo(() => {
    const t = totals(data.entries, mode, now);
    return {
      totals: t,
      pace: annualPace(data.entries, mode, now),
      days: daysSinceFirst(data.entries, mode, now),
      balance: balance(data.entries, now),
      equivalent: pickEquivalent(t.month, table),
      streak: saveStreak(data.entries, now),
      goal: data.goal ? { goal: data.goal, progress: goalProgress(data.entries, data.goal, now) } : null,
    };
  }, [data.entries, data.goal, mode, now, table]);

  const presets = data.presets.filter((p) => p.kind === mode);
  const showBanner = !bannerClosed && !isStandalone() && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const showExportReminder = !exportReminderClosed && (tab === "saved" || tab === "wasted") && exportDue(data, now);
  const isSaved = mode === "saved";
  const limit = data.wasteLimit ?? null;
  const overLimit = !isSaved && limit !== null && view.totals.month > limit;

  return (
    <div className={APP_CLASS[tab]}>
      <div className="scroller" ref={scroller}>
        <header className="topbar">
          <h1 className="logo">
            <span className="logo-mark" aria-hidden="true">
              {tab === "wasted" ? "🚨" : "🐷"}
            </span>
            がまんログ
          </h1>
        </header>

        {showBanner && (
          <div className="notice">
            <p>記録はこの端末の中に保存されます。共有ボタンから「ホーム画面に追加」して、追加したアプリで使ってください。</p>
            <button type="button" onClick={() => setBannerClosed(true)}>
              閉じる
            </button>
          </div>
        )}
        {saveFailed && (
          <div className="notice notice--error" role="alert">
            <p>保存できませんでした。プライベートブラウズを解除するか、空き容量を確認してください。</p>
          </div>
        )}
        {showExportReminder && (
          <div className="notice notice--remind">
            <p>
              {data.lastExportAt ? "前回の書き出しから30日たちました。" : "記録を始めて30日たちました。"}
              記録はこの端末の中だけにあるので、書き出して保管しておきましょう。
            </p>
            <span className="notice-actions">
              <button type="button" onClick={() => switchTab("settings")}>
                書き出す
              </button>
              <button type="button" onClick={() => setExportReminderClosed(true)}>
                あとで
              </button>
            </span>
          </div>
        )}

        {tab === "settings" ? (
          <main className="content">
            <SettingsView data={data} onChange={setData} />
          </main>
        ) : tab === "review" ? (
          <main className="content">
            <ReviewView data={data} table={table} now={now} />
          </main>
        ) : (
          <>
            <BalanceStrip value={view.balance} />

            <main className="content">
              <section
                key={`${mode}-${bump}`}
                className={`hero${bump ? " is-bump" : ""}${overLimit ? " is-over" : ""}`}
                aria-label={isSaved ? "今月がまんした金額" : "今月のむだづかい"}
              >
                {isSaved ? (
                  <>
                    <div className="sunburst" aria-hidden="true" />
                    <p className="hero-label">今月がまんした</p>
                    <p className="hero-amount">
                      <span className="hero-number" style={{ ["--len" as string]: view.totals.month.toLocaleString("ja-JP").length }}>
                        {view.totals.month.toLocaleString("ja-JP")}
                      </span>
                      <span className="hero-yen">円</span>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="caution-tape" aria-hidden="true">
                      <span>{TAPE_TEXT}</span>
                    </div>
                    <p className="hero-label">{overLimit ? "上限オーバー" : "今月のむだづかい"}</p>
                    <p className="hero-amount led">
                      <span className="hero-yen">¥</span>
                      <span className="hero-number" style={{ ["--len" as string]: view.totals.month.toLocaleString("ja-JP").length }}>
                        {view.totals.month.toLocaleString("ja-JP")}
                      </span>
                    </p>
                  </>
                )}
                <Equivalent kind={mode} amount={view.totals.month} eq={view.equivalent} />
                {!isSaved && limit !== null && <LimitMeter spent={view.totals.month} limit={limit} />}
                {!isSaved && (
                  <div className="caution-tape caution-tape--bottom" aria-hidden="true">
                    <span>{TAPE_TEXT}</span>
                  </div>
                )}
              </section>

              {isSaved && <StreakBadge days={view.streak.days} today={view.streak.today} />}
              {isSaved && view.goal && <GoalCard goal={view.goal.goal} progress={view.goal.progress} />}

              <section className="section" aria-labelledby="presets-title">
                <h2 id="presets-title" className="section-title">
                  {isSaved ? "なにをがまんした？" : "なにに使っちゃった？"}
                </h2>
                <div className="preset-grid">
                  {presets.map((p) => (
                    <button type="button" key={p.id} className="preset" onClick={() => onPreset(p)}>
                      <span className="preset-emoji" aria-hidden="true">
                        {p.emoji || "💰"}
                      </span>
                      <span className="preset-name">{p.name || "名前なし"}</span>
                      <span className="preset-price">{p.price === null ? "金額を入力" : yen(p.price)}</span>
                    </button>
                  ))}
                  <button type="button" className="preset preset--other" onClick={() => setAmountRequest({ kind: mode })}>
                    <span className="preset-emoji" aria-hidden="true">
                      ✏️
                    </span>
                    <span className="preset-name">そのほか</span>
                    <span className="preset-price">品名と金額を入力</span>
                  </button>
                </div>
              </section>

              <section className="section" aria-labelledby="stats-title">
                <h2 id="stats-title" className="section-title">
                  {isSaved ? "がまんの記録" : "むだづかいの記録"}
                </h2>
                <dl className="stats">
                  <div className="stat">
                    <dt>今日</dt>
                    <dd>{yen(view.totals.today)}</dd>
                  </div>
                  <div className="stat">
                    <dt>今週</dt>
                    <dd>{yen(view.totals.week)}</dd>
                  </div>
                  <div className="stat">
                    <dt>今月</dt>
                    <dd>{yen(view.totals.month)}</dd>
                  </div>
                  <div className="stat">
                    <dt>これまで</dt>
                    <dd>{yen(view.totals.all)}</dd>
                  </div>
                </dl>
                <div className="pace">
                  {view.pace === null ? (
                    <p className="pace-wait">
                      記録をつけ始めて{PACE_MIN_DAYS}日たつと、1年続けた場合の金額を出します
                      {view.days > 0 && `（いま${view.days}日目）`}
                    </p>
                  ) : isSaved ? (
                    <p>
                      このペースなら1年で
                      <strong>{yen(view.pace)}</strong>
                      浮きます
                    </p>
                  ) : (
                    <p>
                      このままだと1年で
                      <strong>{yen(view.pace)}</strong>
                      消えます
                    </p>
                  )}
                </div>
              </section>

              <History kind={mode} entries={data.entries} onDelete={deleteEntry} onEdit={setEditing} />
            </main>
          </>
        )}
      </div>

      <nav className="tabbar" aria-label="画面の切り替え">
        <button type="button" className="tab tab--saved" aria-current={tab === "saved" ? "page" : undefined} onClick={() => switchTab("saved")}>
          <span aria-hidden="true">🐷</span>がまん
        </button>
        <button
          type="button"
          className="tab tab--wasted"
          aria-current={tab === "wasted" ? "page" : undefined}
          onClick={() => switchTab("wasted")}
        >
          <span aria-hidden="true">💸</span>むだづかい
        </button>
        <button
          type="button"
          className="tab tab--review"
          aria-current={tab === "review" ? "page" : undefined}
          onClick={() => switchTab("review")}
        >
          <span aria-hidden="true">📊</span>ふりかえり
        </button>
        <button
          type="button"
          className="tab tab--settings"
          aria-current={tab === "settings" ? "page" : undefined}
          onClick={() => switchTab("settings")}
        >
          <span aria-hidden="true">⚙️</span>設定
        </button>
      </nav>

      {wipe && <div className={`wipe wipe--${wipe}`} aria-hidden="true" />}

      {pop && <RecordPop info={pop} table={table} onClose={closePop} onUndo={undo} />}
      {amountRequest && (
        <AmountSheet
          request={amountRequest}
          onCancel={() => setAmountRequest(null)}
          onSubmit={(name, emoji, price) => {
            record(amountRequest.kind, name, emoji, price, amountRequest.preset?.id);
            setAmountRequest(null);
          }}
        />
      )}
      {editing && <EntrySheet entry={editing} onCancel={() => setEditing(null)} onSave={saveEntry} />}
    </div>
  );
}

function BalanceStrip({ value }: { value: number }) {
  const state = value > 0 ? "plus" : value < 0 ? "minus" : "even";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  const face = value > 0 ? "😎" : value < 0 ? "😱" : "😐";
  return (
    <div className={`balance balance--${state}`}>
      <span className="balance-label">がまん − むだづかい</span>
      <span className="balance-value">
        <span aria-hidden="true">{face}</span> {sign}
        {yen(Math.abs(value))}
      </span>
    </div>
  );
}

/** 連続でがまんを記録した日数。今日まだなら、途切れる前に知らせる */
function StreakBadge({ days, today }: { days: number; today: boolean }) {
  if (days === 0) return null;
  return today ? (
    <p className="streak">
      <span aria-hidden="true">🔥</span> {days}日連続でがまん中！
    </p>
  ) : (
    <p className="streak streak--warn">
      <span aria-hidden="true">⏰</span> 今日がまんで{days + 1}日連続！
    </p>
  );
}

function GoalCard({ goal, progress }: { goal: Goal; progress: number }) {
  const rate = Math.min(1, progress / goal.price);
  const done = progress >= goal.price;
  return (
    <section className={`goal${done ? " is-done" : ""}`} aria-label="がまんの目標">
      <p className="goal-head">
        <span className="goal-emoji" aria-hidden="true">
          {goal.emoji || "🎁"}
        </span>
        <span className="goal-name">{goal.name || "目標"}</span>
        <span className="goal-price">{yen(goal.price)}</span>
      </p>
      <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal.price} aria-valuenow={Math.min(progress, goal.price)}>
        <span style={{ width: `${rate * 100}%` }} />
      </div>
      <p className="goal-rest">{done ? "🎉 達成！ 設定で次の目標を決めよう" : `あと ${yen(goal.price - progress)}（${Math.floor(rate * 100)}%）`}</p>
    </section>
  );
}

/** むだづかいの月の上限までの残り。超えたら赤く点滅させる */
function LimitMeter({ spent, limit }: { spent: number; limit: number }) {
  const over = spent > limit;
  return (
    <div className={`limit${over ? " is-over" : ""}`}>
      <div className="limit-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(1, spent / limit) * 100}%` }} />
      </div>
      <p className="limit-text">{over ? `上限 ${yen(limit)} を ${yen(spent - limit)} オーバー！` : `上限 ${yen(limit)} まで あと ${yen(limit - spent)}`}</p>
    </div>
  );
}

const MAX_ICONS = 12;

function Equivalent({ kind, amount, eq }: { kind: Kind; amount: number; eq: ReturnType<typeof pickEquivalent> }) {
  if (amount === 0) {
    return <p className="equiv-empty">{kind === "saved" ? "まだ0円。今日ひとつ、がまんしてみよう" : "今月はまだゼロ。この調子で"}</p>;
  }
  if (!eq) return <p className="equiv-empty">{kind === "saved" ? "小さな一歩！" : "まだ小さいうちに止めよう"}</p>;
  const shown = Math.min(eq.count, MAX_ICONS);
  return (
    <div className="equiv">
      <p className="equiv-icons" aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 60}ms` }}>
            {eq.emoji}
          </span>
        ))}
        {eq.count > MAX_ICONS && <span className="equiv-more">+{eq.count - MAX_ICONS}</span>}
      </p>
      <p className="equiv-text">
        {eq.name} {eq.count}
        {eq.unit}
        {kind === "saved" ? "ぶん浮いた！" : "ぶんが消えた…"}
      </p>
    </div>
  );
}
