import { CAT, CAT_IDS, type MonthSummary } from './kakeibo';
import { money, moneyRound, pct } from './format';
import { WEEKDAYS, monthLabel, shortDate, weekdayIndex } from './dates';

export type Tone = 'bad' | 'warn' | 'good' | 'info';

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  text: string;
}

const ORDER: Record<Tone, number> = { bad: 0, warn: 1, good: 2, info: 3 };

/**
 * Analyse automatique d'un mois : dépassements, rythme de dépense, comparaison avec le mois précédent,
 * régularité de l'épargne, habitudes… `history` contient les mois précédents (du plus ancien au plus récent).
 */
export function buildInsights(cur: MonthSummary, history: MonthSummary[]): Insight[] {
  const out: Insight[] = [];
  const prev = history.length ? history[history.length - 1] : null;

  if (!cur.hasPlan) {
    out.push({
      id: 'no-plan',
      tone: 'info',
      title: 'Prépare ton mois',
      text: 'Renseigne tes revenus, tes charges fixes et ton objectif d’épargne dans « Budget du mois » pour connaître ce que tu peux dépenser.',
    });
  }

  // Budget variable global
  if (cur.hasPlan && cur.available > 0) {
    if (cur.spent > cur.available) {
      out.push({ id: 'over', tone: 'bad', title: 'Budget du mois dépassé', text: `Tu as dépensé ${money(cur.spent - cur.available)} de plus que ton budget variable. Ton objectif d’épargne est entamé.` });
    } else if (cur.isCurrent && cur.daysElapsed >= 3) {
      const gap = cur.available - cur.projectedSpent;
      if (gap < 0) {
        out.push({ id: 'pace', tone: 'warn', title: 'Rythme trop rapide', text: `À ce rythme, tu dépasseras ton budget d’environ ${moneyRound(-gap)} d’ici la fin du mois. Vise ${money(cur.perDayLeft ?? 0)} par jour maximum.` });
      } else {
        out.push({ id: 'pace', tone: 'good', title: 'Bon rythme', text: `À ce rythme, il te restera environ ${moneyRound(gap)} à la fin du mois, en plus de ton épargne prévue.` });
      }
    } else if (cur.isPast) {
      out.push({ id: 'under', tone: 'good', title: 'Budget respecté', text: `Tu as terminé le mois avec ${money(cur.remaining)} de marge sur ton budget variable.` });
    }
  } else if (cur.hasPlan && cur.available <= 0) {
    out.push({ id: 'negative', tone: 'bad', title: 'Budget variable négatif', text: 'Tes charges fixes et ton objectif d’épargne dépassent tes revenus. Revois ton objectif ou tes charges fixes.' });
  }

  // Budgets par catégorie
  for (const c of CAT_IDS) {
    const st = cur.byCat[c];
    if (!st.budget) continue;
    if (st.spent > st.budget) {
      out.push({ id: `cat-over-${c}`, tone: 'bad', title: `${CAT[c].label} : budget dépassé`, text: `${money(st.spent)} dépensés pour un budget de ${money(st.budget)} (+${money(st.spent - st.budget)}).` });
    } else if (cur.isCurrent && st.spent >= st.budget * 0.8) {
      out.push({ id: `cat-warn-${c}`, tone: 'warn', title: `${CAT[c].label} : bientôt au maximum`, text: `${pct(st.spent / st.budget)} du budget déjà utilisé, il reste ${cur.daysLeft} jour${cur.daysLeft > 1 ? 's' : ''}.` });
    }
  }

  // Comparaison avec le mois précédent (au même jour pour le mois en cours)
  if (prev && prev.count > 0 && cur.count > 0) {
    const day = cur.isCurrent ? cur.daysElapsed : 31;
    const prevSpent = prev.expenses.filter((e) => Number(e.spent_on.slice(8, 10)) <= day).reduce((a, e) => a + e.amount, 0);
    if (prevSpent > 0) {
      const delta = (cur.spent - prevSpent) / prevSpent;
      const when = cur.isCurrent ? `au ${day} ${monthLabel(prev.month, false).toLowerCase()}` : `en ${monthLabel(prev.month, false).toLowerCase()}`;
      if (delta > 0.1) {
        out.push({ id: 'vs-prev', tone: 'warn', title: `+${pct(delta)} par rapport au mois dernier`, text: `Tu as dépensé ${money(cur.spent)} contre ${money(prevSpent)} ${when}.` });
      } else if (delta < -0.1) {
        out.push({ id: 'vs-prev', tone: 'good', title: `${pct(delta)} par rapport au mois dernier`, text: `Tu as dépensé ${money(cur.spent)} contre ${money(prevSpent)} ${when}. Bravo !` });
      }
    }
    // Catégorie qui progresse le plus
    if (!cur.isCurrent) {
      let best: { c: (typeof CAT_IDS)[number]; diff: number; ratio: number } | null = null;
      for (const c of CAT_IDS) {
        const a = prev.byCat[c].spent;
        const b = cur.byCat[c].spent;
        const diff = b - a;
        if (a > 0 && diff > 20 && diff / a > 0.15 && (!best || diff > best.diff)) best = { c, diff, ratio: diff / a };
      }
      if (best) {
        out.push({ id: 'cat-up', tone: 'info', title: `${CAT[best.c].label} en hausse`, text: `+${money(best.diff)} (+${pct(best.ratio)}) par rapport à ${monthLabel(prev.month, false).toLowerCase()}.` });
      }
    }
  }

  // Régularité de l'épargne
  const past = [...history.filter((h) => h.goalReached !== null), ...(cur.goalReached !== null ? [cur] : [])];
  if (past.length >= 2) {
    let streak = 0;
    for (let i = past.length - 1; i >= 0 && past[i].goalReached; i--) streak++;
    const reached = past.filter((h) => h.goalReached).length;
    if (streak >= 2) {
      out.push({ id: 'streak', tone: 'good', title: `${streak} mois d’affilée`, text: `Tu as atteint ton objectif d’épargne ${streak} mois de suite. Continue !` });
    } else {
      out.push({ id: 'goal-rate', tone: reached / past.length >= 0.5 ? 'info' : 'warn', title: `Objectif atteint ${reached} mois sur ${past.length}`, text: 'Un objectif plus réaliste vaut mieux qu’un objectif jamais atteint : ajuste-le si besoin.' });
    }
  }

  // Habitudes
  if (cur.count > 0) {
    const top = [...cur.expenses].sort((a, b) => b.amount - a.amount)[0];
    out.push({ id: 'top', tone: 'info', title: 'Plus grosse dépense', text: `${top.label || CAT[top.category].label} : ${money(top.amount)} le ${shortDate(top.spent_on)} (${CAT[top.category].label}).` });
  }

  const recent = [...history.slice(-2), cur].flatMap((h) => h.expenses);
  if (recent.length >= 12) {
    const byDay = Array(7).fill(0) as number[];
    for (const e of recent) byDay[weekdayIndex(e.spent_on)] += e.amount;
    const total = byDay.reduce((a, b) => a + b, 0);
    const maxDay = byDay.indexOf(Math.max(...byDay));
    if (total > 0 && byDay[maxDay] / total > 0.2) {
      out.push({ id: 'weekday', tone: 'info', title: `Le ${WEEKDAYS[maxDay]}, jour le plus dépensier`, text: `${pct(byDay[maxDay] / total)} de tes dépenses récentes tombent un ${WEEKDAYS[maxDay]}. Prévois ce jour-là à l’avance.` });
    }
  }

  const withData = [...history, cur].filter((h) => h.count > 0);
  if (withData.length >= 2) {
    const avgOpt = withData.reduce((a, h) => a + h.byCat.optionnel.spent, 0) / withData.length;
    if (avgOpt > 30) {
      out.push({ id: 'save-opt', tone: 'info', title: 'Piste d’économie', text: `Réduire tes dépenses Optionnel de 10 % te ferait économiser environ ${moneyRound(avgOpt * 0.1 * 12)} par an.` });
    }
    const avgImp = withData.reduce((a, h) => a + h.byCat.imprevus.spent, 0) / withData.length;
    const avgAll = withData.reduce((a, h) => a + h.spent, 0) / withData.length;
    if (avgAll > 0 && avgImp / avgAll > 0.15) {
      out.push({ id: 'buffer', tone: 'info', title: 'Prévois les imprévus', text: `Les imprévus pèsent ${pct(avgImp / avgAll)} de tes dépenses. Mets environ ${moneyRound(avgImp)} de côté chaque mois pour les absorber.` });
    }
  }

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

/** Pistes d'amélioration proposées dans le bilan mensuel. */
export function improvementTips(cur: MonthSummary): string[] {
  const tips: string[] = [];
  const over = CAT_IDS.filter((c) => cur.byCat[c].budget && cur.byCat[c].spent > (cur.byCat[c].budget as number));
  for (const c of over) tips.push(`Ton budget ${CAT[c].label} a été dépassé : fixe-toi une limite hebdomadaire de ${moneyRound((cur.byCat[c].budget as number) / 4.3)}.`);
  if (cur.byCat.optionnel.share > 0.35) tips.push('Plus d’un tiers de tes dépenses sont des envies : essaie la règle des 48 h avant chaque achat non essentiel.');
  if (cur.byCat.imprevus.share > 0.15) tips.push('Beaucoup d’imprévus ce mois-ci : une petite épargne de précaution t’aidera à les absorber sans stress.');
  if (cur.byCat.culture.spent === 0 && cur.count > 0) tips.push('Aucune dépense Culture : la bibliothèque, les musées gratuits ou les podcasts sont de bonnes options.');
  if (cur.goalReached === false) tips.push('Objectif d’épargne manqué : vire ton épargne dès la réception du salaire plutôt qu’en fin de mois.');
  if (!cur.hasPlan) tips.push('Commence le mois prochain en renseignant revenus, charges fixes et objectif d’épargne dès le premier jour.');
  if (tips.length === 0) tips.push('Très beau mois ! Tu peux relever légèrement ton objectif d’épargne le mois prochain.');
  return tips;
}
