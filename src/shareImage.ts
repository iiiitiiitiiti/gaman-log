import { pickEquivalent, yen } from "./equivalents";
import type { Equivalent } from "./types";

export interface BragInput {
  year: number;
  /** 0 始まり */
  month: number;
  saved: number;
  wasted: number;
  table: Equivalent[];
}

const W = 1080;
const H = 1350;
const INK = "#1b1f5e";
const DISPLAY = '"Dela Gothic One", "Hiragino Sans", sans-serif';
const BODY = '"M PLUS Rounded 1c", "Hiragino Sans", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** ずらし影つきのステッカー（がまん画面と同じ見た目） */
function sticker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, rotate = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  roundRect(ctx, 12, 12, w, h, r);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** 文字が幅に収まるまで小さくする */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, maxWidth: number): number {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (s > 20 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${s}px ${family}`;
  }
  return s;
}

/** 「○月に○円がまんした！」の自慢用画像（PNG）を作る */
export async function renderBragImage(input: BragInput): Promise<Blob> {
  const eq = pickEquivalent(input.saved, input.table);
  const diff = input.saved - input.wasted;
  const label = `${input.month + 1}月にがまんした`;
  const eqText = eq ? `${eq.name} ${eq.count}${eq.unit}ぶん浮いた！` : "";
  const line1 = `むだづかい ${yen(input.wasted)}`;
  const line2 = `差し引き ${diff >= 0 ? "+" : "−"}${yen(Math.abs(diff))}`;
  const footer = `がまんログ  ${input.year}.${input.month + 1}`;
  // 日本語の Web フォントは文字ごとに分けて配信されるので、描く文字をすべて指定して読み終えてから描く
  // （画面にまだ出ていない字は、指定しないと代わりの書体で描かれる）
  const allText = [label, input.saved.toLocaleString("ja-JP"), "円", eqText, line1, line2, footer].join("");
  await Promise.all([document.fonts.load(`80px ${DISPLAY}`, allText), document.fonts.load(`40px ${BODY}`, allText)]).catch(
    () => undefined,
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を作れませんでした");

  // 地: レモン色＋ドット＋後光
  ctx.fillStyle = "#ffe14d";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, 560);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 20; i++) {
    ctx.rotate(Math.PI / 10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-90, -1200);
    ctx.lineTo(90, -1200);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(27,31,94,0.13)";
  for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) ctx.fillRect(x, y, 5, 5);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 見出し
  sticker(ctx, W / 2 - 330, 120, 660, 130, 65, "#ff7ab6", -3);
  ctx.save();
  ctx.translate(W / 2, 185);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.fillStyle = "#fffdf2";
  fitFont(ctx, label, DISPLAY, 64, 580);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  // 金額（縁取り＋ずらし影）
  const amount = input.saved.toLocaleString("ja-JP");
  const size = fitFont(ctx, amount, DISPLAY, 260, 820);
  ctx.lineJoin = "round";
  ctx.fillStyle = INK;
  ctx.fillText(amount, W / 2 - 40 + 14, 470 + 14);
  ctx.lineWidth = 18;
  ctx.strokeStyle = INK;
  ctx.strokeText(amount, W / 2 - 40, 470);
  ctx.fillStyle = "#fffdf2";
  ctx.fillText(amount, W / 2 - 40, 470);
  ctx.font = `${Math.round(size * 0.4)}px ${DISPLAY}`;
  ctx.fillStyle = INK;
  const numberWidth = (() => {
    ctx.font = `${size}px ${DISPLAY}`;
    return ctx.measureText(amount).width;
  })();
  ctx.font = `${Math.round(size * 0.4)}px ${DISPLAY}`;
  ctx.fillText("円", W / 2 - 40 + numberWidth / 2 + 50, 520);

  // 換算
  if (eq) {
    const icons = eq.emoji.repeat(Math.min(eq.count, 8));
    ctx.font = `96px ${BODY}`;
    ctx.fillText(icons, W / 2, 720);
    const text = eqText;
    sticker(ctx, 110, 810, 860, 130, 30, "#fffdf2", 1.5);
    ctx.save();
    ctx.translate(W / 2, 875);
    ctx.rotate((1.5 * Math.PI) / 180);
    ctx.fillStyle = INK;
    fitFont(ctx, text, DISPLAY, 60, 780);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // むだづかいと収支
  sticker(ctx, 110, 1010, 860, 170, 30, "#2ee6a6", -1);
  ctx.save();
  ctx.translate(W / 2, 1095);
  ctx.rotate((-1 * Math.PI) / 180);
  ctx.fillStyle = INK;
  fitFont(ctx, line1, BODY, 48, 780);
  ctx.fillText(line1, 0, -36);
  fitFont(ctx, line2, DISPLAY, 60, 780);
  ctx.fillText(line2, 0, 38);
  ctx.restore();

  // 名前
  ctx.fillStyle = INK;
  ctx.font = `44px ${DISPLAY}`;
  ctx.fillText(`🐷 ${footer}`, W / 2, 1265);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像を作れませんでした"))), "image/png"),
  );
}

/** 共有シート（使えなければダウンロード）で画像を渡す。自分で閉じたときは false */
export async function shareOrDownload(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
