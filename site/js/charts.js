// Chart.js charts: beers over time, by hour, by weekday.
import { DOW, dateFmt, dayFmt, fmt1, piw, shortFmt } from "./format.js";
import { D, byDay, dateOfIdx, firstDay, lastDay, timed, weekOf, weekStart } from "./model.js";
import { $, css, wireSeg } from "./ui.js";

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
// amber gradient bars; the top value glows hotter
const barFill = (vals) => (ctx) => {
  const { chart } = ctx, area = chart.chartArea;
  if (!area) return css("--accent");
  const hot = vals[ctx.dataIndex] === Math.max(...vals) && vals[ctx.dataIndex] > 0;
  const g = chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
  g.addColorStop(0, hot ? "#c25a00" : "#d99000");
  g.addColorStop(1, hot ? "#ff8a1c" : "#ffcf57");
  return g;
};
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

export function renderDaily() {
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
      labels.push(shortFmt.format(dateOfIdx(d))); vals.push(byDay.get(d) || 0); tips.push(dayFmt.format(dateOfIdx(d)));
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
      { type: "bar", data: vals, backgroundColor: barFill(vals), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start",
        maxBarThickness: 24, barPercentage: 0.9, categoryPercentage: 0.9, order: 2 },
      { type: "line", data: avg, borderColor: css("--line"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, order: 1 },
    ] },
    options: opts,
  });
}

export function renderRhythm() {
  const ds = D.day_start_hour || 0;
  const hours = Array.from({ length: 24 }, (_, k) => (ds + k) % 24);
  const hc = new Array(24).fill(0);
  for (const b of timed()) hc[b.hour] += b.c;
  const o1 = baseOptions();
  o1.plugins.tooltip.callbacks = { title: (it) => `${hours[it[0].dataIndex]}:00–${hours[it[0].dataIndex]}:59`, label: (it) => ` ${piw(it.raw)}` };
  drawChart("hourChart", { type: "bar", data: { labels: hours.map((h) => `${h}`), datasets: [{ data: hours.map((h) => hc[h]),
    backgroundColor: barFill(hours.map((h) => hc[h])), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 24 }] }, options: o1 });

  const dc = new Array(7).fill(0), dn = new Array(7).fill(0);
  const live = timed();
  for (const b of live) dc[b.dow] += b.c;
  for (let d = live[0].day; d <= lastDay; d++) dn[(dateOfIdx(d).getDay() + 6) % 7]++;
  const o2 = baseOptions();
  o2.scales.y.ticks.precision = undefined;
  o2.plugins.tooltip.callbacks = { label: (it) => ` średnio ${fmt1(it.raw)} dziennie` };
  const dowVals = dc.map((c, k) => (dn[k] ? c / dn[k] : 0));
  drawChart("dowChart", { type: "bar", data: { labels: DOW, datasets: [{ data: dowVals,
    backgroundColor: barFill(dowVals), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 24 }] }, options: o2 });
}

export function wireRange() {
  wireSeg("rangeSeg", "r", (r) => { range = +r; renderDaily(); });
}
