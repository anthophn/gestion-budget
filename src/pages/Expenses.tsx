import { useMemo, useState } from 'react';
import { Download, Plus, Search, ReceiptText } from 'lucide-react';
import { useData } from '../state';
import { useNav } from '../nav';
import { CAT, CATEGORIES, catColor } from '../lib/kakeibo';
import { money } from '../lib/format';
import { dayLabel, monthLabel } from '../lib/dates';
import { Card, Empty } from '../components/ui';
import { ExpenseRow } from '../components/ExpenseRow';
import { CategoryBadge } from '../components/CategoryIcon';
import { downloadFile, expensesToCSV } from '../lib/exporter';

export function Expenses() {
  const { summary } = useData();
  const { month, filter, showCategory, openExpense } = useNav();
  const [query, setQuery] = useState('');
  const s = summary(month);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return s.expenses.filter((e) => (filter === 'all' || e.category === filter) && (!q || e.label.toLowerCase().includes(q) || e.note.toLowerCase().includes(q) || String(e.amount).includes(q)));
  }, [s.expenses, filter, query]);

  const groups = useMemo(() => {
    const out: { date: string; total: number; items: typeof list }[] = [];
    for (const e of list) {
      const last = out[out.length - 1];
      if (last && last.date === e.spent_on) {
        last.items.push(e);
        last.total += e.amount;
      } else out.push({ date: e.spent_on, total: e.amount, items: [e] });
    }
    return out;
  }, [list]);

  const total = list.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Dépenses</h2>
          <p className="muted">
            {list.length} dépense{list.length > 1 ? 's' : ''} · <strong className="ink">{money(total)}</strong>
            {filter !== 'all' && ` en ${CAT[filter].label}`}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" disabled={list.length === 0} onClick={() => downloadFile(`kakeibo-depenses-${month}.csv`, expensesToCSV(list), 'text/csv')}>
            <Download size={16} /> Exporter
          </button>
          <button type="button" className="btn btn-primary desktop-only" onClick={() => openExpense({ category: filter === 'all' ? undefined : filter })}>
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="chips" role="group" aria-label="Filtrer par catégorie">
          <button type="button" className={`chip ${filter === 'all' ? 'chip-active' : ''}`} onClick={() => showCategory('all')}>
            Toutes
          </button>
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={`chip ${filter === c.id ? 'chip-active' : ''}`} onClick={() => showCategory(c.id)}>
              <span className="legend-swatch" style={{ background: catColor(c.id) }} />
              {c.label}
              <span className="chip-count">{s.byCat[c.id].count}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher une dépense" />
        </label>
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty
            icon={<ReceiptText size={32} />}
            title={s.count === 0 ? `Aucune dépense en ${monthLabel(month).toLowerCase()}` : 'Aucune dépense ne correspond'}
            action={
              <button type="button" className="btn btn-primary" onClick={() => openExpense({ category: filter === 'all' ? undefined : filter })}>
                <Plus size={16} /> Ajouter une dépense
              </button>
            }
          >
            Chaque dépense va dans une des 4 catégories : Survie, Optionnel, Culture ou Imprévus.
          </Empty>
        </Card>
      ) : (
        <>
          {/* Version mobile : liste groupée par jour */}
          <div className="day-groups mobile-only">
            {groups.map((g) => (
              <section key={g.date} className="day-group">
                <h3 className="day-head">
                  <span>{dayLabel(g.date)}</span>
                  <span>−{money(g.total)}</span>
                </h3>
                <div className="card expense-list">
                  {g.items.map((e) => (
                    <ExpenseRow key={e.id} e={e} showDate={false} onClick={() => openExpense({ expense: e })} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Version PC : tableau */}
          <Card className="desktop-only table-card">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th>Note</th>
                  <th className="num">Montant</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} onClick={() => openExpense({ expense: e })} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && openExpense({ expense: e })}>
                    <td className="nowrap">{dayLabel(e.spent_on)}</td>
                    <td>{e.label || <span className="muted">—</span>}</td>
                    <td>
                      <span className="cat-inline">
                        <CategoryBadge category={e.category} size={22} />
                        {CAT[e.category].label}
                      </span>
                    </td>
                    <td className="muted truncate">{e.note}</td>
                    <td className="num strong">−{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
