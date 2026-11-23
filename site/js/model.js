// Data model: turns data.json into beers and people, plus generic aggregations.

export let D, people, beers, byDay, firstDay, lastDay, todayIdx;
let live = [];  // beers with a real timestamp (no backfill), computed once
export const dayIdxOf = (date) => Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
export const dateOfIdx = (i) => { const d = new Date(i * 864e5); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
export const weekOf = (dayIdx) => Math.floor((dayIdx + 3) / 7); // Monday-based (1970-01-01 was a Thursday)
export const weekStart = (w) => w * 7 - 3;

export function prepare(data) {
  D = data;
  const ds = (data.day_start_hour || 0) * 3600;
  people = data.people.map((name, i) => ({ i, name, total: 0 }));
  beers = data.beers.map(([t, p, n, c, k, r, f]) => {
    const local = new Date(t * 1000);
    const day = dayIdxOf(new Date((t - ds) * 1000));
    people[p].total += c;
    return { t, p, n, c, k, r: r || 0, f: f || [], timed: k !== "b", day, week: weekOf(day), hour: local.getHours(), dow: (dateOfIdx(day).getDay() + 6) % 7 };
  }).sort((a, b) => a.t - b.t);
  beers.forEach((b, i) => { b.id = i; });
  live = beers.filter((b) => b.timed);
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

export const timed = () => live;
export const sum = (arr) => arr.reduce((s, b) => s + b.c, 0);
export const perPerson = (arr) => {
  const m = new Array(people.length).fill(0);
  for (const b of arr) m[b.p] += b.c;
  return m;
};

// beer days of every person in one pass (sorted, unique)
export function daysByPerson() {
  const out = people.map(() => []);
  for (const b of live) { const d = out[b.p]; if (d[d.length - 1] !== b.day) d.push(b.day); }
  return out;
}

export function streaks(dayList) {
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

export function weeklyWinners() {
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

// everyone tied for the top value (empty when nobody scored)
export function leaders(arr) {
  const max = Math.max(...arr);
  return max > 0 ? arr.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0) : [];
}
export function perPersonCount(list) { const m = new Array(people.length).fill(0); for (const p of list) m[p]++; return m; }
