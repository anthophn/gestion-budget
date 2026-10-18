import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, ask } from './ui';
import { CategoryIcon } from './CategoryIcon';
import { useData } from '../state';
import { CATEGORIES, catColor, defaultExpenseDate } from '../lib/kakeibo';
import { amountInput, currencySymbol, parseAmount } from '../lib/format';
import { toast } from '../lib/toast';
import type { Category, Expense } from '../lib/types';

export interface ExpenseDraft {
  expense?: Expense;
  category?: Category;
}

export function ExpenseForm({ draft, month, onClose }: { draft: ExpenseDraft; month: string; onClose: () => void }) {
  const { data, saveExpense, deleteExpense } = useData();
  const editing = draft.expense;
  const [amount, setAmount] = useState(amountInput(editing?.amount));
  const [category, setCategory] = useState<Category | null>(editing?.category ?? draft.category ?? null);
  const [label, setLabel] = useState(editing?.label ?? '');
  const [date, setDate] = useState(editing?.spent_on ?? defaultExpenseDate(month));
  const [note, setNote] = useState(editing?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(editing?.note));
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);

  // Suggestions de libellés : les plus fréquents, avec leur catégorie habituelle.
  const suggestions = useMemo(() => {
    const counts = new Map<string, { n: number; category: Category }>();
    for (const e of data.expenses) {
      const k = e.label.trim();
      if (!k) continue;
      const c = counts.get(k);
      counts.set(k, { n: (c?.n ?? 0) + 1, category: e.category });
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 60);
  }, [data.expenses]);

  const quick = suggestions.filter(([, v]) => !category || v.category === category).slice(0, 6);

  const submit = async (e: FormEvent, again = false) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Indique un montant supérieur à 0.');
    if (!category) return setError('Choisis une catégorie.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date invalide.');
    setError('');
    const payload = { id: editing?.id, created_at: editing?.created_at, amount: value, category, label: label.trim(), note: note.trim(), spent_on: date };
    const save = saveExpense(payload);
    if (again) {
      setAmount('');
      setLabel('');
      setNote('');
      setAdded((n) => n + 1);
      document.getElementById('expense-amount')?.focus();
      if (await save) toast('Dépense ajoutée', 'success');
    } else {
      onClose();
      if (await save) toast(editing ? 'Dépense modifiée' : 'Dépense ajoutée', 'success');
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (await ask({ title: 'Supprimer cette dépense ?', text: 'Elle disparaîtra sur tous tes appareils.', confirm: 'Supprimer', danger: true })) {
      onClose();
      if (await deleteExpense(editing.id)) toast('Dépense supprimée', 'success');
    }
  };

  return (
    <Modal
      title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
      onClose={onClose}
      footer={
        <>
          {editing ? (
            <button type="button" className="btn btn-ghost btn-danger-text" onClick={remove}>
              <Trash2 size={16} /> Supprimer
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={(e) => submit(e, true)}>
              Ajouter et continuer
            </button>
          )}
          <button type="submit" form="expense-form" className="btn btn-primary">
            {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={(e) => submit(e)} className="form">
        {added > 0 && <p className="hint-success">{added} dépense{added > 1 ? 's' : ''} ajoutée{added > 1 ? 's' : ''}. Tu peux continuer.</p>}
        <label className="amount-field">
          <span className="sr-only">Montant</span>
          <input
            id="expense-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            aria-label="Montant"
          />
          <span className="amount-currency">{currencySymbol()}</span>
        </label>

        <fieldset className="cat-picker">
          <legend>Catégorie</legend>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`cat-option ${category === c.id ? 'selected' : ''}`}
              style={{ '--cat': catColor(c.id) } as CSSProperties}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
            >
              <span className="cat-option-icon">
                <CategoryIcon category={c.id} size={20} />
              </span>
              <span className="cat-option-text">
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </span>
            </button>
          ))}
        </fieldset>

        <label className="field">
          <span>Libellé</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Courses, cinéma…" list="label-suggestions" maxLength={120} />
          <datalist id="label-suggestions">
            {suggestions.map(([l]) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        {quick.length > 0 && !label && (
          <div className="chips" aria-label="Libellés fréquents">
            {quick.map(([l, v]) => (
              <button
                type="button"
                key={l}
                className="chip"
                onClick={() => {
                  setLabel(l);
                  if (!category) setCategory(v.category);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        {showNote ? (
          <label className="field">
            <span>Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Facultatif" />
          </label>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowNote(true)}>
            + Ajouter une note
          </button>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
