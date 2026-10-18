// Toutes les dates sont manipulées en texte local (AAAA-MM-JJ) pour éviter les décalages de fuseau horaire.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function parseMonth(month: string): { y: number; m: number } {
  return { y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) };
}

export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parseMonth(month);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const { y, m } = parseMonth(month);
  return new Date(y, m, 0).getDate();
}

export function dateFromISO(date: string): Date {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Les `n` mois qui se terminent par `end` (inclus), du plus ancien au plus récent. */
export function monthRange(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(end, i - n + 1));
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const WEEKDAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthLabel(month: string, withYear = true): string {
  const { y, m } = parseMonth(month);
  return cap(MONTHS[m - 1]) + (withYear ? ` ${y}` : '');
}

export function monthShort(month: string): string {
  const { y, m } = parseMonth(month);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** Étiquettes compactes pour un axe de mois : « sept. » avec l'année dessous au début et en janvier. */
export function monthAxis(months: string[]): { labels: string[]; sublabels: string[] } {
  return {
    labels: months.map((m) => MONTHS_SHORT[parseMonth(m).m - 1]),
    sublabels: months.map((m, i) => (i === 0 || m.endsWith('-01') ? m.slice(0, 4) : '')),
  };
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(date: string): number {
  return (dateFromISO(date).getDay() + 6) % 7;
}

export function dayLabel(date: string): string {
  const today = todayISO();
  if (date === today) return "Aujourd'hui";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === toISODate(y)) return 'Hier';
  const d = dateFromISO(date);
  return cap(`${WEEKDAYS[weekdayIndex(date)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
}

export function shortDate(date: string): string {
  const d = dateFromISO(date);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
