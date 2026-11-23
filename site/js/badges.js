// Badges (Steam-style: share of players, rarity, collectors) and the level ladder.
import { esc, fmt, fmt1, piw } from "./format.js";
import { people } from "./model.js";
import { ACH, LEVELS, achievements, level, lvTip } from "./rules.js";
import { $, avatar } from "./ui.js";

let showAllCollectors = false, showAllBadges = false, focus = null;  // focus: person whose badges are highlighted

// Steam-like rarity by the share of players who unlocked a badge
const RARITY = [[30, "common", "Pospolita"], [10, "rare", "Rzadka"], [3, "epic", "Epicka"], [0.01, "legendary", "Legendarna"]];
const rarityOf = (pct) => (RARITY.find(([min]) => pct >= min) || [0, "locked", "Nikt jeszcze"]);

export function renderAchievements() {
  const n = people.length;
  const stats = ACH.map((a) => {
    const holders = people.filter((p) => achievements[p.i][a.id]).sort((x, y) => achievements[y.i][a.id] - achievements[x.i][a.id] || y.total - x.total);
    return { a, holders, pct: (holders.length / n) * 100 };
  }).sort((x, y) => y.pct - x.pct);
  const fp = focus === null ? null : people[focus];

  const visible = showAllBadges || fp ? stats : stats.slice(0, 12);
  $("achievements").innerHTML = visible.map(({ a, holders, pct }) => {
    const [, cls, label] = rarityOf(pct);
    const mine = fp && achievements[fp.i][a.id];
    const stack = holders.slice(0, 5).map((p) => avatar(p, "sm")).join("");
    const names = esc(holders.map((p) => p.name + (achievements[p.i][a.id] > 1 ? ` ×${achievements[p.i][a.id]}` : "")).join(", "));
    return `<div class="ach ${cls} ${fp ? (mine ? "mine" : "dim") : ""}">
      <div class="ach-ico" aria-hidden="true">${a.ico}</div>
      <div class="ach-body">
        <div class="ach-name">${esc(a.name)}${mine ? ' <span class="ach-check">✓</span>' : ""}</div>
        <div class="ach-desc">${esc(a.desc)}</div>
        <div class="ach-bar"><i style="width:${Math.max(pct, holders.length ? 2 : 0)}%"></i></div>
      </div>
      <div class="ach-side">
        <div class="ach-pct">${holders.length ? `${fmt1(pct)}%` : "0%"}</div>
        <div class="ach-rar">${label}</div>
        ${holders.length ? `<div class="ach-stack" data-tip="${names}">${stack}${holders.length > 5 ? `<span class="ach-more">+${holders.length - 5}</span>` : ""}</div>` : ""}
      </div>
    </div>`;
  }).join("") + (fp || stats.length <= 12 ? "" : `<button class="more-btn ach-all" type="button" id="achAll">${showAllBadges ? "Pokaż mniej" : `Pokaż wszystkie odznaki (${stats.length})`}</button>`);
  if ($("achAll")) $("achAll").onclick = () => { showAllBadges = !showAllBadges; renderAchievements(); };

  const total = (p) => ACH.filter((a) => achievements[p.i][a.id]).length;
  const coll = [...people].sort((x, y) => total(y) - total(x) || y.total - x.total);
  const shown = showAllCollectors ? coll : coll.slice(0, 10);
  $("achKey").innerHTML = `<h3>Kolekcjonerzy</h3><div class="sub">Kliknij osobę, żeby zobaczyć jej odznaki</div>
    <div class="coll">${shown.map((p) => `<button type="button" class="coll-row ${focus === p.i ? "on" : ""}" data-p="${p.i}">
      ${avatar(p, "sm")}<span class="coll-name">${esc(p.name)}</span>
      <span class="coll-bar"><i style="width:${(total(p) / ACH.length) * 100}%"></i></span><span class="coll-n num">${total(p)}/${ACH.length}</span></button>`).join("")}</div>
    ${coll.length > 10 ? `<button class="more-btn" type="button" id="collMore">${showAllCollectors ? "Pokaż mniej" : `Pokaż wszystkich (${coll.length})`}</button>` : ""}
    ${fp ? `<button class="more-btn" type="button" id="collReset">Pokaż wszystkie odznaki</button>` : ""}`;
  $("achievementsSub").textContent = fp
    ? `${fp.name}: ${total(fp)} z ${ACH.length} odznak`
    : `${ACH.length} odznak · procent to część z ${n} zawodników, którzy ją mają`;
  $("achKey").querySelectorAll(".coll-row").forEach((el) => {
    el.onclick = () => { focus = focus === +el.dataset.p ? null : +el.dataset.p; renderAchievements(); };
  });
  if ($("collMore")) $("collMore").onclick = () => { showAllCollectors = !showAllCollectors; renderAchievements(); };
  if ($("collReset")) $("collReset").onclick = () => { focus = null; renderAchievements(); };
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
