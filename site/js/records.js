// Hall of fame tiles.
import { dateFmt, dni, esc, piw, timeFmt } from "./format.js";
import { galleries } from "./lightbox.js";
import { beers, byDay, dateOfIdx, daysByPerson, leaders, people, perPerson, perPersonCount, streaks, timed, weekStart } from "./model.js";
import { weekWinners } from "./rules.js";
import { $ } from "./ui.js";

export function renderRecords() {
  const recs = [];
  const name = (i) => esc(people[i].name);
  // best person-day
  const pd = new Map();
  for (const b of beers) { const key = b.p + ":" + b.day; pd.set(key, (pd.get(key) || 0) + b.c); }
  const pdMax = Math.max(...pd.values());
  const pdTop = [...pd].filter(([, n]) => n === pdMax).map(([k]) => k.split(":").map(Number));
  recs.push(["🏆", "Rekord dnia (osoba)", piw(pdMax), pdTop.map(([p]) => name(p)).join(", "),
    [...new Set(pdTop.map(([, d]) => dateFmt.format(dateOfIdx(d))))].join(", "),
    beers.filter((b) => pdTop.some(([p, d]) => b.p === p && b.day === d))]);
  // best person-week
  let bw = null;
  for (const w of weekWinners) if (!bw || w.max > bw.max) bw = w;
  recs.push(["📆", "Rekord tygodnia (osoba)", piw(bw.max), bw.winners.map(name).join(", "), `tydzień od ${dateFmt.format(dateOfIdx(weekStart(bw.week)))}`,
    beers.filter((b) => bw.winners.includes(b.p) && b.week === bw.week)]);
  // group week
  let gw = weekWinners.reduce((a, w) => (w.total > a.total ? w : a), weekWinners[0]);
  recs.push(["🍻", "Najlepszy tydzień grupy", piw(gw.total), "", `od ${dateFmt.format(dateOfIdx(weekStart(gw.week)))}`,
    beers.filter((b) => b.week === gw.week)]);
  // streaks
  const runs = daysByPerson().map(streaks);
  const bestLen = leaders(runs.map((s) => s.best.len));
  const curLen = leaders(runs.map((s) => s.current));
  if (bestLen.length) {
    const len = runs[bestLen[0]].best.len;
    recs.push(["🔥", "Najdłuższa seria", dni(len) + " z rzędu", bestLen.map(name).join(", "),
      bestLen.length === 1 ? `zakończona ${dateFmt.format(dateOfIdx(runs[bestLen[0]].best.end))}` : "",
      timed().filter((b) => bestLen.some((i) => b.p === i && b.day > runs[i].best.end - len && b.day <= runs[i].best.end))]);
  }
  if (curLen.length && runs[curLen[0]].current > 1) recs.push(["⏳", "Aktualna seria", dni(runs[curLen[0]].current), curLen.map(name).join(", "), "trwa"]);
  // fastest double
  let fast = null;
  const lastBy = new Map();
  for (const b of timed()) {
    const prev = lastBy.get(b.p);
    if (prev && b.t - prev.t >= 60 && (!fast || b.t - prev.t < fast.gap)) fast = { gap: b.t - prev.t, p: b.p, t: b.t, pair: [prev, b] };
    lastBy.set(b.p, b);
  }
  if (fast) recs.push(["⚡", "Najszybszy dublet", `${Math.round(fast.gap / 60)} min`, name(fast.p), dateFmt.format(new Date(fast.t * 1000)), fast.pair]);
  // crowns
  const crowns = perPersonCount(weekWinners.filter((w) => w.done).flatMap((w) => w.winners));
  const cr = leaders(crowns);
  if (cr.length) recs.push(["👑", "Najczęściej menel tygodnia", `${crowns[cr[0]]}×`, cr.map(name).join(", "), "pełne tygodnie"]);
  // jubilees
  const jub = beers.filter((b) => b.n % 100 === 0 && b.k !== "c");
  const jc = perPersonCount(jub.map((b) => b.p));
  const jb = leaders(jc);
  const jubOf = jub.filter((b) => jb.includes(b.p));
  if (jb.length) recs.push(["🎯", "Łowca jubileuszy", `${jc[jb[0]]}× okrągły numer`, [...new Set(jubOf.map((b) => b.p))].map(name).join(", "),
    jubOf.map((b) => `#${b.n}`).slice(-6).join(", "), jubOf]);
  // night owl
  const night = perPerson(timed().filter((b) => b.hour >= 0 && b.hour < 6));
  const nb = leaders(night);
  if (nb.length) recs.push(["🦉", "Najwięcej po północy", piw(night[nb[0]]), nb.map(name).join(", "), "00:00–05:59",
    timed().filter((b) => nb.includes(b.p) && b.hour < 6)]);
  // drought
  const days = [...byDay.keys()].sort((a, b) => a - b);
  let dry = { len: 0 };
  for (let k = 1; k < days.length; k++) if (days[k] - days[k - 1] - 1 > dry.len) dry = { len: days[k] - days[k - 1] - 1, from: days[k - 1] + 1 };
  if (dry.len) recs.push(["🏜️", "Najdłuższa susza grupy", dni(dry.len), "", `od ${dateFmt.format(dateOfIdx(dry.from))}`]);
  // the very first
  const liked = timed().reduce((a, b) => (b.r > (a ? a.r : 0) ? b : a), null);
  if (liked) recs.push(["❤️", "Najbardziej lubiane piwo", `${liked.r} reakcji`, name(liked.p), `#${liked.n} · ${dateFmt.format(new Date(liked.t * 1000))}`,
    timed().filter((b) => b.r > 0).sort((x, y) => y.r - x.r).slice(0, 20), "Najbardziej lubiane piwa"]);
  const fans = perPersonCount([]);
  for (const b of timed()) fans[b.p] += b.r;
  const fbs = leaders(fans), fb = fbs[0];
  if (fbs.length) recs.push(["📣", "Ulubieniec publiczności", `${fans[fb]} reakcji łącznie`, fbs.map(name).join(", "), "na wszystkich piwach",
    timed().filter((b) => fbs.includes(b.p)).sort((x, y) => y.r - x.r)]);
  const big = timed().filter((b) => b.k === "s").reduce((a, b) => (b.c > (a ? a.c : 1) ? b : a), null);
  if (big) recs.push(["🍻", "Największy hurt", `${piw(big.c)} w jednym poście`, name(big.p), `do #${big.n} · ${dateFmt.format(new Date(big.t * 1000))}`,
    timed().filter((b) => b.k === "s" && b.c >= 2).sort((x, y) => y.c - x.c), "Hurtowe posty"]);
  // peak hour: most beers in any 60-minute window
  const tb = timed();
  let peak = { n: 0 }, lo = 0, inWin = 0;
  for (let hi = 0; hi < tb.length; hi++) {
    inWin += tb[hi].c;
    while (tb[hi].t - tb[lo].t > 3600) inWin -= tb[lo++].c;
    if (inWin > peak.n) peak = { n: inWin, from: lo, to: hi };
  }
  if (peak.n) {
    const pk = tb.slice(peak.from, peak.to + 1);
    recs.push(["⏱️", "Godzina szczytu", `${piw(peak.n)} w godzinę`, `${new Set(pk.map((b) => b.p)).size} osób`,
      `${dateFmt.format(new Date(pk[0].t * 1000))} ${timeFmt.format(new Date(pk[0].t * 1000))}–${timeFmt.format(new Date(pk[pk.length - 1].t * 1000))}`, pk]);
  }
  const first = timed()[0];
  recs.push(["🥇", "Pacjent zero", `#${first.n}`, name(first.p), dateFmt.format(new Date(first.t * 1000)), [first]]);

  $("records").innerHTML = recs.map(([ico, ttl, val, who, when, list, galTitle], k) => {
    const withPhotos = (list || []).filter((b) => b.f.length);
    if (withPhotos.length) galleries["r" + k] = { title: galTitle || `${ttl}: ${who.replace(/&amp;/g, "&")}`, list: withPhotos };
    return `<div class="record ${withPhotos.length ? "link" : ""}" ${withPhotos.length ? `data-gal="r${k}" role="button" tabindex="0"` : ""}>
      <div class="ico" aria-hidden="true">${ico}</div><div class="ttl">${ttl}</div><div class="val">${val}</div>${who ? `<div class="who2">${who}</div>` : ""}
      <div class="when">${when}${withPhotos.length ? ` <span class="cam">📷 ${withPhotos.reduce((a, b) => a + b.f.length, 0)}</span>` : ""}</div></div>`;
  }).join("");
}
