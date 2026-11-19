// Badge table and the level ladder.
import { esc, fmt, piw } from "./format.js";
import { people } from "./model.js";
import { ACH, LEVELS, achTip, achievements, level, lvTip } from "./rules.js";
import { $, TOP, avatar, moreBtn } from "./ui.js";

let achAll = false;

export function renderAchievements() {
  const all = [...people].sort((a, b) => b.total - a.total);
  const order = achAll ? all : all.slice(0, TOP);
  $("achievements").innerHTML = `<table class="ach-table"><thead><tr><th>Zawodnik</th>${ACH.map((a) => `<th data-tip="${achTip(a)}" aria-label="${a.name}">${a.ico}</th>`).join("")}<th data-tip="Zdobyte odznaki">Σ</th></tr></thead><tbody>${order.map((p) => {
    const got = achievements[p.i];
    const n = ACH.filter((a) => got[a.id]).length;
    return `<tr><td><span class="who">${avatar(p, "sm")}${esc(p.name)}</span></td>${ACH.map((a) => got[a.id]
      ? `<td class="got" data-tip="${achTip(a, got[a.id])}">${a.ico}</td>`
      : `<td class="no" data-tip="${esc(a.name)}: jeszcze nie. ${esc(a.desc)}">${a.ico}</td>`).join("")}<td class="num"><b>${n}</b>/${ACH.length}</td></tr>`;
  }).join("")}</tbody></table>${moreBtn(all.length, achAll, "achMore")}`;
  if ($("achMore")) $("achMore").onclick = () => { achAll = !achAll; renderAchievements(); };
  $("achKey").innerHTML = ACH.map((a) => `<div>${a.ico} <b>${a.name}</b>: ${a.desc}</div>`).join("");
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
