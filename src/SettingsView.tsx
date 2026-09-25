import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { EQUIVALENTS } from "./equivalents";
import { goalProgress, startOfDay } from "./stats";
import { DEFAULT_PRESETS, mergeData, newId, parseData, parsePrice, serializeForExport } from "./store";
import type { AppData, Equivalent, Goal, Kind, Preset } from "./types";

const KIND_LABEL: Record<Kind, string> = { saved: "がまん", wasted: "むだづかい" };

function exportFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `gaman-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

const KINDS: Kind[] = ["saved", "wasted"];

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 書き換えはすべて onChange(d => ...) の形で、その時点の最新データに対して行う。
 * 金額欄は画面から消えるときにも確定する（iOS はボタンを押しても入力欄の確定が起きないため）。
 * そのとき古いデータを丸ごと書き戻すと、消した行や外した目標が戻ってしまうので、
 * 対象（id・目標・換算表の行）がもう無ければ何もしない。
 */
export function SettingsView({ data, onChange }: { data: AppData; onChange: Dispatch<SetStateAction<AppData>> }) {
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  // 取り消せない操作（初期状態に戻す・目標を外す）は、もう一度押してもらってから実行する
  const [confirming, setConfirming] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const table = data.equivalents ?? EQUIVALENTS;

  const updatePreset = (id: string, patch: Partial<Preset>) =>
    onChange((d) => (d.presets.some((p) => p.id === id) ? { ...d, presets: d.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : d));
  const removePreset = (id: string) => onChange((d) => ({ ...d, presets: d.presets.filter((p) => p.id !== id) }));
  const addPreset = (kind: Kind) =>
    onChange((d) => ({ ...d, presets: [...d.presets, { id: newId(), kind, emoji: "⭐", name: "新しいボタン", price: null }] }));
  const resetPresets = (kind: Kind) => {
    onChange((d) => ({
      ...d,
      presets: [...d.presets.filter((p) => p.kind !== kind), ...DEFAULT_PRESETS.filter((p) => p.kind === kind).map((p) => ({ ...p }))],
    }));
    setConfirming(null);
  };
  /** 同じ種類のボタンの中で1つ上・下と入れ替える（画面の並び順＝配列の順） */
  const movePreset = (id: string, delta: -1 | 1) =>
    onChange((d) => {
      const preset = d.presets.find((p) => p.id === id);
      if (!preset) return d;
      const sameKind = d.presets.map((p, i) => ({ p, i })).filter(({ p }) => p.kind === preset.kind);
      const pos = sameKind.findIndex(({ p }) => p.id === id);
      const other = sameKind[pos + delta];
      if (!other) return d;
      const presets = [...d.presets];
      [presets[sameKind[pos].i], presets[other.i]] = [presets[other.i], presets[sameKind[pos].i]];
      return { ...d, presets };
    });

  /** 換算表の i 番目を書き換える。行が消えていたら何もしない */
  const updateEquivalent = (i: number, patch: Partial<Equivalent>) =>
    onChange((d) => {
      const list = d.equivalents ?? EQUIVALENTS;
      if (i >= list.length) return d;
      return { ...d, equivalents: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) };
    });
  const removeEquivalent = (i: number) =>
    onChange((d) => {
      const list = d.equivalents ?? EQUIVALENTS;
      // 全部消すと「既定の表」に戻ってしまうので、最後の1件は残す
      if (list.length <= 1) return d;
      return { ...d, equivalents: list.filter((_, j) => j !== i) };
    });
  const addEquivalent = () =>
    onChange((d) => ({ ...d, equivalents: [...(d.equivalents ?? EQUIVALENTS), { emoji: "⭐", name: "新しい品目", unit: "個", price: 1000 }] }));
  const resetEquivalents = () => {
    onChange((d) => {
      const { equivalents: _, ...rest } = d;
      return rest;
    });
    setConfirming(null);
  };

  const updateGoal = (patch: Partial<Goal>) => onChange((d) => (d.goal ? { ...d, goal: { ...d.goal, ...patch } } : d));

  const markExported = () => onChange((d) => ({ ...d, lastExportAt: Date.now() }));

  const exportData = async () => {
    const text = serializeForExport(data);
    const name = exportFileName();
    const file = new File([text], name, { type: "application/json" });
    // iPhone のホーム画面アプリではダウンロードが不安定なので、共有シート（「ファイルに保存」）を優先する
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        setMessage("書き出しました");
        markExported();
        return;
      } catch (e) {
        // 自分で閉じたときは何もしない。それ以外の失敗はダウンロードで保存し直す
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    // 保存できたかをこちらで確かめられないので、書き出し日は記録しない（30日ごとの声かけを止めない）
    setMessage("書き出しました。保存されていなければ「コピー」を試してください");
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(serializeForExport(data));
      setMessage("コピーしました。メモアプリなどに貼って保管してください");
      markExported();
    } catch {
      setMessage("コピーできませんでした");
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsed = parseData(await file.text());
    if (!parsed) {
      setMessage("がまんログの書き出しファイルではないため、読み込めませんでした");
      return;
    }
    setPendingImport(parsed);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    onChange((d) => mergeData(d, pendingImport));
    setMessage(`${pendingImport.entries.length}件の記録を読み込みました`);
    setPendingImport(null);
  };

  const goal = data.goal ?? null;
  const goalDone = goal !== null && goalProgress(data.entries, goal, new Date()) >= goal.price;

  return (
    <>
      <h2 className="section-title settings-title">設定</h2>

      <section className="settings-block">
        <h3>がまんの目標</h3>
        {goal ? (
          <>
            <p className="settings-hint">
              {goalDone
                ? "🎉 達成しました！ 名前と金額を次のほしいものに書き換えて、「今日から数え直す」を押してください。"
                : `${formatDate(goal.startAt)} からのがまん額でたまります。`}
            </p>
            <div className="goal-edit">
              <input
                className="preset-edit-emoji"
                value={goal.emoji}
                onChange={(e) => updateGoal({ emoji: e.target.value })}
                aria-label="目標の絵文字"
                maxLength={16}
              />
              <input
                className="goal-edit-name"
                value={goal.name}
                onChange={(e) => updateGoal({ name: e.target.value })}
                aria-label="目標の名前"
                maxLength={40}
              />
              <PriceInput
                className="goal-edit-price"
                value={goal.price}
                onCommit={(price) => price !== null && updateGoal({ price })}
                label="目標の金額（円）"
              />
            </div>
            <div className="form-actions form-actions--wrap">
              <button
                type="button"
                className={goalDone ? "button" : "button button--ghost"}
                onClick={() => updateGoal({ startAt: startOfDay(new Date()).getTime() })}
              >
                今日から数え直す
              </button>
              <ConfirmButton
                id="goal-clear"
                confirming={confirming}
                setConfirming={setConfirming}
                label="目標を外す"
                confirmLabel="本当に外す"
                onConfirm={() => {
                  onChange((d) => ({ ...d, goal: null }));
                  setConfirming(null);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="settings-hint">ほしいものを決めると、がまん画面にゲージが出ます。決めた日からのがまん額でたまります。</p>
            <div className="form-actions">
              <button
                type="button"
                className="button"
                onClick={() =>
                  onChange((d) => ({ ...d, goal: { name: "ほしいもの", emoji: "🎁", price: 30000, startAt: startOfDay(new Date()).getTime() } }))
                }
              >
                目標を決める
              </button>
            </div>
          </>
        )}
      </section>

      <section className="settings-block settings-block--wasted">
        <h3>むだづかいの月の上限</h3>
        <p className="settings-hint">決めておくと、むだづかい画面に「上限まであと ○円」を出し、超えたら警報が強くなります。空にすると上限なし。</p>
        <PriceInput
          className="limit-input"
          value={data.wasteLimit ?? null}
          allowEmpty
          placeholder="上限なし"
          onCommit={(price) => onChange((d) => ({ ...d, wasteLimit: price }))}
          label="月の上限（円）"
        />
      </section>

      {KINDS.map((kind) => (
        <section key={kind} className={`settings-block settings-block--${kind}`}>
          <h3>{KIND_LABEL[kind]}の定番ボタン</h3>
          <p className="settings-hint">金額を空にすると、押したときに毎回金額を聞きます。↑↓で並べ替えられます。</p>
          <ul className="preset-edit">
            {data.presets
              .filter((p) => p.kind === kind)
              .map((p, i, list) => (
                <PresetRow
                  key={p.id}
                  preset={p}
                  first={i === 0}
                  last={i === list.length - 1}
                  onUpdate={(patch) => updatePreset(p.id, patch)}
                  onRemove={() => removePreset(p.id)}
                  onMove={(delta) => movePreset(p.id, delta)}
                />
              ))}
          </ul>
          <div className="form-actions form-actions--wrap">
            <ConfirmButton
              id={`presets-${kind}`}
              confirming={confirming}
              setConfirming={setConfirming}
              label="最初の状態に戻す"
              confirmLabel="本当に戻す"
              onConfirm={() => resetPresets(kind)}
            />
            <button type="button" className="button" onClick={() => addPreset(kind)}>
              ボタンを追加
            </button>
          </div>
        </section>
      ))}

      <section className="settings-block">
        <h3>「○○ぶん」の換算表</h3>
        <p className="settings-hint">金額を置き換える品目です。2〜10個買える品目の中から、金額ごとに入れ替えて出します。</p>
        <ul className="preset-edit">
          {table.map((eq, i) => (
            <EquivalentRow
              key={i}
              eq={eq}
              removable={table.length > 1}
              onUpdate={(patch) => updateEquivalent(i, patch)}
              onRemove={() => removeEquivalent(i)}
            />
          ))}
        </ul>
        <div className="form-actions form-actions--wrap">
          <ConfirmButton
            id="equivalents"
            confirming={confirming}
            setConfirming={setConfirming}
            label="最初の状態に戻す"
            confirmLabel="本当に戻す"
            onConfirm={resetEquivalents}
          />
          <button
            type="button"
            className="button"
            onClick={addEquivalent}
          >
            品目を追加
          </button>
        </div>
      </section>

      <section className="settings-block" id="export">
        <h3>データの保管と引っ越し</h3>
        <p className="settings-hint">
          記録はこの端末の中だけにあります（記録 {data.entries.length}件
          {data.lastExportAt ? `・前回の書き出し ${formatDate(data.lastExportAt)}` : "・まだ書き出していません"}
          ）。機種変更の前に書き出して、新しい端末で読み込んでください。
        </p>
        <div className="form-actions form-actions--wrap">
          <button type="button" className="button" onClick={exportData}>
            ファイルに書き出す
          </button>
          <button type="button" className="button button--ghost" onClick={copyData}>
            コピー
          </button>
          <button type="button" className="button button--ghost" onClick={() => fileInput.current?.click()}>
            読み込む
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        {pendingImport && (
          <div className="confirm" role="alert">
            <p>
              記録 {pendingImport.entries.length}件・定番ボタン {pendingImport.presets.length}
              件を、いまのデータに足します。同じ記録は読み込んだほうで上書きします。
            </p>
            <div className="form-actions">
              <button type="button" className="button button--ghost" onClick={() => setPendingImport(null)}>
                やめる
              </button>
              <button type="button" className="button" onClick={confirmImport}>
                読み込む
              </button>
            </div>
          </div>
        )}
        {message && (
          <p className="settings-message" role="status">
            {message}
          </p>
        )}
      </section>
    </>
  );
}

/** 1回目は確認に切り替わり、2回目で実行するボタン */
function ConfirmButton({
  id,
  confirming,
  setConfirming,
  label,
  confirmLabel,
  onConfirm,
}: {
  id: string;
  confirming: string | null;
  setConfirming: (id: string | null) => void;
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  if (confirming !== id) {
    return (
      <button type="button" className="button button--ghost" onClick={() => setConfirming(id)}>
        {label}
      </button>
    );
  }
  return (
    <>
      <button type="button" className="button button--danger" onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="button button--ghost" onClick={() => setConfirming(null)}>
        やめる
      </button>
    </>
  );
}

/**
 * 金額の入力欄。入力途中の値（空・書きかけ）を保てるよう文字列で持ち、欄を離れたときに確定する。
 * 外から値が変わったとき（初期状態に戻す・読み込み）は入力欄も合わせる
 */
function PriceInput({
  value,
  onCommit,
  label,
  className,
  allowEmpty = false,
  placeholder,
}: {
  value: number | null;
  onCommit: (price: number | null) => void;
  label: string;
  className?: string;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  // 書き換え途中か。確定していない入力だけを、欄が消えるときに確定する
  // （削除した行や戻した行を、古い内容で書き戻さないため）
  const dirty = useRef(false);
  useEffect(() => {
    setText(value === null ? "" : String(value));
    setInvalid(false);
    dirty.current = false;
  }, [value]);

  const commit = () => {
    if (!dirty.current) return;
    if (text.trim() === "") {
      setInvalid(!allowEmpty);
      if (allowEmpty) {
        dirty.current = false;
        onCommit(null);
      }
      return;
    }
    const parsed = parsePrice(text);
    setInvalid(parsed === null);
    if (parsed !== null) {
      dirty.current = false;
      setText(String(parsed));
      onCommit(parsed);
    }
  };
  // iOS はボタン（タブ）を押しても入力欄の blur が起きないことがあるので、画面が切り替わって欄が消えるときにも確定する
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);

  return (
    <input
      className={`${className ?? ""}${invalid ? " is-invalid" : ""}`}
      value={text}
      onChange={(e) => {
        dirty.current = true;
        setText(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      inputMode="numeric"
      enterKeyHint="done"
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
    />
  );
}

function PresetRow({
  preset,
  first,
  last,
  onUpdate,
  onRemove,
  onMove,
}: {
  preset: Preset;
  first: boolean;
  last: boolean;
  onUpdate: (patch: Partial<Preset>) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <li className="preset-edit-row">
      <input
        className="preset-edit-emoji"
        value={preset.emoji}
        onChange={(e) => onUpdate({ emoji: e.target.value })}
        aria-label="絵文字"
        maxLength={16}
      />
      <input
        className="preset-edit-name"
        value={preset.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        aria-label="品名"
        maxLength={40}
      />
      <PriceInput
        className="preset-edit-price"
        value={preset.price}
        allowEmpty
        placeholder="毎回聞く"
        onCommit={(price) => onUpdate({ price })}
        label="金額（円）"
      />
      <span className="preset-edit-move">
        <button type="button" className="mini" onClick={() => onMove(-1)} disabled={first} aria-label={`${preset.name}を上へ`}>
          ↑
        </button>
        <button type="button" className="mini" onClick={() => onMove(1)} disabled={last} aria-label={`${preset.name}を下へ`}>
          ↓
        </button>
      </span>
      <button type="button" className="mini mini--danger preset-edit-del" onClick={onRemove} aria-label={`${preset.name}を削除`}>
        ✕
      </button>
    </li>
  );
}

function EquivalentRow({
  eq,
  removable,
  onUpdate,
  onRemove,
}: {
  eq: Equivalent;
  removable: boolean;
  onUpdate: (patch: Partial<Equivalent>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="preset-edit-row eq-edit-row">
      <input className="preset-edit-emoji" value={eq.emoji} onChange={(e) => onUpdate({ emoji: e.target.value })} aria-label="絵文字" maxLength={16} />
      <input
        className="preset-edit-name"
        value={eq.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        aria-label="品目"
        maxLength={40}
      />
      <span className="eq-edit-detail">
        <PriceInput className="eq-edit-price" value={eq.price} onCommit={(price) => price !== null && onUpdate({ price })} label="値段（円）" />
        <span aria-hidden="true">円 ／ 1</span>
        <input className="eq-edit-unit" value={eq.unit} onChange={(e) => onUpdate({ unit: e.target.value })} aria-label="数え方" maxLength={4} />
      </span>
      <button
        type="button"
        className="mini mini--danger preset-edit-del"
        onClick={onRemove}
        disabled={!removable}
        aria-label={`${eq.name}を削除`}
      >
        ✕
      </button>
    </li>
  );
}
