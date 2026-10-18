import type { Expense } from '../lib/types';
import { CAT } from '../lib/kakeibo';
import { money } from '../lib/format';
import { shortDate } from '../lib/dates';
import { CategoryBadge } from './CategoryIcon';

export function ExpenseRow({ e, onClick, showDate = true }: { e: Expense; onClick: () => void; showDate?: boolean }) {
  return (
    <button type="button" className="expense-row" onClick={onClick}>
      <CategoryBadge category={e.category} />
      <span className="expense-main">
        <span className="expense-label">{e.label || CAT[e.category].label}</span>
        <span className="expense-sub">
          {showDate && `${shortDate(e.spent_on)} · `}
          {CAT[e.category].label}
          {e.note && ` · ${e.note}`}
        </span>
      </span>
      <span className="expense-amount">−{money(e.amount)}</span>
    </button>
  );
}
