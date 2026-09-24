import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/*
 * iOS Safari はタップで :active を当てないので、押した手応え（ボタンが沈む）を出すため
 * pointer イベントで data-pressed を付け外しし、CSS 側で :active と同じ見た目を当てる。
 */
let pressedElement: Element | null = null;

function releasePressedElement() {
  pressedElement?.removeAttribute("data-pressed");
  pressedElement = null;
}

document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    releasePressedElement();
    if (!target || target.disabled) return;
    pressedElement = target;
    target.setAttribute("data-pressed", "");
  },
  { passive: true },
);
for (const type of ["pointerup", "pointercancel", "pointerleave", "contextmenu"]) {
  document.addEventListener(type, releasePressedElement, { passive: true });
}
window.addEventListener("blur", releasePressedElement);

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
