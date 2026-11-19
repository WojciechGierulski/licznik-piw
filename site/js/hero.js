// Banner with the counter, the pint and the tiles; feed of the last day.
import { dateFmt, dni, esc, fmt, fmt1, piw, shortFmt, timeFmt } from "./format.js";
import { D, beers, byDay, dateOfIdx, people, sum, timed, todayIdx, weekOf, weekStart } from "./model.js";
import { $, avatar, countUp } from "./ui.js";

export function renderHero() {
  const counter = D.counter;
  if (!$("counter").dataset.done) { countUp($("counter"), counter); $("counter").dataset.done = 1; }
  const next100 = Math.floor(counter / 100) * 100 + 100, fill = (counter % 100) / 100;
  // the foam crest sits exactly at the liquid level
  requestAnimationFrame(() => { $("beer").style.transform = `translateY(${156 - 148 * fill}px)`; });
  $("glassLabel").innerHTML = `kufel do <b>#${fmt(next100)}</b><br>pełny w ${Math.round(fill * 100)}%`;
  const live = timed();
  const firstLive = live.length ? live[0].day : todayIdx;
  const span = Math.max(1, Math.min(30, todayIdx - firstLive + 1));
  const rate = sum(live.filter((b) => b.day > todayIdx - span && b.day <= todayIdx)) / span;
  const stepTargets = [Math.ceil((counter + 1) / 100) * 100];
  const big = Math.ceil((counter + 1) / 1000) * 1000;
  if (big !== stepTargets[0]) stepTargets.push(big);
  $("milestones").innerHTML = stepTargets.map((target, k) => {
    const base = k === 0 ? target - 100 : target - 1000;
    const pct = Math.max(0, Math.min(100, ((counter - base) / (target - base)) * 100));
    const left = target - counter;
    const eta = rate > 0 ? shortFmt.format(dateOfIdx(todayIdx + Math.ceil(left / rate))) : "?";
    return `<div><div class="meter" role="meter" aria-valuemin="${base}" aria-valuemax="${target}" aria-valuenow="${counter}" aria-label="Do ${target}"><i style="width:${pct}%"></i></div>
      <div class="meter-row"><span>Do <b>${fmt(target)}</b> brakuje ${piw(left)}</span><span>prognoza: ${eta}</span></div></div>`;
  }).join("");

  const thisW = weekOf(todayIdx);
  const dayInWeek = todayIdx - weekStart(thisW);
  const wNow = sum(beers.filter((b) => b.week === thisW));
  const wPrevSame = sum(beers.filter((b) => b.week === thisW - 1 && b.day - weekStart(thisW - 1) <= dayInWeek));
  const today = sum(beers.filter((b) => b.day === todayIdx));
  const yesterday = sum(beers.filter((b) => b.day === todayIdx - 1));
  const groupDays = [...byDay.keys()].sort((a, b) => a - b);
  const bestDay = groupDays.reduce((best, d) => (byDay.get(d) > (byDay.get(best) || 0) ? d : best), groupDays[0]);
  const prev30 = sum(beers.filter((b) => b.day > todayIdx - 60 && b.day <= todayIdx - 30)) / 30;
  const delta = (a, b, unit) => {
    const d = a - b;
    if (!b && !a) return `<span class="delta">bez zmian</span>`;
    const cls = d > 0 ? "up" : d < 0 ? "down" : "";
    return `<span class="delta ${cls}">${d > 0 ? "▲ +" : d < 0 ? "▼ " : ""}${unit(d)}</span>`;
  };
  const tiles = [
    ["📍", `Ostatni dzień (${shortFmt.format(dateOfIdx(todayIdx))})`, fmt(today), delta(today, yesterday, (d) => `${fmt(d)} vs dzień wcześniej`)],
    ["📆", "Ten tydzień", fmt(wNow), delta(wNow, wPrevSame, (d) => `${fmt(d)} vs ten moment tyg. temu`)],
    ["⚡", span < 30 ? `Średnio dziennie (${dni(span)})` : "Średnio dziennie (30 dni)", fmt1(rate),
      span < 30 ? `<span class="delta">${people.length} zawodników</span>` : delta(rate, prev30, (d) => `${fmt1(d)} vs poprzednie 30 dni`)],
    ["🏆", "Rekord dnia grupy", fmt(byDay.get(bestDay)), `<span class="delta">${dateFmt.format(dateOfIdx(bestDay))}</span>`],
  ];
  const last14 = Array.from({ length: 14 }, (_, k) => byDay.get(todayIdx - 13 + k) || 0);
  tiles[2].push(sparkline(last14));
  $("tiles").innerHTML = tiles.map(([ico, l, v, d, extra = ""]) => `<div class="tile"><span class="t-ico" aria-hidden="true">${ico}</span><div class="label">${l}</div><div class="value">${v}</div>${d}${extra}</div>`).join("");

  const todays = beers.filter((b) => b.day === todayIdx).slice(-8).reverse();
  $("todayTitle").textContent = `Ostatni dzień w danych · ${shortFmt.format(dateOfIdx(todayIdx))}`;
  $("todaySub").textContent = todays.length ? piw(today) : "";
  $("todayFeed").innerHTML = todays.length
    ? todays.map((b) => `<div class="row link" data-gal="b:${beers.indexOf(b)}"><span class="t num">${timeFmt.format(new Date(b.t * 1000))}</span>${avatar(people[b.p], "sm")}<span>${esc(people[b.p].name)}${b.c > 1 ? ` <span class="sub">×${b.c}</span>` : ""}</span><span class="n num">#${b.n}</span></div>`).join("")
    : `<div class="empty">Tego dnia jeszcze nic. Kto otwiera?</div>`;
}

// tiny bar chart of the last days; the last bar is the most recent day
function sparkline(vals) {
  const max = Math.max(1, ...vals), w = 6, gap = 3, h = 30;
  const bars = vals.map((v, k) => {
    const bh = Math.max(2, (v / max) * h);
    return `<rect x="${k * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="2" class="${k === vals.length - 1 ? "now" : ""}"><title>${v}</title></rect>`;
  }).join("");
  return `<svg class="spark" viewBox="0 0 ${vals.length * (w + gap) - gap} ${h}" role="img" aria-label="Piwa dziennie, ostatnie ${vals.length} dni">${bars}</svg>`;
}
