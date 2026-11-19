// Entry point: loads data.json, renders every section, wires theme and tooltips.
import { dateFmt, esc, fmt, timeFmt } from "./format.js";
import { D, beers, people, prepare, sum } from "./model.js";
import { computeRules } from "./rules.js";
import { $, calm } from "./ui.js";
import { renderHero } from "./hero.js";
import { renderLeaderboard, wireLeaderboard } from "./leaderboard.js";
import { renderDaily, renderRhythm, wireRange } from "./charts.js";
import { renderRecords } from "./records.js";
import { renderAchievements, renderLevels } from "./badges.js";
import { renderMilestones, renderRookies, renderWeeks } from "./community.js";
import { wireLightbox } from "./lightbox.js";

// ---- theme: auto / light / dark, remembered per browser
const THEMES = ["auto", "light", "dark"];
let theme = "auto";
try { theme = localStorage.getItem("beer-theme") || "auto"; } catch (e) { /* storage blocked */ }
function applyTheme() {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  $("themeBtn").textContent = "Motyw: " + { auto: "auto", light: "jasny", dark: "ciemny" }[theme];
}

// sections that read colours from CSS and must redraw when the theme changes
function renderThemed() { renderDaily(); renderRhythm(); renderLeaderboard(); renderHero(); renderAchievements(); }

function wireTooltips() {
  const tip = $("tip");
  let tipTimer = null;
  const showTip = (t, x, y) => {
    tip.textContent = t.dataset.tip;
    tip.style.opacity = 1;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, x + 12)) + "px";
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, y + 14) + "px";
  };
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { if (!tipTimer) tip.style.opacity = 0; return; }
    showTip(t, e.clientX, e.clientY);
  });
  document.addEventListener("click", (e) => {  // touch screens: tap a badge to see what it is for
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t || t.closest("[data-gal]")) return;
    showTip(t, e.clientX, e.clientY);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { tip.style.opacity = 0; tipTimer = null; }, 2500);
  });
}

function revealOnScroll() {
  if (calm || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".wrap > section").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
}

function renderHeader(data) {
  $("title").textContent = data.title || "Piwny licznik";
  document.title = data.title || "Piwny licznik";
  const upTo = new Date((data.last_message || Date.parse(data.generated_at) / 1000) * 1000);
  $("updated").textContent = `Dane do ${dateFmt.format(upTo)} ${timeFmt.format(upTo)} · ${fmt(data.messages_total)} wiadomości · ${people.length} zawodników`;
}

function renderFooter() {
  const bf = beers.filter((b) => b.k === "b");
  $("footer").innerHTML = `Piwo się liczy, gdy kolejny numer licznika ma zdjęcie od tej samej osoby (±3 min).
    „58,59”, „136 i 137”, „184-190” to kilka piw naraz. Ten sam numer od dwóch osób: obie dostają piwo.
    Dzień piwny zaczyna się o ${D.day_start_hour || 0}:00, więc piwo o 1:30 liczy się do poprzedniego wieczoru.
    ${bf.length ? `Pierwsze ${sum(bf)} piw to backfill z poprzedniej konfy (${dateFmt.format(new Date(bf[0].t * 1000))}).` : ""}`;
}

function init(data) {
  prepare(data);
  computeRules();
  renderHeader(data);
  revealOnScroll();
  renderThemed();
  renderRecords(); renderWeeks(); renderLevels(); renderMilestones(); renderRookies();
  renderFooter();
  wireLeaderboard(); wireRange(); wireLightbox(); wireTooltips();
}

applyTheme();
$("themeBtn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  try { localStorage.setItem("beer-theme", theme); } catch (e) { /* ignore */ }
  applyTheme();
  if (D) renderThemed();
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (D && theme === "auto") renderThemed(); });

fetch("data.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(init)
  .catch((err) => {
    console.error(err);
    document.querySelector(".wrap").insertAdjacentHTML("beforeend",
      `<div class="card empty">Nie udało się wczytać dashboardu (${esc(err.message)}). Odpal stronę przez serwer HTTP, nie z pliku.</div>`);
  });
