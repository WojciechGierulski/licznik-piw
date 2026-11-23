// Small DOM helpers shared by every section.
import { esc, fmt } from "./format.js";

export const $ = (id) => document.getElementById(id);
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const color = (p) => css(p.slot ? `--s${p.slot}` : "--other");
const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
export const avatar = (p, size = "") => `<span class="av ${size}" style="--c:${color(p)}" aria-hidden="true">${esc(initials(p.name))}</span>`;
export const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function countUp(el, to) {
  if (calm) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 800;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const TOP = 15;
export const moreBtn = (n, open, id) => n > TOP ? `<button class="more-btn" id="${id}" type="button">${open ? "Pokaż mniej" : `Pokaż wszystkich (${n})`}</button>` : "";

export function wireSeg(id, attr, onPick) {
  $(id).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    for (const b of $(id).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === btn));
    onPick(btn.dataset[attr]);
  });
}
