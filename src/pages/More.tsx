import { BookHeart, ChevronRight, Settings, Wallet } from 'lucide-react';
import { useNav, type Page } from '../nav';
import { useData } from '../state';
import { monthLabel } from '../lib/dates';
import { money } from '../lib/format';

/** Menu « Plus » de la version mobile. */
export function More() {
  const { go, month } = useNav();
  const { summary } = useData();
  const s = summary(month);
  const links: { id: Page; label: string; sub: string; icon: typeof Wallet }[] = [
    { id: 'plan', label: 'Budget du mois', sub: s.hasPlan ? `${money(s.available)} à dépenser en ${monthLabel(month).toLowerCase()}` : 'Revenus, charges fixes, objectif d’épargne', icon: Wallet },
    { id: 'review', label: 'Bilan du mois', sub: 'Les 4 questions du Kakeibo', icon: BookHeart },
    { id: 'settings', label: 'Réglages', sub: 'Compte, devise, thème, sauvegardes, installation', icon: Settings },
  ];
  return (
    <div className="page">
      <div className="card menu-list">
        {links.map((l) => (
          <button type="button" key={l.id} className="menu-row" onClick={() => go(l.id)}>
            <span className="menu-icon">
              <l.icon size={20} />
            </span>
            <span className="menu-text">
              <strong>{l.label}</strong>
              <small>{l.sub}</small>
            </span>
            <ChevronRight size={18} className="muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
