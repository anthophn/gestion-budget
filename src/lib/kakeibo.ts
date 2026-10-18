import type { AppData, BudgetMonth, Category, Expense, MonthItem } from './types';
import { daysInMonth, monthOf, todayISO, currentMonth, weekdayIndex } from './dates';

export interface CategoryInfo {
  id: Category;
  label: string;
  hint: string;
  examples: string;
}

/** Les 4 catégories de la méthode Kakeibo. */
export const CATEGORIES: CategoryInfo[] = [
  { id: 'survie', label: 'Survie', hint: 'Les indispensables', examples: 'Courses, transport, santé, factures variables' },
  { id: 'optionnel', label: 'Optionnel', hint: 'Les envies', examples: 'Restaurants, sorties, shopping, livraisons' },
  { id: 'culture', label: 'Culture', hint: 'Ce qui te fait grandir', examples: 'Livres, cinéma, musées, musique, cours' },
  { id: 'imprevus', label: 'Imprévus', hint: 'Ce qui n’était pas prévu', examples: 'Réparations, cadeaux, amendes, frais exceptionnels' },
];

export const CAT: Record<Category, CategoryInfo> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<Category, CategoryInfo>;
export const CAT_IDS = CATEGORIES.map((c) => c.id);

export const catColor = (c: Category) => `var(--c-${c})`;

export interface DataIndex {
  expensesByMonth: Map<string, Expense[]>;
  itemsByMonth: Map<string, MonthItem[]>;
  monthsByKey: Map<string, BudgetMonth>;
  firstMonth: string | null;
}

export function buildIndex(data: AppData): DataIndex {
  const expensesByMonth = new Map<string, Expense[]>();
  for (const e of data.expenses) {
    const m = monthOf(e.spent_on);
    const list = expensesByMonth.get(m);
    if (list) list.push(e);
    else expensesByMonth.set(m, [e]);
  }
  for (const list of expensesByMonth.values()) {
    list.sort((a, b) => (a.spent_on === b.spent_on ? (b.created_at ?? '').localeCompare(a.created_at ?? '') : b.spent_on.localeCompare(a.spent_on)));
  }
  const itemsByMonth = new Map<string, MonthItem[]>();
  for (const i of data.items) {
    const list = itemsByMonth.get(i.month);
    if (list) list.push(i);
    else itemsByMonth.set(i.month, [i]);
  }
  const monthsByKey = new Map(data.months.map((m) => [m.month, m]));
  const all = [...expensesByMonth.keys(), ...itemsByMonth.keys(), ...monthsByKey.keys()].sort();
  return { expensesByMonth, itemsByMonth, monthsByKey, firstMonth: all[0] ?? null };
}

export function emptyMonth(month: string): BudgetMonth {
  return { month, savings_goal: 0, cat_budgets: {}, reflection: {} };
}

export interface CatStat {
  spent: number;
  budget: number | null;
  share: number;
  ratio: number | null;
  count: number;
}

export interface WeekStat {
  index: number;
  start: string;
  end: string;
  days: number;
  spent: number;
  budget: number;
}

export interface MonthSummary {
  month: string;
  plan: BudgetMonth;
  incomes: MonthItem[];
  fixedItems: MonthItem[];
  hasPlan: boolean;
  income: number;
  fixed: number;
  savingsGoal: number;
  /** Budget variable = revenus − charges fixes − objectif d'épargne */
  available: number;
  spent: number;
  remaining: number;
  actualSavings: number;
  savingsRate: number;
  goalReached: boolean | null;
  byCat: Record<Category, CatStat>;
  catBudgetTotal: number;
  expenses: Expense[];
  count: number;
  daysInMonth: number;
  daysElapsed: number;
  daysLeft: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  perDayLeft: number | null;
  projectedSpent: number;
  avgPerDay: number;
  weeks: WeekStat[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(index: DataIndex, month: string, today = todayISO()): MonthSummary {
  const plan = index.monthsByKey.get(month) ?? emptyMonth(month);
  const items = index.itemsByMonth.get(month) ?? [];
  const incomes = items.filter((i) => i.kind === 'income');
  const fixedItems = items.filter((i) => i.kind === 'fixed');
  const expenses = index.expensesByMonth.get(month) ?? [];

  const income = round2(sum(incomes.map((i) => i.amount)));
  const fixed = round2(sum(fixedItems.map((i) => i.amount)));
  const savingsGoal = plan.savings_goal || 0;
  const available = round2(income - fixed - savingsGoal);
  const spent = round2(sum(expenses.map((e) => e.amount)));
  const remaining = round2(available - spent);
  const actualSavings = round2(income - fixed - spent);
  const hasPlan = income > 0 || fixed > 0 || savingsGoal > 0;

  const nDays = daysInMonth(month);
  const cur = today.slice(0, 7);
  const isCurrent = month === cur;
  const isPast = month < cur;
  const isFuture = month > cur;
  const todayDay = Number(today.slice(8, 10));
  const daysElapsed = isPast ? nDays : isCurrent ? todayDay : 0;
  const daysLeft = isCurrent ? nDays - todayDay + 1 : isFuture ? nDays : 0;
  const avgPerDay = daysElapsed > 0 ? spent / daysElapsed : 0;
  const projectedSpent = isCurrent ? round2(avgPerDay * nDays) : spent;

  const byCat = {} as Record<Category, CatStat>;
  let catBudgetTotal = 0;
  for (const c of CAT_IDS) {
    const list = expenses.filter((e) => e.category === c);
    const s = round2(sum(list.map((e) => e.amount)));
    const b = plan.cat_budgets?.[c];
    const budget = typeof b === 'number' && b > 0 ? b : null;
    if (budget) catBudgetTotal += budget;
    byCat[c] = { spent: s, budget, share: spent > 0 ? s / spent : 0, ratio: budget ? s / budget : null, count: list.length };
  }

  // Semaines du lundi au dimanche, la première et la dernière peuvent être incomplètes.
  const weeks: WeekStat[] = [];
  for (let d = 1; d <= nDays; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (d === 1 || weekdayIndex(date) === 0) {
      weeks.push({ index: weeks.length + 1, start: date, end: date, days: 0, spent: 0, budget: 0 });
    }
    const w = weeks[weeks.length - 1];
    w.end = date;
    w.days += 1;
  }
  for (const w of weeks) {
    w.budget = available > 0 ? round2((available * w.days) / nDays) : 0;
    w.spent = round2(sum(expenses.filter((e) => e.spent_on >= w.start && e.spent_on <= w.end).map((e) => e.amount)));
  }

  return {
    month,
    plan,
    incomes,
    fixedItems,
    hasPlan,
    income,
    fixed,
    savingsGoal,
    available,
    spent,
    remaining,
    actualSavings,
    savingsRate: income > 0 ? actualSavings / income : NaN,
    goalReached: isPast && hasPlan ? actualSavings >= savingsGoal : null,
    byCat,
    catBudgetTotal,
    expenses,
    count: expenses.length,
    daysInMonth: nDays,
    daysElapsed,
    daysLeft,
    isCurrent,
    isPast,
    isFuture,
    perDayLeft: isCurrent && daysLeft > 0 ? Math.max(0, remaining) / daysLeft : null,
    projectedSpent,
    avgPerDay,
    weeks,
  };
}

export type BudgetStatus = 'none' | 'ok' | 'warn' | 'over';

/** État d'un budget. Pour le mois en cours, on compare aussi au rythme attendu. */
export function budgetStatus(spent: number, budget: number | null, s: Pick<MonthSummary, 'isCurrent' | 'daysElapsed' | 'daysInMonth'>): BudgetStatus {
  if (!budget || budget <= 0) return 'none';
  if (spent > budget) return 'over';
  if (spent >= budget * 0.9) return 'warn';
  if (s.isCurrent && s.daysElapsed > 3) {
    const projected = (spent / s.daysElapsed) * s.daysInMonth;
    if (projected > budget * 1.05) return 'warn';
  }
  return 'ok';
}

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  none: 'Pas de budget',
  ok: 'Dans les clous',
  warn: 'Attention',
  over: 'Dépassé',
};

export interface ScorePart {
  label: string;
  points: number;
  max: number;
  detail: string;
}

/**
 * Score Kakeibo sur 100 :
 *  - Épargne (50 pts) : part de l'objectif d'épargne atteinte (ou taux d'épargne ≥ 20 % sans objectif)
 *  - Budgets (30 pts) : respect des budgets par catégorie (ou du budget variable global)
 *  - Équilibre (20 pts) : part des dépenses « Optionnel + Imprévus » (≤ 30 % = plein score, ≥ 60 % = 0)
 * Pour le mois en cours, on raisonne sur la projection de fin de mois.
 */
export function kakeiboScore(s: MonthSummary): { score: number; parts: ScorePart[] } | null {
  if (!s.hasPlan && s.count === 0) return null;
  const factor = s.isCurrent && s.daysElapsed > 0 ? s.daysInMonth / s.daysElapsed : 1;
  const projSpent = s.spent * factor;
  const projSavings = s.income - s.fixed - projSpent;

  let savingsPts = 0;
  let savingsDetail = 'Ajoute tes revenus pour mesurer ton épargne.';
  if (s.savingsGoal > 0) {
    const r = Math.max(0, Math.min(1, projSavings / s.savingsGoal));
    savingsPts = 50 * r;
    savingsDetail = `${Math.round(r * 100)} % de l'objectif d'épargne ${s.isCurrent ? 'atteint (projection)' : 'atteint'}.`;
  } else if (s.income > 0) {
    const rate = projSavings / s.income;
    savingsPts = 50 * Math.max(0, Math.min(1, rate / 0.2));
    savingsDetail = `Taux d'épargne ${s.isCurrent ? 'projeté ' : ''}de ${Math.round(rate * 100)} % (objectif conseillé : 20 %).`;
  }

  let budgetPts = 0;
  let budgetDetail = 'Fixe un budget pour mesurer ce point.';
  const budgeted = CAT_IDS.filter((c) => s.byCat[c].budget);
  const ratioPts = (ratio: number) => (ratio <= 1 ? 1 : Math.max(0, 1 - (ratio - 1) / 0.5));
  if (budgeted.length > 0) {
    const scores = budgeted.map((c) => ratioPts((s.byCat[c].spent * factor) / (s.byCat[c].budget as number)));
    const ok = scores.filter((x) => x === 1).length;
    budgetPts = 30 * (sum(scores) / scores.length);
    budgetDetail = `${ok} budget${ok > 1 ? 's' : ''} sur ${budgeted.length} respecté${ok > 1 ? 's' : ''}${s.isCurrent ? ' (projection)' : ''}.`;
  } else if (s.available > 0) {
    budgetPts = 30 * ratioPts(projSpent / s.available);
    budgetDetail = projSpent <= s.available ? 'Budget variable respecté.' : 'Budget variable dépassé.';
  }

  let balancePts = 20;
  let balanceDetail = 'Aucune dépense pour le moment.';
  if (s.spent > 0) {
    const share = s.byCat.optionnel.share + s.byCat.imprevus.share;
    balancePts = 20 * Math.max(0, Math.min(1, (0.6 - share) / 0.3));
    balanceDetail = `${Math.round(share * 100)} % de tes dépenses en Optionnel et Imprévus.`;
  }

  const parts: ScorePart[] = [
    { label: 'Épargne', points: Math.round(savingsPts), max: 50, detail: savingsDetail },
    { label: 'Budgets', points: Math.round(budgetPts), max: 30, detail: budgetDetail },
    { label: 'Équilibre', points: Math.round(balancePts), max: 20, detail: balanceDetail },
  ];
  return { score: sum(parts.map((p) => p.points)), parts };
}

export function defaultExpenseDate(month: string): string {
  return month === currentMonth() ? todayISO() : `${month}-01`;
}
