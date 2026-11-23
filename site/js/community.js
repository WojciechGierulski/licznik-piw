// Milestones, rookies and the weekly winners list.
import { dateFmt, esc, fmt, fmt1, piw, plural, shortFmt } from "./format.js";
import { galleries } from "./lightbox.js";
import { beers, dateOfIdx, people, timed, todayIdx, weekOf, weekStart } from "./model.js";
import { achievements, weekWinners } from "./rules.js";
import { $, avatar } from "./ui.js";

export function renderMilestones() {
  const hits = beers.filter((b) => b.k !== "b" && b.k !== "c" && Math.floor(b.n / 100) > Math.floor((b.n - b.c) / 100));
  const rows = hits.map((b) => ({ b, m: Math.floor(b.n / 100) * 100 }));
  $("milestones2").innerHTML = rows.length ? rows.slice().reverse().map(({ b, m }, k, arr) => {
    const prev = arr[k + 1];
    const took = prev ? (b.t - prev.b.t) / 86400 : null;
    galleries["m" + m] = { title: `Piwo #${m}`, list: [b] };
    return `<div class="ms-row ${b.f.length ? "link" : ""}" ${b.f.length ? `data-gal="m${m}" role="button" tabindex="0"` : ""}>
      <span class="ms-n num">${fmt(m)}</span><span><b>${esc(people[b.p].name)}</b>${b.f.length ? " 📷" : ""}<br>
      <span class="sub">${dateFmt.format(new Date(b.t * 1000))}${took !== null ? ` · ${fmt1(took)} dni od ${fmt(prev.m)}` : ""}${b.r ? ` · ❤️ ${b.r}` : ""}</span></span></div>`;
  }).join("") : `<div class="empty">Pierwsza setka jeszcze przed nami.</div>`;
}

export function renderRookies() {
  const debut = new Map();
  for (const b of timed()) if (!debut.has(b.p)) debut.set(b.p, b);
  const weekStartIdx = weekStart(weekOf(todayIdx));
  const list = [...debut.values()].sort((a, b) => b.t - a.t);
  const thisWeek = list.filter((b) => b.day >= weekStartIdx).length;
  $("rookiesSub").textContent = `Pierwsze zaliczone piwo każdego zawodnika. W tym tygodniu ${thisWeek} ${plural(thisWeek, "nowy", "nowych", "nowych")}.`;
  galleries.rookies = { title: "Debiuty", list: list.filter((b) => b.f.length) };
  $("rookies").innerHTML = list.slice(0, 12).map((b) => `<div class="row link" data-gal="b:${b.id}">
    <span class="w">${shortFmt.format(dateOfIdx(b.day))}</span><span class="who">${avatar(people[b.p], "sm")}${esc(people[b.p].name)}${achievements[b.p].dragon ? ' <span data-tip="Wejście smoka: piwo w godzinę od dołączenia">🐉</span>' : ""}</span>
    <span class="num sub">#${b.n}</span></div>`).join("")
    + (list.length > 12 ? `<button class="more-btn" type="button" data-gal="rookies">Wszystkie debiuty (${list.length}) 📷</button>` : "");
}

export function renderWeeks() {
  const rows = weekWinners.slice(-10).reverse();
  $("weeks").innerHTML = rows.map((w) => `<div class="row"><span class="w">${shortFmt.format(dateOfIdx(weekStart(w.week)))}${w.done ? "" : " (trwa)"}</span>
    <span class="who">${w.done ? "👑" : "⏳"} ${w.winners.map((i) => avatar(people[i], "sm") + esc(people[i].name)).join(", ")}</span><span class="num sub">${piw(w.max)}</span></div>`).join("");
}
