// Number, date and Polish plural formatting.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (n) => Math.round(n).toLocaleString("pl-PL");
export const fmt1 = (n) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (n === 1) return one;
  return b >= 2 && b <= 4 && (a < 12 || a > 14) ? few : many;
};
export const piw = (n) => `${fmt(n)} ${plural(n, "piwo", "piwa", "piw")}`;
export const dni = (n) => `${fmt(n)} ${plural(n, "dzień", "dni", "dni")}`;
export const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
export const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
export const dayFmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "short" });
export const shortFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
export const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
