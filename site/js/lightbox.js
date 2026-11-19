// Photo galleries opened from records, names and the feed.
import { dateFmt, esc, timeFmt } from "./format.js";
import { beers, people, timed } from "./model.js";
import { $ } from "./ui.js";

export const galleries = {};
const mediaUrl = (f) => "media/" + encodeURIComponent(f);
const isVideo = (f) => /\.(mp4|mov|webm)$/i.test(f);
const thumb = (f, alt) => isVideo(f)
  ? `<video src="${mediaUrl(f)}#t=0.1" muted playsinline preload="metadata" aria-label="${alt}"></video>`
  : `<img src="${mediaUrl(f)}" alt="${alt}" loading="lazy">`;
const caption = (b) => `#${b.n}${b.c > 1 ? ` (×${b.c})` : ""} · ${esc(people[b.p].name)} · ${dateFmt.format(new Date(b.t * 1000))} ${timeFmt.format(new Date(b.t * 1000))}${b.r ? ` · ❤️ ${b.r}` : ""}`;

let lbItems = [], lbAt = 0;
function galleryFor(key) {
  if (galleries[key]) return galleries[key];
  const [kind, v] = key.split(":");
  if (kind === "p") return { title: `Piwa: ${people[+v].name}`, list: timed().filter((b) => b.p === +v).reverse() };
  if (kind === "b") return { title: `Piwo #${beers[+v].n}`, list: [beers[+v]] };
  return null;
}
function openGallery(key, at) {
  const g = galleryFor(key);
  if (!g) return;
  lbItems = g.list.flatMap((b) => b.f.map((f) => ({ f, b })));
  if (!lbItems.length) return;
  lbAt = Math.min(at || 0, lbItems.length - 1);
  $("lbTitle").textContent = g.title;
  $("lbThumbs").innerHTML = lbItems.map((it, k) => `<button type="button" data-k="${k}" aria-label="Zdjęcie ${k + 1}">${thumb(it.f, "")}</button>`).join("");
  $("lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  showLb();
}
function showLb() {
  const it = lbItems[lbAt];
  $("lbMedia").innerHTML = isVideo(it.f)
    ? `<video src="${mediaUrl(it.f)}" controls autoplay playsinline></video>`
    : `<img src="${mediaUrl(it.f)}" alt="Piwo #${it.b.n}">`;
  $("lbCap").innerHTML = caption(it.b) + (lbItems.length > 1 ? ` <span class="sub">· ${lbAt + 1}/${lbItems.length}</span>` : "");
  $("lbPrev").disabled = lbAt === 0; $("lbNext").disabled = lbAt === lbItems.length - 1;
  $("lbPrev").hidden = $("lbNext").hidden = lbItems.length < 2;
  $("lbThumbs").hidden = lbItems.length < 2;
  $("lbThumbs").querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === lbAt));
  const cur = $("lbThumbs").children[lbAt]; if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });
}
function closeLb() { $("lightbox").hidden = true; $("lbMedia").innerHTML = ""; document.body.style.overflow = ""; }
export function wireLightbox() {
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-gal]");
    if (g && !e.target.closest("#lightbox")) { openGallery(g.dataset.gal, +(g.dataset.at || 0)); return; }
  });
  document.addEventListener("keydown", (e) => {
    if ($("lightbox").hidden) {
      const g = e.target.closest && e.target.closest("[data-gal]");
      if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openGallery(g.dataset.gal); }
      return;
    }
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft" && lbAt > 0) { lbAt--; showLb(); }
    if (e.key === "ArrowRight" && lbAt < lbItems.length - 1) { lbAt++; showLb(); }
  });
  $("lbClose").onclick = closeLb;
  $("lightbox").onclick = (e) => { if (e.target.id === "lightbox") closeLb(); };
  $("lbPrev").onclick = () => { if (lbAt > 0) { lbAt--; showLb(); } };
  $("lbNext").onclick = () => { if (lbAt < lbItems.length - 1) { lbAt++; showLb(); } };
  $("lbThumbs").onclick = (e) => { const b = e.target.closest("button"); if (b) { lbAt = +b.dataset.k; showLb(); } };
  let x0 = null;
  $("lbMedia").addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  $("lbMedia").addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -40 && lbAt < lbItems.length - 1) { lbAt++; showLb(); }
    if (dx > 40 && lbAt > 0) { lbAt--; showLb(); }
  });
}
