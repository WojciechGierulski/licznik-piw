// Levels and badges: what can be earned and who earned what.
import { D, beers, dateOfIdx, people, todayIdx, weeklyWinners } from "./model.js";

// [beers needed (all-time), name, icon]
export const LEVELS = [
  [1, "Pierwszy łyk", "💧"], [3, "Piwny żółtodziób", "🐣"], [5, "Amator pianki", "🫧"],
  [8, "Kapslowy kadet", "🧢"], [12, "Bywalec", "🪑"], [16, "Degustator", "👃"], [20, "Stały klient", "🧾"],
  [25, "Kumpel barmana", "🤝"], [30, "Piwny weteran", "🎖️"], [40, "Koneser chmielu", "🌿"], [50, "Mistrz kufla", "🍺"],
  [60, "Baron browaru", "🎩"], [75, "Hrabia chmielu", "🏰"], [90, "Książę pianki", "🤴"], [100, "Setnik", "💯"],
  [125, "Legenda baru", "📜"], [150, "Piwny mędrzec", "🧙"], [175, "Strażnik kranu", "🛡️"], [200, "Arcymistrz kufla", "🏆"],
  [240, "Wielki Piwowar", "⚗️"], [280, "Król Browarów", "👑"], [320, "Cesarz Chmielu", "🏛️"], [360, "Półbóg pianki", "⚡"],
  [400, "Spieniony Imperator", "🫅"], [450, "Arcykapłan chmielu", "🔮"], [500, "Bóg chmielu", "🌟"],
];
export const level = (n) => {
  let k = 0;
  while (k + 1 < LEVELS.length && n >= LEVELS[k + 1][0]) k++;
  return { lvl: k + 1, k, name: LEVELS[k][1], ico: LEVELS[k][2], next: LEVELS[k + 1] };
};

export const ACH = [
  { id: "jubilat", ico: "🎯", name: "Jubilat", desc: "Wbił okrągły numer licznika (wielokrotność 100)" },
  { id: "lucky", ico: "🍀", name: "Szczęśliwy numer", desc: "Wbił numer z samych tych samych cyfr (111, 777…)" },
  { id: "hat", ico: "🎩", name: "Hat-trick", desc: "3 piwa jednego dnia" },
  { id: "five", ico: "🖐️", name: "Piątka", desc: "5 piw jednego dnia" },
  { id: "ten", ico: "🔟", name: "Dycha", desc: "10 piw jednego dnia" },
  { id: "twenty", ico: "🥵", name: "Dwudziestka", desc: "20 piw jednego dnia" },
  { id: "thirty", ico: "💀", name: "Trzydziestka", desc: "30 piw jednego dnia. Szacunek i kondolencje" },
  { id: "owl", ico: "🦉", name: "Nocny marek", desc: "Piwo między 2:00 a 5:59" },
  { id: "early", ico: "🌅", name: "Ranny ptaszek", desc: "Piwo przed 11:00" },
  { id: "flash", ico: "⚡", name: "Błyskawica", desc: "Dwa piwa w odstępie do 15 minut" },
  { id: "streak", ico: "🔥", name: "Seria", desc: "Piwo 3 dni z rzędu" },
  { id: "multi", ico: "🍻", name: "Hurtownik", desc: "3 lub więcej piw w jednym poście (np. „181 182 183”)" },
  { id: "star", ico: "⭐", name: "Gwiazda", desc: "Piwo z co najmniej 5 reakcjami" },
  { id: "weekend", ico: "🎉", name: "Weekendowy wojownik", desc: "Piwo w piątek, sobotę i niedzielę tego samego weekendu" },
  { id: "king", ico: "👑", name: "Menel tygodnia", desc: "Wygrał przynajmniej jeden pełny tydzień" },
  { id: "century", ico: "💯", name: "Setka", desc: "100 piw łącznie" },
  { id: "clash", ico: "🤝", name: "Kolizja", desc: "Wrzucił ten sam numer co ktoś inny" },
  { id: "comeback", ico: "🐫", name: "Powrót", desc: "Wrócił po co najmniej 7 pełnych dniach bez piwa" },
  { id: "newyear", ico: "🎆", name: "Otwieracz roku", desc: "Pierwsze piwo w nowym roku w grupie" },
  { id: "opener", ico: "🔑", name: "Otwieracz dnia", desc: "Pierwsze piwo dnia w całej grupie" },
  { id: "closer", ico: "🌙", name: "Zamykacz", desc: "Ostatnie piwo dnia w całej grupie" },
  { id: "rescue", ico: "🚨", name: "Ratownik", desc: "Przerwał ciszę: pierwsze piwo grupy po co najmniej 18 godzinach bez piwa" },
  { id: "nice", ico: "😏", name: "Nice", desc: "Wbił numer kończący się na 69" },
  { id: "weed", ico: "🌿", name: "Ziółko", desc: "Wbił numer #420" },
  { id: "demon", ico: "😈", name: "Demon piwa", desc: "Wbił numer #666" },
  { id: "splitg", ico: "🇮🇪", name: "Split the G", desc: "Przełamał G w Guinnessie (zatwierdzone przez grupę)" },
  { id: "dragon", ico: "🐉", name: "Wejście smoka", desc: "Pierwsze piwo w ciągu godziny od dołączenia do czatu" },
];

// every counter number a post covers: "184-190" covers 184…190
const numbersOf = (b) => Array.from({ length: b.c }, (_, k) => b.n - b.c + 1 + k);

function computeAchievements(weekWinners) {
  const res = people.map(() => ({}));
  const add = (p, id) => { res[p][id] = (res[p][id] || 0) + 1; };
  const daysOf = people.map(() => new Map());
  const lastT = people.map(() => null);
  const lastDayOf = people.map(() => null);
  const seenYear = new Set();
  const dayFirst = new Map(), dayLast = new Map();
  const joined = D.joined || [];
  let lastAny = null;
  for (const b of beers) {
    if (b.k === "b") continue;  // backfill is a lump sum from the old chat, not real days
    if (!dayFirst.has(b.day)) dayFirst.set(b.day, b.p);
    dayLast.set(b.day, b.p);
    if (lastAny !== null && b.t - lastAny >= 18 * 3600) add(b.p, "rescue");
    lastAny = b.t;
    const nums = numbersOf(b), own = b.k !== "c";  // a duplicate number is not "hitting" it
    if (nums.some((n) => n % 100 === 69)) add(b.p, "nice");
    if (own && nums.some((n) => n % 1000 === 420)) add(b.p, "weed");
    if (own && nums.some((n) => n % 1000 === 666)) add(b.p, "demon");
    if (lastT[b.p] === null && joined[b.p] && b.t - joined[b.p] <= 3600) add(b.p, "dragon");
    if (own && nums.some((n) => n % 100 === 0)) add(b.p, "jubilat");
    if (b.c >= 3 && b.k === "s") add(b.p, "multi");
    if (b.r >= 5) add(b.p, "star");
    if (own && nums.some((n) => n > 100 && /^(\d)\1+$/.test(String(n)))) add(b.p, "lucky");
    if (b.hour >= 2 && b.hour < 6) add(b.p, "owl");
    if (b.hour >= 6 && b.hour < 11) add(b.p, "early");
    if (lastT[b.p] !== null && b.t - lastT[b.p] <= 900) add(b.p, "flash");
    if (lastDayOf[b.p] !== null && b.day - lastDayOf[b.p] - 1 >= 7) add(b.p, "comeback");  // 7 full days without a beer in between
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
      if (n >= 10) add(i, "ten");
      if (n >= 20) add(i, "twenty");
      if (n >= 30) add(i, "thirty");
      run = prev !== null && d === prev + 1 ? run + 1 : 1;
      if (run === 3) add(i, "streak");
      prev = d;
      if (dateOfIdx(d).getDay() === 5 && daysOf[i].has(d + 1) && daysOf[i].has(d + 2)) add(i, "weekend");
    }
    if (p.total >= 100) add(i, "century");
  });
  for (const w of weekWinners) for (const p of w.winners) add(p, "king");
  for (const p of dayFirst.values()) add(p, "opener");
  // badges the group confirmed by hand (config.json → manual_badges)
  for (const [p, ids] of Object.entries(D.manual_badges || {})) for (const id of ids) add(+p, id);
  for (const [d, p] of dayLast) if (d < todayIdx) add(p, "closer");  // today is not over yet
  return res;
}

export let achievements, weekWinners;
export function computeRules() {
  weekWinners = weeklyWinners();
  achievements = computeAchievements(weekWinners.filter((w) => w.done));
}
