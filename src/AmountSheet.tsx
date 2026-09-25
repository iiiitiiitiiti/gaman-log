import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { MAX_PRICE, parsePrice } from "./store";
import type { Kind, Preset } from "./types";

export interface AmountRequest {
  kind: Kind;
  /** 値段なしの定番ボタンから来たとき。無ければ「そのほか」（品名も入力） */
  preset?: Preset;
}

export function AmountSheet({
  request,
  onCancel,
  onSubmit,
}: {
  request: AmountRequest;
  onCancel: () => void;
  onSubmit: (name: string, emoji: string, price: number) => void;
}) {
  const { preset, kind } = request;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const itemName = preset ? preset.name.trim() || "名前なし" : name.trim();
    if (!itemName) {
      setError("品名を入れてください");
      return;
    }
    const value = parsePrice(price);
    if (value === null) {
      setError(`金額は1〜${MAX_PRICE.toLocaleString("ja-JP")}円の整数で入れてください`);
      return;
    }
    onSubmit(itemName, preset ? preset.emoji : kind === "saved" ? "✨" : "💸", value);
  };

  const title = preset
    ? `${preset.emoji} ${preset.name}はいくら？`
    : kind === "saved"
      ? "なにをがまんした？"
      : "なにに使っちゃった？";

  return (
    <Sheet title={title} onClose={onCancel} placement="center">
      <form className="form" onSubmit={submit} noValidate>
        {!preset && (
          <label className="field">
            <span>品名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="例：新作のフラペチーノ" data-autofocus />
          </label>
        )}
        <label className="field">
          <span>金額（円）</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            placeholder="例：680"
            data-autofocus={preset ? "" : undefined}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button button--ghost" onClick={onCancel}>
            やめる
          </button>
          <button type="submit" className="button">
            記録する
          </button>
        </div>
      </form>
    </Sheet>
  );
}
