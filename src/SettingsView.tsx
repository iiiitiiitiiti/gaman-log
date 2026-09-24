import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { DEFAULT_PRESETS, mergeData, newId, parseData, parsePrice, serializeForExport } from "./store";
import type { AppData, Kind, Preset } from "./types";

const KIND_LABEL: Record<Kind, string> = { saved: "がまん", wasted: "むだづかい" };

function exportFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `gaman-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

const KINDS: Kind[] = ["saved", "wasted"];

export function SettingsView({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const updatePreset = (id: string, patch: Partial<Preset>) =>
    onChange({ ...data, presets: data.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePreset = (id: string) => onChange({ ...data, presets: data.presets.filter((p) => p.id !== id) });
  const addPreset = (kind: Kind) =>
    onChange({ ...data, presets: [...data.presets, { id: newId(), kind, emoji: "⭐", name: "新しいボタン", price: null }] });
  const resetPresets = (kind: Kind) =>
    onChange({
      ...data,
      presets: [...data.presets.filter((p) => p.kind !== kind), ...DEFAULT_PRESETS.filter((p) => p.kind === kind).map((p) => ({ ...p }))],
    });

  const exportData = async () => {
    const text = serializeForExport(data);
    const name = exportFileName();
    const file = new File([text], name, { type: "application/json" });
    // iPhone のホーム画面アプリではダウンロードが不安定なので、共有シート（「ファイルに保存」）を優先する
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        setMessage("書き出しました");
      } catch (e) {
        if ((e as DOMException).name !== "AbortError") setMessage("共有できませんでした。「コピー」を試してください");
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("書き出しました");
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(serializeForExport(data));
      setMessage("コピーしました。メモアプリなどに貼って保管してください");
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
    onChange(mergeData(data, pendingImport));
    setMessage(`${pendingImport.entries.length}件の記録を読み込みました`);
    setPendingImport(null);
  };

  return (
    <>
      <h2 className="section-title settings-title">設定</h2>
      {KINDS.map((kind) => (
        <section key={kind} className={`settings-block settings-block--${kind}`}>
          <h3>{KIND_LABEL[kind]}の定番ボタン</h3>
          <p className="settings-hint">金額を空にすると、押したときに毎回金額を聞きます。</p>
          <ul className="preset-edit">
            {data.presets
              .filter((p) => p.kind === kind)
              .map((p) => (
                <PresetRow key={p.id} preset={p} onUpdate={(patch) => updatePreset(p.id, patch)} onRemove={() => removePreset(p.id)} />
              ))}
          </ul>
          <div className="form-actions">
            <button type="button" className="button button--ghost" onClick={() => resetPresets(kind)}>
              最初の状態に戻す
            </button>
            <button type="button" className="button" onClick={() => addPreset(kind)}>
              ボタンを追加
            </button>
          </div>
        </section>
      ))}

      <section className="settings-block">
        <h3>データの保管と引っ越し</h3>
        <p className="settings-hint">
          記録はこの端末の中だけにあります（記録 {data.entries.length}件）。機種変更の前に書き出して、新しい端末で読み込んでください。
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

function PresetRow({ preset, onUpdate, onRemove }: { preset: Preset; onUpdate: (patch: Partial<Preset>) => void; onRemove: () => void }) {
  // 入力途中の値（空・書きかけ）を保てるよう、金額は文字列で持つ
  const [price, setPrice] = useState(preset.price === null ? "" : String(preset.price));
  const [invalid, setInvalid] = useState(false);
  // 「最初の状態に戻す」や読み込みで同じ id のまま金額が変わったら、入力欄も合わせる
  useEffect(() => {
    setPrice(preset.price === null ? "" : String(preset.price));
    setInvalid(false);
  }, [preset.price]);

  const commitPrice = () => {
    if (price.trim() === "") {
      setInvalid(false);
      onUpdate({ price: null });
      return;
    }
    const value = parsePrice(price);
    setInvalid(value === null);
    if (value !== null) onUpdate({ price: value });
  };

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
      <input
        className={`preset-edit-price${invalid ? " is-invalid" : ""}`}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={commitPrice}
        inputMode="numeric"
        placeholder="毎回聞く"
        aria-label="金額（円）"
        aria-invalid={invalid}
      />
      <button type="button" className="mini mini--danger" onClick={onRemove} aria-label={`${preset.name}を削除`}>
        ✕
      </button>
    </li>
  );
}
