import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Plus, Trash2, Wand2 } from 'lucide-react';
import { useData } from '../state';
import { useNav } from '../nav';
import { CATEGORIES, catColor } from '../lib/kakeibo';
import { amountInput, currencySymbol, money, moneyRound, parseAmount } from '../lib/format';
import { monthLabel, shiftMonth } from '../lib/dates';
import { Card } from '../components/ui';
import { CategoryBadge } from '../components/CategoryIcon';
import { toast } from '../lib/toast';
import type { Category, ItemKind, MonthItem } from '../lib/types';

/** Champ de montant qui enregistre quand on quitte le champ (ou touche Entrée). */
export function MoneyInput({ value, onCommit, placeholder = '0', label, id }: { value: number | undefined; onCommit: (n: number | undefined) => void; placeholder?: string; label: string; id?: string }) {
  const [text, setText] = useState(amountInput(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(amountInput(value));
  }, [value, focused]);
  const commit = () => {
    setFocused(false);
    const t = text.trim();
    if (t === '') return value !== undefined && value !== 0 && onCommit(undefined);
    const n = parseAmount(t);
    if (!Number.isFinite(n) || n < 0) {
      toast('Montant invalide', 'error');
      setText(amountInput(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  return (
    <span className="money-input">
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="money-input-suffix">{currencySymbol()}</span>
    </span>
  );
}

export function Plan() {
  const { summary, saveMonth, copyFromPrevious, index } = useData();
  const { month } = useNav();
  const s = summary(month);
  const prev = summary(shiftMonth(month, -1));
  const hasPrevious = index.firstMonth !== null && index.firstMonth < month;
  const allocated = CATEGORIES.reduce((a, c) => a + (s.plan.cat_budgets[c.id] ?? 0), 0);

  const copy = async () => {
    const from = await copyFromPrevious(month);
    toast(from ? `Budget repris de ${monthLabel(from).toLowerCase()}` : 'Aucun mois précédent à copier', from ? 'success' : 'info');
  };

  const setCatBudget = (c: Category, n: number | undefined) => {
    const next = { ...s.plan.cat_budgets };
    if (n === undefined || n === 0) delete next[c];
    else next[c] = n;
    void saveMonth(month, { cat_budgets: next });
  };

  const suggest = () => {
    if (s.available <= 0) return toast('Renseigne d’abord tes revenus, charges fixes et objectif d’épargne.', 'info');
    // Répartition de départ : 60 % survie, 20 % envies, 10 % culture, 10 % imprévus (à ajuster selon tes habitudes).
    const split: Record<Category, number> = { survie: 0.6, optionnel: 0.2, culture: 0.1, imprevus: 0.1 };
    const next = Object.fromEntries(CATEGORIES.map((c) => [c.id, Math.floor((s.available * split[c.id]) / 5) * 5])) as Record<Category, number>;
    void saveMonth(month, { cat_budgets: next });
    toast('Répartition proposée : ajuste-la à ta guise', 'success');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Budget de {monthLabel(month).toLowerCase()}</h2>
          <p className="muted">Kakeibo commence avant de dépenser : combien tu gagnes, ce qui part d’office, ce que tu veux mettre de côté.</p>
        </div>
        {hasPrevious && (
          <div className="page-actions">
            <button type="button" className="btn btn-ghost" onClick={copy}>
              <Copy size={16} /> Reprendre le mois précédent
            </button>
          </div>
        )}
      </div>

      <section className="equation" aria-label="Calcul du budget variable">
        <div className="eq-term">
          <span>
            <i className="eq-sign" />
            Revenus
          </span>
          <strong>{money(s.income)}</strong>
        </div>
        <span className="eq-op">−</span>
        <div className="eq-term">
          <span>
            <i className="eq-sign">−</i>Charges fixes
          </span>
          <strong>{money(s.fixed)}</strong>
        </div>
        <span className="eq-op">−</span>
        <div className="eq-term">
          <span>
            <i className="eq-sign">−</i>Épargne visée
          </span>
          <strong>{money(s.savingsGoal)}</strong>
        </div>
        <span className="eq-op">=</span>
        <div className={`eq-term eq-result ${s.available < 0 ? 'negative' : ''}`}>
          <span>
            <i className="eq-sign">=</i>À dépenser
          </span>
          <strong>{money(s.available)}</strong>
        </div>
      </section>

      <div className="grid-2">
        <ItemList kind="income" title="Revenus" hint="Salaire, aides, revenus d’appoint…" items={s.incomes} month={month} total={s.income} />
        <ItemList kind="fixed" title="Charges fixes" hint="Loyer, abonnements, assurances, crédit…" items={s.fixedItems} month={month} total={s.fixed} />
      </div>

      <div className="grid-2">
        <Card title="Objectif d’épargne">
          <p className="muted">Ce que tu mets de côté dès le début du mois, avant toute dépense.</p>
          <div className="row-field">
            <MoneyInput label="Objectif d'épargne" value={s.savingsGoal || undefined} onCommit={(n) => void saveMonth(month, { savings_goal: n ?? 0 })} />
            {s.income > 0 && (
              <div className="chips">
                {[0.1, 0.15, 0.2].map((r) => (
                  <button type="button" key={r} className="chip" onClick={() => void saveMonth(month, { savings_goal: Math.round(s.income * r) })}>
                    {Math.round(r * 100)} % · {moneyRound(s.income * r)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {prev.goalReached !== null && (
            <p className="small muted">
              Le mois dernier : {money(prev.actualSavings)} épargnés pour un objectif de {money(prev.savingsGoal)} {prev.goalReached ? '✓' : '✗'}
            </p>
          )}
        </Card>

        <Card
          title="Budgets par catégorie"
          action={
            <button type="button" className="link-btn" onClick={suggest}>
              <Wand2 size={14} /> Répartition suggérée
            </button>
          }
        >
          <p className="muted">Facultatif : une limite pour chaque catégorie, pour savoir où tu en es en un coup d’œil.</p>
          <div className="cat-budgets">
            {CATEGORIES.map((c) => (
              <div key={c.id} className="cat-budget-row">
                <CategoryBadge category={c.id} size={30} />
                <label htmlFor={`budget-${c.id}`} className="cat-budget-name">
                  {c.label}
                  <small>{prev.byCat[c.id].spent > 0 ? `Mois dernier : ${moneyRound(prev.byCat[c.id].spent)}` : c.examples}</small>
                </label>
                <MoneyInput id={`budget-${c.id}`} label={`Budget ${c.label}`} placeholder="—" value={s.plan.cat_budgets[c.id]} onCommit={(n) => setCatBudget(c.id, n)} />
              </div>
            ))}
          </div>
          <div className={`allocation ${allocated > s.available && s.available > 0 ? 'over' : ''}`}>
            <div className="allocation-bar">
              {CATEGORIES.map((c) => (
                <span key={c.id} style={{ flexGrow: s.plan.cat_budgets[c.id] ?? 0, background: catColor(c.id) }} />
              ))}
              {s.available > allocated && <span className="allocation-rest" style={{ flexGrow: s.available - allocated }} />}
            </div>
            <p className="small">
              Réparti : <strong>{money(allocated)}</strong> sur {money(Math.max(0, s.available))}
              {s.available > 0 && allocated > s.available && ` · ${money(allocated - s.available)} de trop`}
              {s.available > 0 && allocated < s.available && allocated > 0 && ` · ${money(s.available - allocated)} non réparti`}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ItemList({ kind, title, hint, items, month, total }: { kind: ItemKind; title: string; hint: string; items: MonthItem[]; month: string; total: number }) {
  const { saveItem } = useData();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount);
    if (!Number.isFinite(n) || n <= 0) return toast('Indique un montant', 'error');
    setLabel('');
    setAmount('');
    await saveItem({ month, kind, label: label.trim() || (kind === 'income' ? 'Revenu' : 'Charge'), amount: n });
  };

  return (
    <Card title={title} action={<strong>{money(total)}</strong>}>
      <div className="items">
        {items.length === 0 && <p className="muted small">{hint}</p>}
        {items.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </div>
      <form className="item-add" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'income' ? 'Ex. Salaire' : 'Ex. Loyer'} aria-label="Libellé" maxLength={120} />
        <span className="money-input">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Montant" />
          <span className="money-input-suffix">{currencySymbol()}</span>
        </span>
        <button type="submit" className="btn btn-primary btn-icon" aria-label={`Ajouter ${kind === 'income' ? 'un revenu' : 'une charge fixe'}`}>
          <Plus size={18} />
        </button>
      </form>
    </Card>
  );
}

function ItemRow({ item }: { item: MonthItem }) {
  const { saveItem, deleteItem } = useData();
  const [label, setLabel] = useState(item.label);
  useEffect(() => setLabel(item.label), [item.label]);
  return (
    <div className="item-row">
      <input
        className="item-label"
        value={label}
        aria-label="Libellé"
        maxLength={120}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() !== item.label && void saveItem({ ...item, label: label.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <MoneyInput label={`Montant ${item.label}`} value={item.amount} onCommit={(n) => (n ? void saveItem({ ...item, amount: n }) : void deleteItem(item.id))} />
      <button type="button" className="icon-btn" onClick={() => void deleteItem(item.id)} aria-label={`Supprimer ${item.label}`}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
