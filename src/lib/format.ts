let currency = 'EUR';
let formatter = makeFormatter('EUR', 2);
let compact = makeFormatter('EUR', 0);

function makeFormatter(code: string, digits: number) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits });
  } catch {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}

export function setCurrency(code: string) {
  if (code === currency) return;
  currency = code;
  formatter = makeFormatter(code, 2);
  compact = makeFormatter(code, 0);
}

/** Symbole de la devise choisie : €, $, CHF… */
export function currencySymbol(): string {
  return formatter.formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

/** 1 234,50 € */
export function money(n: number): string {
  return formatter.format(Math.round(n * 100) / 100);
}

/** 1 235 € (arrondi, pour les graphiques et les grands chiffres) */
export function moneyRound(n: number): string {
  return compact.format(Math.round(n));
}

/** Axe des graphiques : 0, 500, 1 k, 1,5 k… */
export function moneyAxis(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return Math.round(n).toLocaleString('fr-FR');
}

export function pct(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

/** Lit un montant saisi au clavier, avec virgule ou point : « 12,5 » → 12.5 */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(/[€$£]/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return NaN;
  return Math.round(Number(cleaned) * 100) / 100;
}

export function amountInput(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return String(n).replace('.', ',');
}

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dollar américain ($)' },
  { code: 'CAD', label: 'Dollar canadien ($ CA)' },
  { code: 'CHF', label: 'Franc suisse (CHF)' },
  { code: 'GBP', label: 'Livre sterling (£)' },
  { code: 'XOF', label: 'Franc CFA BCEAO (F CFA)' },
  { code: 'XAF', label: 'Franc CFA BEAC (F CFA)' },
  { code: 'MAD', label: 'Dirham marocain (MAD)' },
  { code: 'TND', label: 'Dinar tunisien (TND)' },
  { code: 'DZD', label: 'Dinar algérien (DZD)' },
  { code: 'JPY', label: 'Yen japonais (¥)' },
];

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
