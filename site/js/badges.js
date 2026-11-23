// Badges (Steam-style: share of players, rarity, collectors) and the level ladder.
import { esc, fmt, fmt1, fold, piw } from "./format.js";
import { people } from "./model.js";
import { ACH, LEVELS, achievements, level, lvTip } from "./rules.js";
import { $, avatar, wireSeg } from "./ui.js";

let showAllCollectors = false, showAllBadges = false, focus = null, sortBy = "common", query = "";
let openBadge = null, openAll = false;  // badge expanded to list its holders

// Steam-like rarity by the share of players who unlocked a badge
const RARITY = [[30, "common", "Pospolita"], [10, "rare", "Rzadka"], [3, "epic", "Epicka"], [0.01, "legendary", "Legendarna"]];
const rarityOf = (pct) => (RARITY.find(([min]) => pct >= min) || [0, "locked", "Nikt jeszcze"]);
const badgeCount = (p) => ACH.reduce((n, a) => n + (achievements[p.i][a.id] ? 1 : 0), 0);
const MAX_HOLDERS = 60;  // an expanded badge lists this many holders before "show all"

export function renderAchievements() {
  renderBadgeGrid();
  renderCollectors();
}

function renderBadgeGrid() {
  const n = people.length, fp = focus === null ? null : people[focus];
  const stats = ACH.map((a) => {
    const holders = people.filter((p) => achievements[p.i][a.id])
      .sort((x, y) => achievements[y.i][a.id] - achievements[x.i][a.id] || y.total - x.total);
    return { a, holders, pct: (holders.length / n) * 100 };
  });
  // most common first, or rarest first; badges nobody has stay at the end either way
  stats.sort((x, y) => (!x.holders.length - !y.holders.length) || (sortBy === "rare" ? x.pct - y.pct : y.pct - x.pct));
  if (fp) stats.sort((x, y) => !achievements[fp.i][x.a.id] - !achievements[fp.i][y.a.id]);  // stable: theirs first

  const visible = showAllBadges || fp ? stats : stats.slice(0, 12);
  $("achievements").innerHTML = visible.map(({ a, holders, pct }) => {
    const [, cls, label] = rarityOf(pct);
    const mine = fp && achievements[fp.i][a.id];
    const stack = holders.slice(0, 5).map((p) => avatar(p, "sm")).join("");
    const open = openBadge === a.id;
    return `<div class="ach ${cls} ${fp ? (mine ? "mine" : "dim") : ""} ${open ? "open" : ""}" data-badge="${a.id}" role="button" tabindex="0" aria-expanded="${open}">
      <div class="ach-ico" aria-hidden="true">${a.ico}</div>
      <div class="ach-body">
        <div class="ach-name">${esc(a.name)}${mine ? ' <span class="ach-check">✓</span>' : ""}</div>
        <div class="ach-desc">${esc(a.desc)}</div>
        <div class="ach-bar"><i style="width:${Math.max(pct, holders.length ? 2 : 0)}%"></i></div>
      </div>
      <div class="ach-side">
        <div class="ach-pct">${holders.length ? `${fmt1(pct)}%` : "0%"}</div>
        <div class="ach-rar">${label}</div>
        ${holders.length ? `<div class="ach-stack">${stack}${holders.length > 5 ? `<span class="ach-more">+${holders.length - 5}</span>` : ""}</div>` : ""}
      </div>
      ${open ? holderList(a, holders) : ""}
    </div>`;
  }).join("") + (fp || stats.length <= 12 ? "" : `<button class="more-btn ach-all" type="button" id="achAll">${showAllBadges ? "Pokaż mniej" : `Pokaż wszystkie odznaki (${stats.length})`}</button>`);
  if ($("achAll")) $("achAll").onclick = () => { showAllBadges = !showAllBadges; renderBadgeGrid(); };
  $("achievementsSub").textContent = fp
    ? `${fp.name}: ${badgeCount(fp)} z ${ACH.length} odznak`
    : `${ACH.length} odznak · procent to część z ${n} zawodników, którzy ją mają`;
}

function holderList(a, holders) {
  if (!holders.length) return `<div class="ach-holders"><span class="sub">Jeszcze nikt. Bądź pierwszy.</span></div>`;
  const shown = openAll ? holders : holders.slice(0, MAX_HOLDERS);
  return `<div class="ach-holders">${shown.map((p) => {
    const times = achievements[p.i][a.id];
    return `<span class="holder">${avatar(p, "sm")}${esc(p.name)}${times > 1 ? ` <b>×${times}</b>` : ""}</span>`;
  }).join("")}${holders.length > MAX_HOLDERS ? `<button class="more-btn" type="button" data-all="1">${openAll ? "Pokaż mniej" : `Pokaż wszystkich (${holders.length})`}</button>` : ""}</div>`;
}

function renderCollectors() {
  const coll = [...people].sort((x, y) => badgeCount(y) - badgeCount(x) || y.total - x.total);
  const place = new Map(coll.map((p, k) => [p.i, k + 1]));
  const matches = query ? coll.filter((p) => fold(p.name).includes(query)) : coll;
  const shown = showAllCollectors ? matches : matches.slice(0, 10);
  $("collList").innerHTML = shown.length ? shown.map((p) => `<button type="button" class="coll-row ${focus === p.i ? "on" : ""}" data-p="${p.i}">
      <span class="coll-place num">${place.get(p.i)}.</span>${avatar(p, "sm")}<span class="coll-name">${esc(p.name)}</span>
      <span class="coll-bar"><i style="width:${(badgeCount(p) / ACH.length) * 100}%"></i></span><span class="coll-n num">${badgeCount(p)}/${ACH.length}</span></button>`).join("")
    : `<div class="empty">Nikogo takiego</div>`;
  $("collBtns").innerHTML = (matches.length > 10 ? `<button class="more-btn" type="button" id="collMore">${showAllCollectors ? "Pokaż mniej" : `Pokaż wszystkich (${matches.length})`}</button>` : "")
    + (focus !== null ? ` <button class="more-btn" type="button" id="collReset">Wszystkie odznaki</button>` : "");
  if ($("collMore")) $("collMore").onclick = () => { showAllCollectors = !showAllCollectors; renderCollectors(); };
  if ($("collReset")) $("collReset").onclick = () => pick(null);
}

function pick(i) {
  focus = focus === i ? null : i;
  renderAchievements();
}

export function wireBadges() {
  const toggle = (card) => { openBadge = openBadge === card.dataset.badge ? null : card.dataset.badge; openAll = false; renderBadgeGrid(); };
  $("achievements").addEventListener("click", (e) => {
    if (e.target.closest("[data-all]")) { openAll = !openAll; renderBadgeGrid(); return; }
    if (e.target.closest(".ach-holders")) return;  // clicks inside the list don't collapse it
    const card = e.target.closest(".ach[data-badge]");
    if (card) toggle(card);
  });
  $("achievements").addEventListener("keydown", (e) => {
    const card = e.target.closest(".ach[data-badge]");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(card); }
  });
  wireSeg("achSort", "s", (s) => { sortBy = s; renderBadgeGrid(); });
  $("collList").addEventListener("click", (e) => { const row = e.target.closest(".coll-row"); if (row) pick(+row.dataset.p); });
  $("collSearch").addEventListener("input", (e) => { query = fold(e.target.value.trim()); renderCollectors(); });
  $("collSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = $("collList").querySelector(".coll-row");
    if (first) { focus = null; pick(+first.dataset.p); }
  });
}

export function renderLevels() {
  const at = LEVELS.map(() => []);
  for (const p of people) at[level(p.total).k].push(p);
  const reached = at.filter((x) => x.length).length;
  $("levels").innerHTML = `<div class="lvl-ladder">${LEVELS.map(([need, nm, ico], k) => {
    const who = at[k].sort((a, b) => b.total - a.total);
    const chips = who.slice(0, 8).map((p) => `<span class="chip" data-tip="${lvTip(p)}">${esc(p.name)}</span>`).join("")
      + (who.length > 8 ? `<span class="chip more" data-tip="${esc(who.slice(8).map((p) => p.name).join(", "))}">+${who.length - 8}</span>` : "");
    return `<div class="lvl-row ${who.length ? "" : "empty-lvl"}"><span class="lvl-ico" aria-hidden="true">${ico}</span>
      <span class="lvl-n num">${k + 1}</span><span class="lvl-name">${nm}</span><span class="lvl-need num">od ${fmt(need)} ${need === 1 ? "piwa" : "piw"}</span>
      <span class="lvl-who">${chips || '<span class="sub">nikt jeszcze</span>'}</span></div>`;
  }).join("")}</div>`;
  $("levelsSub").textContent = `${LEVELS.length} poziomów za wszystkie zaliczone piwa (all-time, z backfillem). Zdobyte przez kogokolwiek: ${reached}.`;
  const close = people.filter((p) => level(p.total).next).map((p) => ({ p, miss: level(p.total).next[0] - p.total }))
    .sort((a, b) => a.miss - b.miss || b.p.total - a.p.total).slice(0, 6);
  $("levelUp").innerHTML = close.map(({ p, miss }) => {
    const lv = level(p.total), base = LEVELS[lv.k][0], pct = ((p.total - base) / (lv.next[0] - base)) * 100;
    return `<div class="up-row"><div class="up-top"><span class="who">${avatar(p, "sm")}<b>${esc(p.name)}</b></span><span class="sub">${lv.ico} ${lv.name} → ${lv.next[2]} ${lv.next[1]}</span></div>
      <div class="meter"><i style="width:${pct}%"></i></div><div class="sub">brakuje ${piw(miss)}</div></div>`;
  }).join("");
}
