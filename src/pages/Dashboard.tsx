import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarRange, CircleAlert, CircleCheck, Copy, Lightbulb, PiggyBank, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useData } from '../state';
import { useNav } from '../nav';
import { CATEGORIES, CAT_IDS, budgetStatus, catColor } from '../lib/kakeibo';
import { buildInsights, type Insight } from '../lib/insights';
import { money, moneyRound, pct } from '../lib/format';
import { monthLabel, monthRange, shiftMonth, shortDate, todayISO } from '../lib/dates';
import { Card, Empty, Meter, StatusPill } from '../components/ui';
import { ColumnChart, Donut, Legend } from '../components/charts';
import { CategoryBadge } from '../components/CategoryIcon';
import { ExpenseRow } from '../components/ExpenseRow';
import { toast } from '../lib/toast';

export function Dashboard() {
  const { summary, copyFromPrevious, index } = useData();
  const { month, go, openExpense, showCategory } = useNav();
  const s = summary(month);
  const history = useMemo(() => monthRange(shiftMonth(month, -1), 5).map(summary), [month, summary]);
  const insights = useMemo(() => buildInsights(s, history).filter((i) => i.id !== 'no-plan'), [s, history]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const hasPrevious = index.firstMonth !== null && index.firstMonth < month;
  const status = budgetStatus(s.spent, s.available > 0 ? s.available : null, s);

  const copy = async () => {
    const from = await copyFromPrevious(month);
    if (from) toast(`Budget repris de ${monthLabel(from).toLowerCase()}`, 'success');
    else toast('Aucun mois précédent à copier', 'info');
  };

  return (
    <div className="page dashboard">
      {/* Carte principale : ce qu'il reste à dépenser */}
      {s.hasPlan ? (
        <section className={`hero hero-${status}`}>
          <div className="hero-top">
            <div>
              <p className="hero-kicker">{s.isPast ? 'Mois terminé · reste sur le budget' : s.isFuture ? 'Budget prévu' : 'Reste à dépenser ce mois-ci'}</p>
              <p className={`hero-figure ${s.remaining < 0 ? 'negative' : ''}`}>{money(s.remaining)}</p>
              <p className="hero-sub">
                {money(s.spent)} dépensés sur {money(Math.max(0, s.available))} de budget variable
              </p>
            </div>
            {s.perDayLeft !== null && s.available > 0 && (
              <div className="hero-perday">
                <CalendarRange size={18} aria-hidden />
                <span>
                  <strong>{money(s.perDayLeft)}</strong> par jour
                  <small>
                    pendant {s.daysLeft} jour{s.daysLeft > 1 ? 's' : ''}
                  </small>
                </span>
              </div>
            )}
          </div>
          <Meter value={s.spent} max={Math.max(s.available, 0.01)} status={status === 'none' ? 'ok' : status} label="Budget variable utilisé" />
          {s.isCurrent && s.available > 0 && (
            <div className="hero-pace" style={{ left: `${Math.min(100, (s.daysElapsed / s.daysInMonth) * 100)}%` }} title="Où tu devrais en être aujourd’hui">
              <span>aujourd’hui</span>
            </div>
          )}
        </section>
      ) : (
        <section className="hero hero-setup">
          <div>
            <p className="hero-kicker">{monthLabel(month)}</p>
            <h2>Prépare ton mois en 2 minutes</h2>
            <p className="muted">
              La méthode Kakeibo commence par 4 chiffres : tes revenus, tes charges fixes, ton objectif d’épargne… et ce qu’il te reste à dépenser.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => go('plan')}>
              <Wallet size={18} /> Définir mon budget
            </button>
            {hasPrevious && (
              <button type="button" className="btn btn-ghost" onClick={copy}>
                <Copy size={18} /> Reprendre le mois précédent
              </button>
            )}
          </div>
        </section>
      )}

      {/* Les 4 chiffres du mois */}
      {s.hasPlan && (
        <div className="kpis">
          <Kpi label="Revenus" value={money(s.income)} icon={<TrendingUp size={18} />} onClick={() => go('plan')} />
          <Kpi label="Charges fixes" value={money(s.fixed)} icon={<TrendingDown size={18} />} onClick={() => go('plan')} />
          <Kpi label="Objectif d’épargne" value={money(s.savingsGoal)} icon={<PiggyBank size={18} />} onClick={() => go('plan')} />
          <Kpi
            label={s.isCurrent ? 'Épargne prévue (au rythme actuel)' : 'Épargne réelle'}
            value={money(s.isCurrent ? s.income - s.fixed - s.projectedSpent : s.actualSavings)}
            icon={(s.isCurrent ? s.income - s.fixed - s.projectedSpent : s.actualSavings) >= s.savingsGoal ? <CircleCheck size={18} className="good-text" /> : <CircleAlert size={18} className="bad-text" />}
            onClick={() => go('review')}
          />
        </div>
      )}

      {/* Les 4 catégories Kakeibo */}
      <div className="cats">
        {CATEGORIES.map((c) => {
          const st = s.byCat[c.id];
          const stStatus = budgetStatus(st.spent, st.budget, s);
          return (
            <button type="button" key={c.id} className="cat-card" onClick={() => showCategory(c.id)}>
              <div className="cat-card-head">
                <CategoryBadge category={c.id} size={32} />
                <span className="cat-card-name">
                  {c.label}
                  <small>{c.hint}</small>
                </span>
              </div>
              <div className="cat-card-figure">
                {money(st.spent)}
                {st.budget && <small> / {moneyRound(st.budget)}</small>}
              </div>
              {st.budget && <Meter value={st.spent} max={st.budget} status={stStatus} label={`Budget ${c.label}`} />}
              <div className="cat-card-foot">
                <StatusPill status={stStatus} />
                <span>
                  {st.count} dépense{st.count > 1 ? 's' : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid-2">
        <Card title="Semaine par semaine" action={<span className="muted small">Budget hebdo : {s.available > 0 ? moneyRound(s.available / (s.daysInMonth / 7)) : '—'}</span>}>
          <ColumnChart
            ariaLabel="Dépenses par semaine comparées au budget de la semaine"
            labels={s.weeks.map((w) => `S${w.index}`)}
            sublabels={s.weeks.map((w) => (w.start === w.end ? `${Number(w.start.slice(8))}` : `${Number(w.start.slice(8))}–${Number(w.end.slice(8))}`))}
            series={[{ key: 'spent', label: 'Dépensé', color: 'var(--viz-accent)', values: s.weeks.map((w) => w.spent) }]}
            marker={s.available > 0 ? { label: 'Budget de la semaine', values: s.weeks.map((w) => w.budget) } : undefined}
            barColor={(i) => (s.weeks[i].budget > 0 && s.weeks[i].spent > s.weeks[i].budget ? 'var(--bad)' : undefined)}
            highlight={s.isCurrent ? s.weeks.findIndex((w) => w.start <= todayISO() && w.end >= todayISO()) : undefined}
            tooltip={(i) => {
              const w = s.weeks[i];
              return (
                <>
                  <strong>
                    Semaine {w.index} · {shortDate(w.start)} – {shortDate(w.end)}
                  </strong>
                  <span>Dépensé : {money(w.spent)}</span>
                  {w.budget > 0 && <span>Budget : {money(w.budget)}</span>}
                  {w.budget > 0 && <span className={w.spent > w.budget ? 'bad-text' : 'good-text'}>{w.spent > w.budget ? `Dépassement : ${money(w.spent - w.budget)}` : `Marge : ${money(w.budget - w.spent)}`}</span>}
                </>
              );
            }}
          />
          <Legend
            items={[
              { label: 'Dépensé', color: 'var(--viz-accent)' },
              ...(s.available > 0 ? [{ label: 'Au-dessus du budget', color: 'var(--bad)' }, { label: 'Budget de la semaine', kind: 'marker' as const }] : []),
            ]}
          />
        </Card>

        <Card title="Répartition des dépenses">
          {s.count === 0 ? (
            <Empty title="Aucune dépense ce mois-ci" action={<button type="button" className="btn btn-primary" onClick={() => openExpense()}><Plus size={18} /> Ajouter une dépense</button>} />
          ) : (
            <div className="donut-wrap">
              <Donut
                slices={CAT_IDS.map((c) => ({ key: c, label: CATEGORIES.find((x) => x.id === c)!.label, value: s.byCat[c].spent, color: catColor(c) }))}
                center={moneyRound(s.spent)}
                sub={`${s.count} dépense${s.count > 1 ? 's' : ''}`}
                active={activeCat}
                onActive={setActiveCat}
              />
              <ul className="donut-legend">
                {CATEGORIES.map((c) => (
                  <li key={c.id} className={activeCat && activeCat !== c.id ? 'dim' : ''} onMouseEnter={() => setActiveCat(c.id)} onMouseLeave={() => setActiveCat(null)}>
                    <span className="legend-swatch" style={{ background: catColor(c.id) }} />
                    <span className="donut-legend-name">{c.label}</span>
                    <span className="donut-legend-value">{money(s.byCat[c.id].spent)}</span>
                    <span className="donut-legend-pct">{pct(s.byCat[c.id].share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Dernières dépenses"
          action={
            s.count > 0 && (
              <button type="button" className="link-btn" onClick={() => showCategory('all')}>
                Tout voir <ArrowRight size={14} />
              </button>
            )
          }
        >
          {s.count === 0 ? (
            <p className="muted">Ajoute ta première dépense avec le bouton +. Astuce : sur PC, appuie sur la touche N.</p>
          ) : (
            <div className="expense-list">
              {s.expenses.slice(0, 6).map((e) => (
                <ExpenseRow key={e.id} e={e} onClick={() => openExpense({ expense: e })} />
              ))}
            </div>
          )}
        </Card>

        <Card
          title={
            <>
              <Lightbulb size={18} /> Analyse express
            </>
          }
          action={
            <button type="button" className="link-btn" onClick={() => go('analysis')}>
              Analyse complète <ArrowRight size={14} />
            </button>
          }
        >
          {insights.length === 0 ? <p className="muted">Ajoute quelques dépenses pour obtenir une analyse de ton budget.</p> : <InsightList items={insights.slice(0, 4)} />}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, onClick }: { label: string; value: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="kpi" onClick={onClick}>
      <span className="kpi-label">
        {icon}
        {label}
      </span>
      <span className="kpi-value">{value}</span>
    </button>
  );
}

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <ul className="insights">
      {items.map((i) => (
        <li key={i.id} className={`insight insight-${i.tone}`}>
          <span className="insight-dot" aria-hidden />
          <div>
            <strong>{i.title}</strong>
            <p>{i.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
