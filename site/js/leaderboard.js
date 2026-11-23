// Ranking table for week / month / year / all-time.
import { esc, fmt, fold } from "./format.js";
import { beers, dateOfIdx, dayIdxOf, firstDay, lastDay, people, perPerson, todayIdx, weekOf, weekStart } from "./model.js";
import { ACH, achievements, level } from "./rules.js";
import { $, TOP, avatar, moreBtn, wireSeg } from "./ui.js";

let lbPeriod = "week", lbAll = false, query = "";

// rank of every count in a period: ties share a rank (1, 2, 2, 4…)
function rankOf(counts) {
  const sorted = counts.filter((n) => n > 0).sort((x, y) => y - x), first = new Map();
  sorted.forEach((n, k) => { if (!first.has(n)) first.set(n, k + 1); });
  return first;
}

function periodRange(p) {
  const t = dateOfIdx(todayIdx);
  if (p === "week") { const s = weekStart(weekOf(todayIdx)); return [s, s + 6, s - 7, s - 1]; }
  if (p === "month") {
    const s = dayIdxOf(new Date(t.getFullYear(), t.getMonth(), 1));
    const ps = dayIdxOf(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    return [s, todayIdx, ps, s - 1];
  }
  if (p === "year") {
    const s = dayIdxOf(new Date(t.getFullYear(), 0, 1));
    return [s, todayIdx, dayIdxOf(new Date(t.getFullYear() - 1, 0, 1)), s - 1];
  }
  return [firstDay, lastDay, null, null];
}
export function renderLeaderboard() {
  const [a, b, pa, pb] = periodRange(lbPeriod);
  const cur = perPerson(beers.filter((x) => x.day >= a && x.day <= b));
  const prev = pa === null ? null : perPerson(beers.filter((x) => x.day >= pa && x.day <= pb));
  const rows = people.map((p) => ({ p, n: cur[p.i] })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n);
  if (!rows.length) { $("leaderboard").innerHTML = `<div class="empty">W tym okresie jeszcze nikt nic nie wypił. Podejrzane.</div>`; return; }
  const rankNow = rankOf(cur), rankPrev = prev && rankOf(prev);
  const matches = query ? rows.filter((r) => fold(r.p.name).includes(query)) : rows;
  if (!matches.length) { $("leaderboard").innerHTML = `<div class="empty">Nikogo takiego w tym okresie.</div>`; return; }
  const medals = ["🥇", "🥈", "🥉"];
  const prevLabel = { week: "Zmiana vs poprz. tydz.", month: "Zmiana vs poprz. mies.", year: "Zmiana vs poprz. rok" }[lbPeriod];
  const shown = lbAll || query ? matches : matches.slice(0, TOP);
  $("leaderboard").innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Zawodnik</th><th class="r">Piwa</th>${prev ? `<th class="r hide-sm">${prevLabel}</th>` : ""}<th class="hide-sm">Odznaki</th></tr></thead><tbody>${shown.map((r) => {
    const rank = rankNow.get(r.n);
    const lv = level(r.p.total);
    const ach = ACH.filter((x) => achievements[r.p.i][x.id]).map((x) => x.ico).join("");
    let move = "";
    if (prev) {
      const pv = prev[r.p.i];
      const was = pv ? rankPrev.get(pv) : 0;
      const d = was - rank;
      const arrow = !pv ? `<span class="delta up">nowy</span>`
        : d > 0 ? `<span class="delta up">▲ ${d}</span>` : d < 0 ? `<span class="delta down">▼ ${-d}</span>` : `<span class="delta">–</span>`;
      move = `<td class="r hide-sm num">${arrow} <span class="sub">${pv ? `(#${was}, ${fmt(pv)})` : ""}</span></td>`;
    }
    return `<tr class="${rank <= 3 ? `top${rank}` : ""}"><td class="rank ${rank <= 3 ? "top" : ""}">${rank <= 3 ? medals[rank - 1] : rank}</td>
      <td><div class="who">${avatar(r.p)}<div style="min-width:0"><div class="name link" data-gal="p:${r.p.i}">${esc(r.p.name)}</div><div class="lvl">${lv.ico} Poz. ${lv.lvl} · ${lv.name}</div></div></div></td>
      <td class="r num"><b>${fmt(r.n)}</b></td>${move}
      <td class="badges-inline hide-sm">${ach}</td></tr>`;
  }).join("")}</tbody></table>${query ? "" : moreBtn(rows.length, lbAll, "lbMore")}`;
  if ($("lbMore")) $("lbMore").onclick = () => { lbAll = !lbAll; renderLeaderboard(); };
}

export function wireLeaderboard() {
  wireSeg("lbSeg", "p", (p) => { lbPeriod = p; renderLeaderboard(); });
  $("lbSearch").addEventListener("input", (e) => { query = fold(e.target.value.trim()); renderLeaderboard(); });
}
