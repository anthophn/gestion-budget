import { createContext, useContext } from 'react';
import type { Category } from './lib/types';
import type { ExpenseDraft } from './components/ExpenseForm';

export type Page = 'dashboard' | 'expenses' | 'plan' | 'analysis' | 'review' | 'settings' | 'more';

export interface Nav {
  page: Page;
  go: (p: Page) => void;
  month: string;
  setMonth: (m: string) => void;
  openExpense: (d?: ExpenseDraft) => void;
  filter: Category | 'all';
  showCategory: (c: Category | 'all') => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav doit être utilisé dans <NavContext.Provider>');
  return ctx;
}
