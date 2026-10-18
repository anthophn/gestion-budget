import { useMemo, useState } from 'react';
import { Award, CircleCheck, CircleX } from 'lucide-react';
import { useData } from '../state';
import { useNav } from '../nav';
import { CAT, CATEGORIES, budgetStatus, catColor, kakeiboScore, type BudgetStatus, type MonthSummary } from '../lib/kakeibo';
import { buildInsights } from '../lib/insights';
import { money, moneyRound, pct } from '../lib/format';
import { WEEKDAYS, WEEKDAYS_SHORT, monthAxis, monthLabel, monthRange, monthShort, shiftMonth, shortDate, weekdayIndex } from '../lib/dates';
import { Card, Empty } from '../components/ui';
import { ColumnChart, Legend } from '../components/charts';
import { CategoryBadge } from '../components/CategoryIcon';
import { InsightList } from './Dashboard';

const PERIODS = [3, 6, 12] as const;

export function Analysis() {
  const { summary } = useData();
  const { month, setMonth, openExpense } = useNav();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(6);

  const months = useMemo(() => monthRange(month, period), [month, period]);
  const sums = useMemo(() => months.map(summary), [months, summary]);
  const cur = sums[sums.length - 1];
  const history = useMemo(() => monthRange(shiftMonth(month, -1), 5).map(summary), [month, summary]);
  const insights = useMemo(() => buildInsights(cur, history), [cur, history]);
  const score = kakeiboScore(cur);
  const withData = sums.filter((s) => s.count > 0 || s.hasPlan);
  const allExpenses = useMemo(() => sums.flatMap((s) => s.expenses), [sums]);
  const axis = useMemo(() => monthAxis(months), [months]);

  const weekday = useMemo(() => {
    const totals = Array(7).fill(0) as number[];
    for (const e of allExpenses) totals[weekdayIndex(e.spent_on)] += e.amount;
    return totals;
  }, [allExpenses]);

  if (withData.length === 0) {
    return (
      <div className="page">
        <PageHead period={period} setPeriod={setPeriod} month={month} />
        <Card>
          <Empty icon={<Award size={32} />} title="Pas encore de données à analyser">
            Renseigne ton budget du mois et ajoute quelques dépenses : l’analyse se remplit automatiquement. Tu peux aussi charger des données d’exemple dans Réglages.
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead period={period} setPeriod={setPeriod} month={month} />

      <div className="grid-2 grid-score">
        <Card title={`Score Kakeibo · ${monthLabel(month).toLowerCase()}`}>
          {score ? (
            <div className="score">
              <ScoreRing value={score.score} />
              <ul className="score-parts">
                {score.parts.map((p) => (
                  <li key={p.label}>
                    <div className="score-part-head">
                      <strong>{p.label}</strong>
                      <span>
                        {p.points} / {p.max}
                      </span>
                    </div>
                    <div className="meter meter-neutral">
                      <div className="meter-fill" style={{ width: `${(p.points / p.max) * 100}%` }} />
                    </div>
                    <small className="muted">{p.detail}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">Pas assez de données ce mois-ci.</p>
          )}
        </Card>
        <Card title="Ce que disent tes chiffres">
          <InsightList items={insights} />
        </Card>
      </div>

      <Card title="Tous tes budgets, mois par mois" className="table-card">
        <p className="muted small card-intro">Part du budget utilisée. Pour l’épargne : part de l’objectif atteinte (≈ = projection du mois en cours). Clique sur un mois pour l’ouvrir.</p>
        <div className="table-scroll">
          <table className="table budget-grid">
            <thead>
              <tr>
                <th>Budget</th>
                {sums.map((s) => (
                  <th key={s.month} className="num">
                    <button type="button" className="link-btn" onClick={() => setMonth(s.month)}>
                      {monthShort(s.month)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Budget variable</th>
                {sums.map((s) => (
                  <GridCell key={s.month} spent={s.spent} budget={s.available > 0 ? s.available : null} status={budgetStatus(s.spent, s.available > 0 ? s.available : null, s)} />
                ))}
              </tr>
              {CATEGORIES.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <span className="cat-inline">
                      <span className="legend-swatch" style={{ background: catColor(c.id) }} />
                      {c.label}
                    </span>
                  </th>
                  {sums.map((s) => (
                    <GridCell key={s.month} spent={s.byCat[c.id].spent} budget={s.byCat[c.id].budget} status={budgetStatus(s.byCat[c.id].spent, s.byCat[c.id].budget, s)} />
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Épargne</th>
                {sums.map((s) => (
                  <SavingsCell key={s.month} s={s} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Dépenses par catégorie">
          <ColumnChart
            ariaLabel="Dépenses variables par mois, empilées par catégorie, avec le budget variable"
            labels={axis.labels}
            sublabels={axis.sublabels}
            series={CATEGORIES.map((c) => ({ key: c.id, label: c.label, color: catColor(c.id), values: sums.map((s) => s.byCat[c.id].spent) }))}
            marker={{ label: 'Budget variable', values: sums.map((s) => (s.available > 0 ? s.available : null)) }}
            highlight={sums.length - 1}
            onSelect={(i) => setMonth(sums[i].month)}
            tooltip={(i) => {
              const s = sums[i];
              return (
                <>
                  <strong>{monthLabel(s.month)}</strong>
                  {[...CATEGORIES].reverse().map((c) => (
                    <span key={c.id} className="tt-row">
                      <span className="legend-swatch" style={{ background: catColor(c.id) }} />
                      {c.label}
                      <b>{money(s.byCat[c.id].spent)}</b>
                    </span>
                  ))}
                  <span className="tt-total">
                    Total <b>{money(s.spent)}</b>
                  </span>
                  {s.available > 0 && <span className="muted">Budget variable : {money(s.available)}</span>}
                </>
              );
            }}
          />
          <Legend items={[...CATEGORIES.map((c) => ({ label: c.label, color: catColor(c.id) })), { label: 'Budget variable', kind: 'marker' as const }]} />
        </Card>

        <Card title="Épargne réelle et objectif">
          <ColumnChart
            ariaLabel="Épargne réelle par mois comparée à l'objectif d'épargne"
            labels={axis.labels}
            sublabels={axis.sublabels}
            series={[{ key: 'savings', label: 'Épargne réelle', color: 'var(--viz-accent)', values: sums.map((s) => (s.hasPlan && !s.isFuture ? projectedSavings(s) : 0)) }]}
            marker={{ label: 'Objectif', values: sums.map((s) => (s.savingsGoal > 0 ? s.savingsGoal : null)) }}
            highlight={sums.length - 1}
            onSelect={(i) => setMonth(sums[i].month)}
            tooltip={(i) => {
              const s = sums[i];
              return (
                <>
                  <strong>{monthLabel(s.month)}</strong>
                  {s.hasPlan ? (
                    <>
                      <span>
                        Épargne {s.isCurrent ? 'prévue (au rythme actuel)' : 'réelle'} : {money(projectedSavings(s))}
                      </span>
                      <span>Objectif : {money(s.savingsGoal)}</span>
                      <span>Taux d’épargne : {pct(s.savingsRate)}</span>
                    </>
                  ) : (
                    <span className="muted">Budget du mois non renseigné</span>
                  )}
                </>
              );
            }}
          />
          <Legend items={[{ label: 'Épargne réelle (projection pour le mois en cours)', color: 'var(--viz-accent)' }, { label: 'Objectif', kind: 'marker' }]} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Moyennes sur la période">
          <table className="table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th className="num">Par mois</th>
                <th className="num">Part</th>
                <th className="num">Mois max</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const active = sums.filter((s) => s.count > 0);
                const total = active.reduce((a, s) => a + s.byCat[c.id].spent, 0);
                const all = active.reduce((a, s) => a + s.spent, 0);
                const max = active.reduce((best, s) => (s.byCat[c.id].spent > (best?.byCat[c.id].spent ?? -1) ? s : best), null as MonthSummary | null);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="cat-inline">
                        <CategoryBadge category={c.id} size={22} />
                        {c.label}
                      </span>
                    </td>
                    <td className="num strong">{active.length ? moneyRound(total / active.length) : '—'}</td>
                    <td className="num">{all > 0 ? pct(total / all) : '—'}</td>
                    <td className="num muted">{max && max.byCat[c.id].spent > 0 ? `${monthShort(max.month)} · ${moneyRound(max.byCat[c.id].spent)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Jours où tu dépenses le plus">
          <ColumnChart
            ariaLabel="Total des dépenses par jour de la semaine sur la période"
            labels={WEEKDAYS_SHORT}
            series={[{ key: 'dow', label: 'Dépenses', color: 'var(--viz-accent)', values: weekday }]}
            height={190}
            highlight={weekday.indexOf(Math.max(...weekday))}
            tooltip={(i) => (
              <>
                <strong>Le {WEEKDAYS[i]}</strong>
                <span>{money(weekday[i])} sur la période</span>
                <span>{pct(weekday[i] / Math.max(1, weekday.reduce((a, b) => a + b, 0)))} des dépenses</span>
              </>
            )}
          />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Plus grosses dépenses de la période">
          {allExpenses.length === 0 ? (
            <p className="muted">Aucune dépense sur la période.</p>
          ) : (
            <ol className="top-list">
              {[...allExpenses]
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 6)
                .map((e) => (
                  <li key={e.id}>
                    <button type="button" className="top-row" onClick={() => openExpense({ expense: e })}>
                      <CategoryBadge category={e.category} size={28} />
                      <span className="expense-main">
                        <span className="expense-label">{e.label || CAT[e.category].label}</span>
                        <span className="expense-sub">
                          {shortDate(e.spent_on)} {e.spent_on.slice(0, 4)} · {CAT[e.category].label}
                        </span>
                      </span>
                      <span className="expense-amount">{money(e.amount)}</span>
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </Card>

        <Card title="Récapitulatif mensuel" className="table-card">
          <div className="table-scroll">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className="num">Revenus</th>
                  <th className="num">Fixes</th>
                  <th className="num">Variables</th>
                  <th className="num">Épargne</th>
                  <th className="num">Obj.</th>
                </tr>
              </thead>
              <tbody>
                {[...sums].reverse().map((s) => (
                  <tr key={s.month}>
                    <td className="nowrap">{monthShort(s.month)}</td>
                    <td className="num">{moneyRound(s.income)}</td>
                    <td className="num">{moneyRound(s.fixed)}</td>
                    <td className="num">{moneyRound(s.spent)}</td>
                    <td className="num strong">
                      {s.hasPlan ? moneyRound(s.actualSavings) : '—'}
                      {s.hasPlan && s.income > 0 && <small className="muted block">{pct(s.savingsRate)}</small>}
                    </td>
                    <td className="num">
                      {s.goalReached === null ? (
                        <span className="muted">{s.isCurrent ? 'en cours' : '—'}</span>
                      ) : s.goalReached ? (
                        <span className="good-text icon-text" title="Objectif atteint">
                          <CircleCheck size={16} aria-label="Objectif atteint" />
                        </span>
                      ) : (
                        <span className="bad-text icon-text" title="Objectif manqué">
                          <CircleX size={16} aria-label="Objectif manqué" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PageHead({ period, setPeriod, month }: { period: number; setPeriod: (p: (typeof PERIODS)[number]) => void; month: string }) {
  return (
    <div className="page-head">
      <div>
        <h2 className="page-title">Analyse</h2>
        <p className="muted">
          {monthLabel(shiftMonth(month, -period + 1))} → {monthLabel(month)}
        </p>
      </div>
      <div className="segmented" role="tablist" aria-label="Période">
        {PERIODS.map((p) => (
          <button type="button" key={p} role="tab" aria-selected={period === p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
            {p} mois
          </button>
        ))}
      </div>
    </div>
  );
}

/** Épargne de fin de mois : réelle pour un mois terminé, projetée au rythme actuel pour le mois en cours. */
const projectedSavings = (s: MonthSummary) => (s.isCurrent ? s.income - s.fixed - s.projectedSpent : s.actualSavings);

const STATUS_TEXT: Record<BudgetStatus, string> = { none: '', ok: 'OK', warn: 'Attention', over: 'Dépassé' };

function GridCell({ spent, budget, status }: { spent: number; budget: number | null; status: BudgetStatus }) {
  if (!budget) {
    return (
      <td className="num grid-cell grid-none" title={spent > 0 ? `${money(spent)} dépensés, pas de budget fixé` : 'Aucune dépense'}>
        {spent > 0 ? moneyRound(spent) : '—'}
      </td>
    );
  }
  return (
    <td className={`num grid-cell grid-${status}`} title={`${money(spent)} sur ${money(budget)} · ${STATUS_TEXT[status]}`}>
      <strong>{pct(spent / budget)}</strong>
      <small>{moneyRound(spent)}</small>
    </td>
  );
}

function SavingsCell({ s }: { s: MonthSummary }) {
  if (!s.hasPlan || s.savingsGoal <= 0 || s.isFuture) return <td className="num grid-cell grid-none">{s.hasPlan && !s.isFuture ? moneyRound(s.actualSavings) : '—'}</td>;
  const projected = projectedSavings(s);
  const ratio = projected / s.savingsGoal;
  const status: BudgetStatus = ratio >= 1 ? 'ok' : ratio >= 0.75 ? 'warn' : 'over';
  return (
    <td className={`num grid-cell grid-${status}`} title={`${money(projected)} pour un objectif de ${money(s.savingsGoal)}`}>
      <strong>
        {s.isCurrent ? '≈ ' : ''}
        {pct(Math.max(0, ratio))}
      </strong>
      <small>{moneyRound(projected)}</small>
    </td>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? 'good' : value >= 45 ? 'warn' : 'bad';
  const label = value >= 85 ? 'Excellent' : value >= 70 ? 'Très bien' : value >= 45 ? 'Peut mieux faire' : 'À redresser';
  return (
    <div className={`score-ring score-${tone}`}>
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Score ${value} sur 100, ${label}`}>
        <circle cx="66" cy="66" r={r} className="score-track" />
        <circle cx="66" cy="66" r={r} className="score-value" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 66 66)" />
        <text x="66" y="70" textAnchor="middle" className="score-number">
          {value}
        </text>
        <text x="66" y="90" textAnchor="middle" className="score-max">
          / 100
        </text>
      </svg>
      <span className="score-label">{label}</span>
    </div>
  );
}

