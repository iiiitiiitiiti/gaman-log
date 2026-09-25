import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { MAX_PRICE, parsePrice } from "./store";
import type { Entry } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** datetime-local の値（端末の時刻で "YYYY-MM-DDTHH:mm"） */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" を端末の時刻として読む（ブラウザごとの解釈の差を避けて自前で分解する） */
function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** 記録した品名・金額・日時をあとから直す */
export function EntrySheet({ entry, onCancel, onSave }: { entry: Entry; onCancel: () => void; onSave: (entry: Entry) => void }) {
  const [emoji, setEmoji] = useState(entry.emoji);
  const [name, setName] = useState(entry.name);
  const [price, setPrice] = useState(String(entry.price));
  const [when, setWhen] = useState(toLocalInput(entry.createdAt));
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("品名を入れてください");
      return;
    }
    const value = parsePrice(price);
    if (value === null) {
      setError(`金額は1〜${MAX_PRICE.toLocaleString("ja-JP")}円の整数で入れてください`);
      return;
    }
    const createdAt = fromLocalInput(when);
    if (createdAt === null) {
      setError("日時を選んでください");
      return;
    }
    if (createdAt > Date.now()) {
      setError("未来の日時は選べません");
      return;
    }
    onSave({ ...entry, emoji, name: name.trim(), price: value, createdAt });
  };

  return (
    <Sheet title="記録を直す" onClose={onCancel} placement="center">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field-row">
          <label className="field field--emoji">
            <span>絵文字</span>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={16} />
          </label>
          <label className="field">
            <span>品名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
        </div>
        <label className="field">
          <span>金額（円）</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
        </label>
        <label className="field">
          <span>日時</span>
          <input type="datetime-local" value={when} max={toLocalInput(Date.now())} onChange={(e) => setWhen(e.target.value)} />
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
            保存する
          </button>
        </div>
      </form>
    </Sheet>
  );
}
