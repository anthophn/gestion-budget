import type { AppData, Expense } from './types';
import { CAT } from './kakeibo';

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV au format français (séparateur « ; », virgule décimale) : s'ouvre directement dans Excel. */
export function expensesToCSV(expenses: Expense[]): string {
  const rows = [['Date', 'Libellé', 'Catégorie', 'Montant', 'Note']];
  for (const e of [...expenses].sort((a, b) => a.spent_on.localeCompare(b.spent_on))) {
    rows.push([e.spent_on, e.label, CAT[e.category].label, e.amount.toFixed(2).replace('.', ','), e.note]);
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\n');
}

export function backupJSON(data: AppData): string {
  return JSON.stringify({ app: 'kakeibo', version: 1, exported_at: new Date().toISOString(), ...data }, null, 2);
}

export function parseBackup(text: string): Partial<AppData> {
  const raw = JSON.parse(text) as Partial<AppData> & { app?: string };
  if (raw.app !== 'kakeibo') throw new Error('Ce fichier n’est pas une sauvegarde Kakeibo.');
  return { expenses: raw.expenses ?? [], items: raw.items ?? [], months: raw.months ?? [], settings: raw.settings };
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
