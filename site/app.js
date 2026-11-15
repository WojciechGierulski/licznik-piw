/* Beer counter dashboard. Reads data.json produced by parse_export.py. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("pl-PL");
  const fmt1 = (n) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (n === 1) return one;
    return b >= 2 && b <= 4 && (a < 12 || a > 14) ? few : many;
  };
  const piw = (n) => `${fmt(n)} ${plural(n, "piwo", "piwa", "piw")}`;
  const dni = (n) => `${fmt(n)} ${plural(n, "dzień", "dni", "dni")}`;
  const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
  const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
  const shortFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });

  // ---------------------------------------------------------------- theme
  const THEMES = ["auto", "light", "dark"];
  let theme = "auto";
  try { theme = localStorage.getItem("beer-theme") || "auto"; } catch (e) { /* storage blocked */ }
  const applyTheme = () => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    $("themeBtn").textContent = "Motyw: " + { auto: "auto", light: "jasny", dark: "ciemny" }[theme];
  };
  applyTheme();

  // ---------------------------------------------------------------- data model
  let D, people, beers, byDay, firstDay, lastDay, todayIdx;
  const dayIdxOf = (date) => Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
  const dateOfIdx = (i) => { const d = new Date(i * 864e5); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const weekOf = (dayIdx) => Math.floor((dayIdx + 3) / 7); // Monday-based (1970-01-01 was a Thursday)
  const weekStart = (w) => w * 7 - 3;

  function prepare(data) {
    D = data;
    const ds = (data.day_start_hour || 0) * 3600;
    people = data.people.map((name, i) => ({ i, name, total: 0 }));
    beers = data.beers.map(([t, p, n, c, k, r, f]) => {
      const local = new Date(t * 1000);
      const day = dayIdxOf(new Date((t - ds) * 1000));
      people[p].total += c;
      return { t, p, n, c, k, r: r || 0, f: f || [], timed: k !== "b", day, week: weekOf(day), hour: local.getHours(), dow: (dateOfIdx(day).getDay() + 6) % 7 };
    }).sort((a, b) => a.t - b.t);
    // colours follow the person (all-time rank), never the current filter
    const order = [...people].sort((a, b) => b.total - a.total);
    order.forEach((p, r) => { p.slot = r < 8 ? r + 1 : 0; p.rank = r; });
    byDay = new Map();
    for (const b of beers) byDay.set(b.day, (byDay.get(b.day) || 0) + b.c);
    firstDay = beers[0].day;
    // "now" is the moment of the last exported message, not the viewer's clock:
    // forecasts, "today" and "this week" describe the state of the data
    const nowT = data.last_message || beers[beers.length - 1].t;
    todayIdx = dayIdxOf(new Date((nowT - ds) * 1000));
    lastDay = Math.max(todayIdx, beers[beers.length - 1].day);
  }
  const color = (p) => css(p.slot ? `--s${p.slot}` : "--other");
  const timed = () => beers.filter((b) => b.timed);
  const sum = (arr) => arr.reduce((s, b) => s + b.c, 0);
  const perPerson = (arr) => {
    const m = new Array(people.length).fill(0);
    for (const b of arr) m[b.p] += b.c;
    return m;
  };

  // ---------------------------------------------------------------- levels & achievements
  // [beers needed (all-time), name, icon]
  const LEVELS = [
    [0, "Świeżak", "🥚"], [1, "Pierwszy łyk", "💧"], [3, "Piwny żółtodziób", "🐣"], [5, "Amator pianki", "🫧"],
    [8, "Kapslowy kadet", "🧢"], [12, "Bywalec", "🪑"], [16, "Degustator", "👃"], [20, "Stały klient", "🧾"],
    [25, "Kumpel barmana", "🤝"], [30, "Piwny weteran", "🎖️"], [40, "Koneser chmielu", "🌿"], [50, "Mistrz kufla", "🍺"],
    [60, "Baron browaru", "🎩"], [75, "Hrabia chmielu", "🏰"], [90, "Książę pianki", "🤴"], [100, "Setnik", "💯"],
    [125, "Legenda baru", "📜"], [150, "Piwny mędrzec", "🧙"], [175, "Strażnik kranu", "🛡️"], [200, "Arcymistrz kufla", "🏆"],
    [250, "Wielki Piwowar", "⚗️"], [300, "Król Browarów", "👑"], [400, "Cesarz Chmielu", "🏛️"], [500, "Półbóg pianki", "⚡"],
    [750, "Arcykapłan chmielu", "🔮"], [1000, "Bóg chmielu", "🌟"],
  ];
  const level = (n) => {
    let k = 0;
    while (k + 1 < LEVELS.length && n >= LEVELS[k + 1][0]) k++;
    return { lvl: k + 1, k, name: LEVELS[k][1], ico: LEVELS[k][2], next: LEVELS[k + 1] };
  };

  const ACH = [
    { id: "jubilat", ico: "🎯", name: "Jubilat", desc: "Wbił okrągły numer licznika (wielokrotność 100)" },
    { id: "lucky", ico: "🍀", name: "Szczęśliwy numer", desc: "Wbił numer z samych tych samych cyfr (111, 777…)" },
    { id: "hat", ico: "🎩", name: "Hat-trick", desc: "3 piwa jednego dnia" },
    { id: "five", ico: "🖐️", name: "Piątka", desc: "5 piw jednego dnia" },
    { id: "owl", ico: "🦉", name: "Nocny marek", desc: "Piwo między 2:00 a 5:59" },
    { id: "early", ico: "🌅", name: "Ranny ptaszek", desc: "Piwo przed 11:00" },
    { id: "flash", ico: "⚡", name: "Błyskawica", desc: "Dwa piwa w odstępie do 15 minut" },
    { id: "streak", ico: "🔥", name: "Seria", desc: "Piwo 3 dni z rzędu" },
    { id: "multi", ico: "🍻", name: "Hurtownik", desc: "3 lub więcej piw w jednym poście (np. „181 182 183”)" },
    { id: "star", ico: "⭐", name: "Gwiazda", desc: "Piwo z co najmniej 5 reakcjami" },
    { id: "weekend", ico: "🎉", name: "Weekendowy wojownik", desc: "Piwo w piątek, sobotę i niedzielę tego samego weekendu" },
    { id: "king", ico: "👑", name: "Piwosz tygodnia", desc: "Wygrał przynajmniej jeden pełny tydzień" },
    { id: "century", ico: "💯", name: "Setka", desc: "100 piw łącznie" },
    { id: "clash", ico: "🤝", name: "Kolizja", desc: "Wrzucił ten sam numer co ktoś inny" },
    { id: "comeback", ico: "🐫", name: "Powrót", desc: "Wrócił po co najmniej 7 dniach przerwy" },
    { id: "newyear", ico: "🎆", name: "Otwieracz roku", desc: "Pierwsze piwo w nowym roku w grupie" },
  ];

  const achTip = (a, n) => esc(`${a.ico} ${a.name}: ${a.desc}${n > 1 ? ` (zdobyte ×${n})` : ""}`);
  const lvTip = (p) => {
    const lv = level(p.total);
    return esc(lv.next ? `${p.total} piw. Do poz. ${lv.lvl + 1} „${lv.next[1]}” brakuje ${piw(lv.next[0] - p.total)}`
      : `${p.total} piw. Maksymalny poziom!`);
  };

  function computeAchievements(weekWinners) {
    const res = people.map(() => ({}));
    const add = (p, id) => { res[p][id] = (res[p][id] || 0) + 1; };
    const daysOf = people.map(() => new Map());
    const lastT = people.map(() => null);
    const lastDayOf = people.map(() => null);
    const seenYear = new Set();
    for (const b of beers) {
      if (b.k === "b") { daysOf[b.p].set(b.day, (daysOf[b.p].get(b.day) || 0) + b.c); continue; }
      if (b.n % 100 === 0 && b.k !== "c") add(b.p, "jubilat");
      if (b.c >= 3 && b.k === "s") add(b.p, "multi");
      if (b.r >= 5) add(b.p, "star");
      if (b.n > 100 && /^(\d)\1+$/.test(String(b.n))) add(b.p, "lucky");
      if (b.hour >= 2 && b.hour < 6) add(b.p, "owl");
      if (b.hour >= 6 && b.hour < 11) add(b.p, "early");
      if (lastT[b.p] !== null && b.t - lastT[b.p] <= 900) add(b.p, "flash");
      if (lastDayOf[b.p] !== null && b.day - lastDayOf[b.p] >= 7) add(b.p, "comeback");
      if (b.k === "c") add(b.p, "clash");
      const y = dateOfIdx(b.day).getFullYear();
      if (!seenYear.has(y)) { seenYear.add(y); if (beers.find((x) => x.timed) !== b) add(b.p, "newyear"); }
      lastT[b.p] = b.t; lastDayOf[b.p] = b.day;
      daysOf[b.p].set(b.day, (daysOf[b.p].get(b.day) || 0) + b.c);
    }
    people.forEach((p, i) => {
      const days = [...daysOf[i].keys()].sort((a, b) => a - b);
      let run = 0, prev = null;
      for (const d of days) {
        const n = daysOf[i].get(d);
        if (n >= 3) add(i, "hat");
        if (n >= 5) add(i, "five");
        run = prev !== null && d === prev + 1 ? run + 1 : 1;
        if (run === 3) add(i, "streak");
        prev = d;
        if (dateOfIdx(d).getDay() === 5 && daysOf[i].has(d + 1) && daysOf[i].has(d + 2)) add(i, "weekend");
      }
      if (p.total >= 100) add(i, "century");
    });
    for (const w of weekWinners) for (const p of w.winners) add(p, "king");
    return res;
  }

  function streaks(dayList) {
    // longest and current run of consecutive days
    let best = { len: 0, end: null }, run = 0, prev = null;
    for (const d of dayList) {
      run = prev !== null && d === prev + 1 ? run + 1 : 1;
      if (run > best.len) best = { len: run, end: d };
      prev = d;
    }
    const current = prev !== null && prev >= todayIdx - 1 ? run : 0;
    return { best, current };
  }

  function weeklyWinners() {
    const weeks = new Map();
    for (const b of beers) {
      if (!weeks.has(b.week)) weeks.set(b.week, new Array(people.length).fill(0));
      weeks.get(b.week)[b.p] += b.c;
    }
    const currentWeek = weekOf(todayIdx);
    const out = [];
    for (const [w, counts] of [...weeks].sort((a, b) => a[0] - b[0])) {
      const max = Math.max(...counts);
      if (max === 0) continue;
      out.push({ week: w, max, total: counts.reduce((a, b) => a + b, 0), counts, done: w < currentWeek,
        winners: counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0) });
    }
    return out;
  }

  // ---------------------------------------------------------------- hero
  function renderHero() {
    const counter = D.counter;
    $("counter").textContent = fmt(counter);
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
      [`Ostatni dzień (${shortFmt.format(dateOfIdx(todayIdx))})`, fmt(today), delta(today, yesterday, (d) => `${fmt(d)} vs dzień wcześniej`)],
      ["Ten tydzień", fmt(wNow), delta(wNow, wPrevSame, (d) => `${fmt(d)} vs ten moment tyg. temu`)],
      [span < 30 ? `Średnio dziennie (${dni(span)})` : "Średnio dziennie (30 dni)", fmt1(rate),
        span < 30 ? `<span class="delta">${people.length} zawodników</span>` : delta(rate, prev30, (d) => `${fmt1(d)} vs poprzednie 30 dni`)],
      ["Rekord dnia grupy", fmt(byDay.get(bestDay)), `<span class="delta">${dateFmt.format(dateOfIdx(bestDay))}</span>`],
    ];
    $("tiles").innerHTML = tiles.map(([l, v, d]) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div>${d}</div>`).join("");

    const todays = beers.filter((b) => b.day === todayIdx).slice(-8).reverse();
    $("todayTitle").textContent = `Ostatni dzień w danych · ${shortFmt.format(dateOfIdx(todayIdx))}`;
    $("todaySub").textContent = todays.length ? piw(today) : "";
    $("todayFeed").innerHTML = todays.length
      ? todays.map((b) => `<div class="row link" data-gal="b:${beers.indexOf(b)}"><span class="t num">${timeFmt.format(new Date(b.t * 1000))}</span><span class="dot" style="background:${color(people[b.p])}"></span><span>${esc(people[b.p].name)}${b.c > 1 ? ` <span class="sub">×${b.c}</span>` : ""}</span><span class="n num">#${b.n}</span></div>`).join("")
      : `<div class="empty">Tego dnia jeszcze nic.</div>`;
  }

  // ---------------------------------------------------------------- leaderboard
  let lbPeriod = "week", achievements, weekWinners, lbAll = false, achAll = false;
  const TOP = 15;
  const moreBtn = (n, open, id) => n > TOP ? `<button class="more-btn" id="${id}" type="button">${open ? "Pokaż mniej" : `Pokaż wszystkich (${n})`}</button>` : "";
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
  function renderLeaderboard() {
    const [a, b, pa, pb] = periodRange(lbPeriod);
    const cur = perPerson(beers.filter((x) => x.day >= a && x.day <= b));
    const prev = pa === null ? null : perPerson(beers.filter((x) => x.day >= pa && x.day <= pb));
    const rows = people.map((p) => ({ p, n: cur[p.i] })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n);
    if (!rows.length) { $("leaderboard").innerHTML = `<div class="empty">W tym okresie jeszcze nikt nic nie wypił. Podejrzane.</div>`; return; }
    const max = rows[0].n;
    const medals = ["🥇", "🥈", "🥉"];
    const prevLabel = { week: "Zmiana vs poprz. tydz.", month: "Zmiana vs poprz. mies.", year: "Zmiana vs poprz. rok" }[lbPeriod];
    let rank = 0, lastN = null;
    const ranks = rows.map((r, k) => { if (r.n !== lastN) { rank = k + 1; lastN = r.n; } return rank; });
    const shown = lbAll ? rows : rows.slice(0, TOP);
    $("leaderboard").innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Zawodnik</th><th class="share">Udział</th><th class="r">Piwa</th>${prev ? `<th class="r hide-sm">${prevLabel}</th>` : ""}<th class="hide-sm">Odznaki</th></tr></thead><tbody>${shown.map((r, k) => {
      const rank = ranks[k];
      const lv = level(r.p.total);
      const ach = ACH.filter((x) => achievements[r.p.i][x.id]).map((x) => `<span data-tip="${achTip(x, achievements[r.p.i][x.id])}">${x.ico}</span>`).join("");
      let move = "";
      if (prev) {
        const pv = prev[r.p.i];
        const was = pv ? prev.filter((x) => x > pv).length + 1 : 0;
        const d = was - rank;
        const arrow = !pv ? `<span class="delta up">nowy</span>`
          : d > 0 ? `<span class="delta up">▲ ${d}</span>` : d < 0 ? `<span class="delta down">▼ ${-d}</span>` : `<span class="delta">–</span>`;
        move = `<td class="r hide-sm num">${arrow} <span class="sub">${pv ? `(#${was}, ${fmt(pv)})` : ""}</span></td>`;
      }
      return `<tr><td class="rank ${rank <= 3 ? "top" : ""}">${rank <= 3 ? medals[rank - 1] : rank}</td>
        <td><div class="who"><span class="dot" style="background:${color(r.p)}"></span><div style="min-width:0"><div class="name link" data-gal="p:${r.p.i}">${esc(r.p.name)}</div><div class="lvl" data-tip="${lvTip(r.p)}">${lv.ico} Poz. ${lv.lvl} · ${lv.name}</div></div></div></td>
        <td class="share"><div class="bar" style="width:${(r.n / max) * 100}%"></div></td>
        <td class="r num"><b>${fmt(r.n)}</b></td>${move}
        <td class="badges-inline hide-sm">${ach}</td></tr>`;
    }).join("")}</tbody></table>${moreBtn(rows.length, lbAll, "lbMore")}`;
    if ($("lbMore")) $("lbMore").onclick = () => { lbAll = !lbAll; renderLeaderboard(); };
  }

  // ---------------------------------------------------------------- charts
  const charts = {};
  let range = 90;
  function baseOptions() {
    const ink2 = css("--ink-2"), muted = css("--muted"), grid = css("--grid");
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: css("--ink"), titleColor: css("--surface"), bodyColor: css("--surface"),
          padding: 9, cornerRadius: 8, displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: muted, maxRotation: 0, autoSkipPadding: 14, font: { size: 11.5 } } },
        y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, precision: 0, font: { size: 11.5 } } },
      },
      color: ink2,
    };
  }
  function drawChart(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart($(id), config);
  }

  function renderDaily() {
    const start = range ? Math.max(firstDay, lastDay - range + 1) : firstDay;
    const span = lastDay - start + 1;
    const weekly = span > 200;
    const labels = [], vals = [], avg = [], tips = [];
    if (weekly) {
      for (let w = weekOf(start); w <= weekOf(lastDay); w++) {
        let s = 0;
        for (let d = weekStart(w); d < weekStart(w) + 7; d++) s += byDay.get(d) || 0;
        labels.push(shortFmt.format(dateOfIdx(weekStart(w)))); vals.push(s); tips.push(`Tydzień od ${dateFmt.format(dateOfIdx(weekStart(w)))}`);
      }
      for (let k = 0; k < vals.length; k++) { const win = vals.slice(Math.max(0, k - 3), k + 1); avg.push(win.reduce((a, b) => a + b, 0) / win.length); }
      $("dailySub").textContent = "Słupki: suma tygodniowa · linia: średnia 4-tygodniowa";
    } else {
      for (let d = start; d <= lastDay; d++) {
        labels.push(shortFmt.format(dateOfIdx(d))); vals.push(byDay.get(d) || 0); tips.push(dateFmt.format(dateOfIdx(d)));
        let s = 0; for (let k = d - 6; k <= d; k++) s += byDay.get(k) || 0; avg.push(s / 7);
      }
      $("dailySub").textContent = "Słupki: suma dzienna · linia: średnia 7-dniowa";
    }
    const opts = baseOptions();
    opts.plugins.tooltip.callbacks = {
      title: (items) => tips[items[0].dataIndex],
      label: (it) => it.datasetIndex === 0 ? ` ${piw(it.raw)}` : ` średnio ${fmt1(it.raw)}`,
    };
    drawChart("dailyChart", {
      data: { labels, datasets: [
        { type: "bar", data: vals, backgroundColor: css("--accent"), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start",
          maxBarThickness: 24, barPercentage: 0.9, categoryPercentage: 0.9, order: 2 },
        { type: "line", data: avg, borderColor: css("--line"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, order: 1 },
      ] },
      options: opts,
    });
  }

  function renderRace() {
    const shown = [...people].sort((a, b) => b.total - a.total);
    const top = shown.filter((p) => p.slot);
    const rest = shown.filter((p) => !p.slot);
    const step = lastDay - firstDay > 400 ? 7 : 1;
    const labels = [], series = top.map(() => []), other = [];
    const cum = new Array(people.length).fill(0);
    let k = 0;
    for (let d = firstDay; d <= lastDay + step - 1; d += step) {
      while (k < beers.length && beers[k].day <= Math.min(d, lastDay)) { cum[beers[k].p] += beers[k].c; k++; }
      labels.push(dateFmt.format(dateOfIdx(Math.min(d, lastDay))));
      top.forEach((p, j) => series[j].push(cum[p.i]));
      if (rest.length) other.push(rest.reduce((s, p) => s + cum[p.i], 0));
    }
    const ds = top.map((p, j) => ({ label: p.name, data: series[j], borderColor: color(p), backgroundColor: color(p),
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: css("--surface"), pointHoverBorderWidth: 2, tension: 0.2 }));

    const opts = baseOptions();
    opts.scales.x.ticks.callback = function (v) { const s = this.getLabelForValue(v); return s.replace(/ \d{4}$/, "").replace(/ r\.$/, ""); };
    opts.scales.x.ticks.maxTicksLimit = 8;
    opts.plugins.tooltip.itemSort = (a, b) => b.raw - a.raw;
    opts.plugins.tooltip.callbacks = { label: (it) => ` ${it.dataset.label}: ${fmt(it.raw)}` };
    drawChart("raceChart", { type: "line", data: { labels, datasets: ds }, options: opts });
    $("raceLegend").innerHTML = ds.map((d) => `<span><i style="background:${d.borderColor}"></i>${esc(d.label)}</span>`).join("")
      + (rest.length ? `<span class="sub">+ ${rest.length} pozostałych w rankingu</span>` : "");
  }

  function renderRhythm() {
    const ds = D.day_start_hour || 0;
    const hours = Array.from({ length: 24 }, (_, k) => (ds + k) % 24);
    const hc = new Array(24).fill(0);
    for (const b of timed()) hc[b.hour] += b.c;
    const o1 = baseOptions();
    o1.plugins.tooltip.callbacks = { title: (it) => `${hours[it[0].dataIndex]}:00–${hours[it[0].dataIndex]}:59`, label: (it) => ` ${piw(it.raw)}` };
    drawChart("hourChart", { type: "bar", data: { labels: hours.map((h) => `${h}`), datasets: [{ data: hours.map((h) => hc[h]),
      backgroundColor: css("--accent"), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 24 }] }, options: o1 });

    const dc = new Array(7).fill(0), dn = new Array(7).fill(0);
    const live = timed();
    for (const b of live) dc[b.dow] += b.c;
    for (let d = live[0].day; d <= lastDay; d++) dn[(dateOfIdx(d).getDay() + 6) % 7]++;
    const o2 = baseOptions();
    o2.scales.y.ticks.precision = undefined;
    o2.plugins.tooltip.callbacks = { label: (it) => ` średnio ${fmt1(it.raw)} dziennie` };
    drawChart("dowChart", { type: "bar", data: { labels: DOW, datasets: [{ data: dc.map((c, k) => (dn[k] ? c / dn[k] : 0)),
      backgroundColor: css("--accent"), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 24 }] }, options: o2 });
  }

  // ---------------------------------------------------------------- heatmap
  function renderHeatmap() {
    const end = lastDay, endW = weekOf(end), startW = Math.max(endW - 52, weekOf(firstDay) - 1);
    const cell = 12, gap = 3, left = 26, top = 18;
    const vals = [...byDay.values()].sort((a, b) => a - b);
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75), q(0.92)];
    const lvl = (n) => (n <= 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);
    const fills = [0, 1, 2, 3, 4].map((k) => css(`--heat-${k}`));
    const width = left + (endW - startW + 1) * (cell + gap), height = top + 7 * (cell + gap);
    let svg = `<svg width="${width}" height="${height}" role="img" aria-label="Kalendarz piw z ostatniego roku">`;
    [0, 2, 4, 6].forEach((r) => { svg += `<text x="0" y="${top + r * (cell + gap) + 10}" font-size="10" fill="${css("--muted")}">${DOW[r]}</text>`; });
    let lastMonth = -1;
    for (let w = startW; w <= endW; w++) {
      const x = left + (w - startW) * (cell + gap);
      const m = dateOfIdx(weekStart(w)).getMonth();
      if (m !== lastMonth) {
        if (w - startW < 51) svg += `<text x="${x}" y="11" font-size="10" fill="${css("--muted")}">${new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(dateOfIdx(weekStart(w)))}</text>`;
        lastMonth = m;
      }
      for (let r = 0; r < 7; r++) {
        const d = weekStart(w) + r;
        if (d > end) continue;
        const n = byDay.get(d) || 0;
        svg += `<rect x="${x}" y="${top + r * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fills[lvl(n)]}" data-tip="${dateFmt.format(dateOfIdx(d))}: ${piw(n)}"${n ? ` data-gal="d:${d}" style="cursor:pointer"` : ""}/>`;
      }
    }
    $("heatmap").innerHTML = svg + "</svg>";
    $("heatLegend").innerHTML = `mniej ${fills.map((f) => `<i style="background:${f}"></i>`).join("")} więcej`;
    const sc = $("heatmap").parentElement; sc.scrollLeft = sc.scrollWidth;
  }

  // ---------------------------------------------------------------- records
  function renderRecords() {
    const recs = [];
    const name = (i) => esc(people[i].name);
    // best person-day
    const pd = new Map();
    for (const b of beers) { const key = b.p + ":" + b.day; pd.set(key, (pd.get(key) || 0) + b.c); }
    let bestPD = null;
    for (const [k, n] of pd) if (!bestPD || n > bestPD.n) { const [p, d] = k.split(":").map(Number); bestPD = { p, d, n }; }
    recs.push(["🏆", "Rekord dnia (osoba)", piw(bestPD.n), name(bestPD.p), dateFmt.format(dateOfIdx(bestPD.d)),
      beers.filter((b) => b.p === bestPD.p && b.day === bestPD.d)]);
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
    let bestS = null, curS = null;
    people.forEach((p) => {
      const days = [...new Set(beers.filter((b) => b.p === p.i).map((b) => b.day))];
      const s = streaks(days);
      if (!bestS || s.best.len > bestS.len) bestS = { ...s.best, p: p.i };
      if (s.current && (!curS || s.current > curS.len)) curS = { len: s.current, p: p.i };
    });
    recs.push(["🔥", "Najdłuższa seria", dni(bestS.len) + " z rzędu", name(bestS.p), `zakończona ${dateFmt.format(dateOfIdx(bestS.end))}`,
      beers.filter((b) => b.p === bestS.p && b.day > bestS.end - bestS.len && b.day <= bestS.end)]);
    if (curS && curS.len > 1) recs.push(["⏳", "Aktualna seria", dni(curS.len), name(curS.p), "trwa"]);
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
    const cr = crowns.indexOf(Math.max(...crowns));
    if (crowns[cr]) recs.push(["👑", "Najwięcej koron tygodnia", `${crowns[cr]}×`, name(cr), "piwosz tygodnia"]);
    // jubilees
    const jub = beers.filter((b) => b.n % 100 === 0 && b.k !== "c");
    const jc = perPersonCount(jub.map((b) => b.p));
    const jb = jc.indexOf(Math.max(...jc));
    if (jc[jb]) recs.push(["🎯", "Łowca jubileuszy", `${jc[jb]}× okrągły numer`, name(jb), jub.filter((b) => b.p === jb).map((b) => b.n).slice(-4).join(", "),
      jub.filter((b) => b.p === jb)]);
    // night owl
    const night = perPerson(timed().filter((b) => b.hour >= 0 && b.hour < 6));
    const nb = night.indexOf(Math.max(...night));
    if (night[nb]) recs.push(["🦉", "Nocny marek", piw(night[nb]) + " po północy", name(nb), "00:00–05:59",
      timed().filter((b) => b.p === nb && b.hour < 6)]);
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
    const fb = fans.indexOf(Math.max(...fans));
    if (fans[fb]) recs.push(["📣", "Ulubieniec publiczności", `${fans[fb]} reakcji łącznie`, name(fb), "na wszystkich piwach",
      timed().filter((b) => b.p === fb).sort((x, y) => y.r - x.r)]);
    const big = timed().filter((b) => b.k === "s").reduce((a, b) => (b.c > (a ? a.c : 1) ? b : a), null);
    if (big) recs.push(["🍻", "Największy hurt", `${piw(big.c)} w jednym poście`, name(big.p), `do #${big.n} · ${dateFmt.format(new Date(big.t * 1000))}`,
      timed().filter((b) => b.k === "s" && b.c >= 2).sort((x, y) => y.c - x.c), "Hurtowe posty"]);
    const first = timed()[0];
    recs.push(["🥇", "Pierwsze piwo w grupie", `#${first.n}`, name(first.p), dateFmt.format(new Date(first.t * 1000)), [first]]);

    $("records").innerHTML = recs.map(([ico, ttl, val, who, when, list, galTitle], k) => {
      const withPhotos = (list || []).filter((b) => b.f.length);
      if (withPhotos.length) galleries["r" + k] = { title: galTitle || `${ttl}: ${who.replace(/&amp;/g, "&")}`, list: withPhotos };
      return `<div class="record ${withPhotos.length ? "link" : ""}" ${withPhotos.length ? `data-gal="r${k}" role="button" tabindex="0"` : ""}>
        <div class="ico" aria-hidden="true">${ico}</div><div class="ttl">${ttl}</div><div class="val">${val}</div>${who ? `<div class="who2">${who}</div>` : ""}
        <div class="when">${when}${withPhotos.length ? ` <span class="cam">📷 ${withPhotos.reduce((a, b) => a + b.f.length, 0)}</span>` : ""}</div></div>`;
    }).join("");
  }
  function perPersonCount(list) { const m = new Array(people.length).fill(0); for (const p of list) m[p]++; return m; }

  // ---------------------------------------------------------------- achievements
  function renderAchievements() {
    const all = [...people].sort((a, b) => b.total - a.total);
    const order = achAll ? all : all.slice(0, TOP);
    $("achievements").innerHTML = `<table class="ach-table"><thead><tr><th>Zawodnik</th>${ACH.map((a) => `<th data-tip="${achTip(a)}" aria-label="${a.name}">${a.ico}</th>`).join("")}<th data-tip="Zdobyte odznaki">Σ</th></tr></thead><tbody>${order.map((p) => {
      const got = achievements[p.i];
      const n = ACH.filter((a) => got[a.id]).length;
      return `<tr><td><span class="dot" style="display:inline-block;background:${color(p)};margin-right:8px"></span>${esc(p.name)}</td>${ACH.map((a) => got[a.id]
        ? `<td class="got" data-tip="${achTip(a, got[a.id])}">${a.ico}</td>`
        : `<td class="no" data-tip="${esc(a.name)}: jeszcze nie. ${esc(a.desc)}">·</td>`).join("")}<td class="num"><b>${n}</b>/${ACH.length}</td></tr>`;
    }).join("")}</tbody></table>${moreBtn(all.length, achAll, "achMore")}`;
    if ($("achMore")) $("achMore").onclick = () => { achAll = !achAll; renderAchievements(); };
    $("achKey").innerHTML = ACH.map((a) => `<div>${a.ico} <b>${a.name}</b>: ${a.desc}</div>`).join("");
  }

  // ---------------------------------------------------------------- levels
  function renderLevels() {
    const at = LEVELS.map(() => []);
    for (const p of people) at[level(p.total).k].push(p);
    const reached = at.filter((x) => x.length).length;
    $("levels").innerHTML = `<div class="lvl-ladder">${LEVELS.map(([need, nm, ico], k) => {
      const who = at[k].sort((a, b) => b.total - a.total);
      const chips = who.slice(0, 8).map((p) => `<span class="chip" data-tip="${lvTip(p)}">${esc(p.name)}</span>`).join("")
        + (who.length > 8 ? `<span class="chip more" data-tip="${esc(who.slice(8).map((p) => p.name).join(", "))}">+${who.length - 8}</span>` : "");
      return `<div class="lvl-row ${who.length ? "" : "empty-lvl"}"><span class="lvl-ico" aria-hidden="true">${ico}</span>
        <span class="lvl-n num">${k + 1}</span><span class="lvl-name">${nm}</span><span class="lvl-need num">${need ? `od ${piw(need)}` : "start"}</span>
        <span class="lvl-who">${chips || '<span class="sub">nikt jeszcze</span>'}</span></div>`;
    }).join("")}</div>`;
    $("levelsSub").textContent = `${LEVELS.length} poziomów za wszystkie zaliczone piwa (all-time, z backfillem). Zdobyte przez kogokolwiek: ${reached}.`;
    const close = people.filter((p) => level(p.total).next).map((p) => ({ p, miss: level(p.total).next[0] - p.total }))
      .sort((a, b) => a.miss - b.miss || b.p.total - a.p.total).slice(0, 6);
    $("levelUp").innerHTML = close.map(({ p, miss }) => {
      const lv = level(p.total), base = LEVELS[lv.k][0], pct = ((p.total - base) / (lv.next[0] - base)) * 100;
      return `<div class="up-row"><div class="up-top"><b>${esc(p.name)}</b><span class="sub">${lv.ico} ${lv.name} → ${lv.next[2]} ${lv.next[1]}</span></div>
        <div class="meter"><i style="width:${pct}%"></i></div><div class="sub">brakuje ${piw(miss)}</div></div>`;
    }).join("");
  }

  // ---------------------------------------------------------------- lightbox
  const galleries = {};
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
    if (kind === "d") return { title: `Piwa z ${dateFmt.format(dateOfIdx(+v))}`, list: timed().filter((b) => b.day === +v) };
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
  function wireLightbox() {
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

  // ---------------------------------------------------------------- weeks, duel, shame
  function renderWeeks() {
    const rows = weekWinners.slice(-10).reverse();
    $("weeks").innerHTML = rows.map((w) => `<div class="row"><span class="w">${shortFmt.format(dateOfIdx(weekStart(w.week)))}${w.done ? "" : " (trwa)"}</span>
      <span>${w.done ? "👑 " : "⏳ "}${w.winners.map((i) => esc(people[i].name)).join(", ")}</span><span class="num sub">${piw(w.max)}</span></div>`).join("");
  }

  // Searchable person picker: type part of a name (Polish letters optional), arrows + Enter or click.
  const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
  function makeCombo(el, order, initial, onPick) {
    const listId = el.id + "List";
    el.innerHTML = `<svg class="combo-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg>
      <input type="text" role="combobox" aria-expanded="false" aria-controls="${listId}" aria-autocomplete="list"
        autocomplete="off" spellcheck="false" placeholder="Szukaj osoby…" aria-label="Wybierz zawodnika">
      <ul class="combo-list" id="${listId}" role="listbox" hidden></ul>`;
    const input = el.querySelector("input"), list = el.querySelector("ul");
    let shown = [], active = 0;
    const nameOf = (i) => people[i].name;
    const set = (i) => { el.dataset.value = i; input.value = nameOf(i); };
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.value = nameOf(+el.dataset.value); };
    const draw = () => {
      const q = fold(input.value.trim());
      shown = order.filter((p) => !q || fold(p.name).includes(q));
      active = Math.min(active, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length
        ? shown.map((p, k) => `<li role="option" id="${listId}-${k}" data-i="${p.i}" aria-selected="${k === active}" class="${k === active ? "on" : ""}">
            <span class="dot" style="background:${color(p)}"></span><span class="nm">${esc(p.name)}</span><span class="sub num">${fmt(p.total)}</span></li>`).join("")
        : `<li class="none">Nikogo takiego</li>`;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", shown.length ? `${listId}-${active}` : "");
      const cur = list.children[active]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    };
    const pick = (i) => { set(i); list.hidden = true; input.setAttribute("aria-expanded", "false"); input.blur(); onPick(); };
    input.addEventListener("focus", () => { input.value = ""; active = 0; draw(); });
    input.addEventListener("input", () => { active = 0; draw(); });
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) pick(shown[active].i); }
      else if (e.key === "Escape") { input.blur(); }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); pick(+li.dataset.i); }
    });
    set(initial);
  }

  function renderDuel() {
    const a = +$("duelA").dataset.value, b = +$("duelB").dataset.value;
    const pa = people[a], pb = people[b];
    const bA = beers.filter((x) => x.p === a), bB = beers.filter((x) => x.p === b);
    const bestDay = (arr) => { const m = new Map(); for (const x of arr) m.set(x.day, (m.get(x.day) || 0) + x.c); return Math.max(0, ...m.values()); };
    const streakOf = (arr) => streaks([...new Set(arr.map((x) => x.day))]).best.len;
    let wa = 0, wb = 0;
    for (const w of weekWinners) if (w.done) { if (w.counts[a] > w.counts[b]) wa++; else if (w.counts[b] > w.counts[a]) wb++; }
    const t = dateOfIdx(todayIdx);
    const m0 = dayIdxOf(new Date(t.getFullYear(), t.getMonth(), 1));
    const rows = [
      ["Piwa all-time", sum(bA), sum(bB)],
      ["W tym miesiącu", sum(bA.filter((x) => x.day >= m0)), sum(bB.filter((x) => x.day >= m0))],
      ["Wygrane tygodnie (h2h)", wa, wb],
      ["Rekord dnia", bestDay(bA), bestDay(bB)],
      ["Najdłuższa seria (dni)", streakOf(bA), streakOf(bB)],
      ["Odznaki", ACH.filter((x) => achievements[a][x.id]).length, ACH.filter((x) => achievements[b][x.id]).length],
    ];
    let sa = 0, sb = 0;
    rows.forEach((r) => { if (r[1] > r[2]) sa++; else if (r[2] > r[1]) sb++; });
    $("duel").innerHTML = `<table class="duel"><tbody>${rows.map(([l, x, y]) =>
      `<tr><td class="num ${x > y ? "win" : ""}">${fmt(x)}</td><td class="mid">${l}</td><td class="num ${y > x ? "win" : ""}">${fmt(y)}</td></tr>`).join("")}
      <tr><td>${esc(pa.name)}${sa > sb ? " 🏆" : ""}</td><td class="mid">wynik ${sa}:${sb}</td><td>${sb > sa ? "🏆 " : ""}${esc(pb.name)}</td></tr></tbody></table>`;
  }

  function renderShame() {
    const rej = (D.rejected || []).filter((r) => r.reason !== "korekta").sort((x, y) => y.t - x.t);
    if (!rej.length) { $("shame").innerHTML = `<div class="empty">Czysto. Wszyscy grają fair.</div>`; return; }
    const noPhoto = {};
    for (const r of rej) if (r.reason === "bez zdjęcia") noPhoto[r.who] = (noPhoto[r.who] || 0) + 1;
    const worst = Object.entries(noPhoto).sort((x, y) => y[1] - x[1])[0];
    $("shame").innerHTML = `${worst ? `<p class="sub" style="margin:0 0 10px">Najczęściej zapomina zdjęcia: <b style="color:var(--ink)">${esc(worst[0])}</b> (${worst[1]}×)</p>` : ""}
      <div style="overflow-x:auto"><table class="shame"><tbody>${rej.slice(0, 12).map((r) => `<tr><td class="t num">${dateFmt.format(new Date(r.t * 1000))} ${timeFmt.format(new Date(r.t * 1000))}</td>
      <td>${esc(r.who)}</td><td>„${esc(r.text)}”</td><td><span class="pill">${esc(r.reason)}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- wiring
  function renderThemed() { renderDaily(); renderRace(); renderRhythm(); renderHeatmap(); renderLeaderboard(); renderHero(); renderAchievements(); }

  function wireSeg(id, attr, onPick) {
    $(id).addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      for (const b of $(id).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === btn));
      onPick(btn.dataset[attr]);
    });
  }

  function init(data) {
    prepare(data);
    weekWinners = weeklyWinners();
    achievements = computeAchievements(weekWinners.filter((w) => w.done));
    $("title").textContent = data.title || "Piwny licznik";
    document.title = data.title || "Piwny licznik";
    const upTo = new Date((data.last_message || Date.parse(data.generated_at) / 1000) * 1000);
    $("updated").textContent = `Dane do ${dateFmt.format(upTo)} ${timeFmt.format(upTo)} · ${fmt(data.messages_total)} wiadomości · ${people.length} zawodników`;
    renderThemed(); renderRecords(); renderWeeks(); renderShame(); renderLevels(); wireLightbox();

    const order = [...people].sort((a, b) => b.total - a.total);
    makeCombo($("duelA"), order, order[0].i, renderDuel);
    makeCombo($("duelB"), order, (order[1] || order[0]).i, renderDuel);
    renderDuel();

    wireSeg("lbSeg", "p", (p) => { lbPeriod = p; renderLeaderboard(); });
    wireSeg("rangeSeg", "r", (r) => { range = +r; renderDaily(); });

    const bf = beers.filter((b) => b.k === "b");
    $("footer").innerHTML = `Piwo się liczy, gdy kolejny numer licznika ma zdjęcie od tej samej osoby (±3 min).
      „58,59”, „136 i 137”, „184-190” to kilka piw naraz. Ten sam numer od dwóch osób: obie dostają piwo.
      Dzień piwny zaczyna się o ${D.day_start_hour || 0}:00, więc piwo o 1:30 liczy się do poprzedniego wieczoru.
      ${bf.length ? `Pierwsze ${sum(bf)} piw to backfill z poprzedniej konfy (${dateFmt.format(new Date(bf[0].t * 1000))}).` : ""}`;

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
      document.querySelector(".wrap").insertAdjacentHTML("beforeend",
        `<div class="card empty">Nie udało się wczytać data.json (${esc(err.message)}). Uruchom parse_export.py i odpal stronę przez serwer HTTP, nie z pliku.</div>`);
    });
})();
