import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** 実際に見えている範囲（iPhone ではキーボードを除いた部分） */
interface VisibleBox {
  top: number;
  height: number;
}

function visibleBox(): VisibleBox | null {
  const vv = window.visualViewport;
  return vv ? { top: vv.offsetTop, height: vv.height } : null;
}

/**
 * 入力パネル。placement="bottom" は下からせり上がり、"center" は画面中央に出るモーダル。背景タップと Esc で閉じる。
 *
 * iPhone はキーボードが出ても画面（レイアウト）の高さを縮めないので、画面の下端に置くとパネルがキーボードの裏に隠れる。
 * このアプリは画面全体を固定しているため、隠れた入力欄を iPhone が自動で見える位置へ動かすこともできない。
 * そこで背景を visualViewport（実際に見えている範囲）に合わせ、パネルがキーボードのすぐ上に来るようにする。
 */
export function Sheet({
  title,
  onClose,
  children,
  placement = "bottom",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  placement?: "bottom" | "center";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<VisibleBox | null>(visibleBox);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox(visibleBox());
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      // 入力中に iPhone が画面をずらしていたら、閉じたときに元へ戻す
      window.scrollTo(0, 0);
    };
  }, []);

  // 最初の入力欄へカーソルを合わせる。iPhone が画面を勝手に動かさないよう preventScroll を付ける
  // （タップの処理中に同期で呼ぶので、キーボードも開く）
  useLayoutEffect(() => {
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className={`sheet-backdrop sheet-backdrop--${placement}`}
      style={box ? { top: box.top, height: box.height, bottom: "auto" } : undefined}
      onClick={onClose}
    >
      <div ref={panel} className={`sheet sheet--${placement}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
