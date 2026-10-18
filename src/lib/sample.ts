import type { AppData, BudgetMonth, Category, Expense, MonthItem } from './types';
import { currentMonth, daysInMonth, monthRange, todayISO } from './dates';
import { uuid } from './format';

/** Données d'exemple réalistes sur 6 mois, pour découvrir l'analyse sans tout saisir. */
export function sampleData(end = currentMonth()): Partial<AppData> {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) * 100) / 100;

  const catalog: Record<Category, [string, number, number, number][]> = {
    // libellé, min, max, probabilité par jour
    survie: [
      ['Courses supermarché', 35, 95, 0.22],
      ['Boulangerie', 2.5, 8, 0.35],
      ['Pharmacie', 6, 25, 0.04],
      ['Carburant', 40, 65, 0.06],
      ['Marché', 12, 30, 0.08],
    ],
    optionnel: [
      ['Restaurant', 18, 48, 0.08],
      ['Café', 2.5, 6, 0.2],
      ['Vêtements', 25, 80, 0.03],
      ['Livraison repas', 15, 29, 0.06],
      ['Verre entre amis', 10, 30, 0.07],
    ],
    culture: [
      ['Livre', 8, 22, 0.04],
      ['Cinéma', 9, 13, 0.04],
      ['Musée', 8, 16, 0.015],
      ['Concert', 35, 60, 0.008],
    ],
    imprevus: [
      ['Cadeau d’anniversaire', 20, 55, 0.02],
      ['Réparation vélo', 15, 60, 0.01],
      ['Consultation médecin', 26, 30, 0.012],
      ['Frais bancaires', 8, 20, 0.008],
    ],
  };

  const today = todayISO();
  const months = monthRange(end, 6);
  const expenses: Expense[] = [];
  const items: MonthItem[] = [];
  const plans: BudgetMonth[] = [];

  months.forEach((month, mi) => {
    // Les dépenses « plaisir » augmentent un peu au fil des mois pour que l'analyse ait quelque chose à dire.
    const mood = 0.85 + mi * 0.06 + (mi === 3 ? 0.25 : 0);
    for (let d = 1; d <= daysInMonth(month); d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      if (date > today) break;
      const weekend = [0, 6].includes(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d).getDay());
      for (const [cat, list] of Object.entries(catalog) as [Category, (typeof catalog)[Category]][]) {
        for (const [label, min, max, p] of list) {
          const boost = cat === 'optionnel' ? mood * (weekend ? 1.8 : 1) : weekend && cat === 'culture' ? 1.6 : 1;
          if (rand() < p * boost) {
            expenses.push({ id: uuid(), spent_on: date, amount: between(min, max), category: cat, label, note: '', created_at: `${date}T12:00:00.000Z` });
          }
        }
      }
    }
    items.push(
      { id: uuid(), month, kind: 'income', label: 'Salaire', amount: 2150 },
      { id: uuid(), month, kind: 'fixed', label: 'Loyer', amount: 690 },
      { id: uuid(), month, kind: 'fixed', label: 'Électricité', amount: 58 },
      { id: uuid(), month, kind: 'fixed', label: 'Box internet + mobile', amount: 37.98 },
      { id: uuid(), month, kind: 'fixed', label: 'Assurance habitation', amount: 18.5 },
      { id: uuid(), month, kind: 'fixed', label: 'Pass transport', amount: 43.6 },
      { id: uuid(), month, kind: 'fixed', label: 'Streaming musique', amount: 11.99 },
    );
    if (mi === 2) items.push({ id: uuid(), month, kind: 'income', label: 'Vente d’un meuble', amount: 120 });
    plans.push({
      month,
      savings_goal: 300,
      cat_budgets: { survie: 480, optionnel: 230, culture: 60, imprevus: 90 },
      reflection: {},
    });
  });

  return { expenses, items, months: plans };
}
