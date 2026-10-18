export type Category = 'survie' | 'optionnel' | 'culture' | 'imprevus';

export interface Expense {
  id: string;
  spent_on: string; // AAAA-MM-JJ
  amount: number;
  category: Category;
  label: string;
  note: string;
  created_at?: string;
}

export type ItemKind = 'income' | 'fixed';

export interface MonthItem {
  id: string;
  month: string; // AAAA-MM
  kind: ItemKind;
  label: string;
  amount: number;
}

export interface Reflection {
  good?: string;
  improve?: string;
  commitment?: string;
}

export interface BudgetMonth {
  month: string;
  savings_goal: number;
  cat_budgets: Partial<Record<Category, number>>;
  reflection: Reflection;
}

export interface Settings {
  currency: string;
}

export interface AppData {
  settings: Settings;
  months: BudgetMonth[];
  items: MonthItem[];
  expenses: Expense[];
}

export interface AuthUser {
  id: string;
  email: string;
}

/** Accès aux données d'un utilisateur connecté (Supabase ou stockage local). */
export interface DataStore {
  load(): Promise<AppData>;
  upsertExpense(e: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  upsertItem(i: MonthItem): Promise<void>;
  deleteItem(id: string): Promise<void>;
  upsertMonth(m: BudgetMonth): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  importData(d: Partial<AppData>): Promise<void>;
  clearAll(): Promise<void>;
  /**
   * Appelle `onRemoteChange` quand les données changent sur un autre appareil (pour une suppression, avec l'id supprimé).
   * Renvoie la fonction de désabonnement.
   */
  subscribe(onRemoteChange: (deletedId?: string) => void, onStatus: (live: boolean) => void): () => void;
}

export interface SignUpResult {
  needsConfirmation: boolean;
}

export interface AuthService {
  mode: 'cloud' | 'local';
  /** Vrai quand la page a été ouverte depuis le lien « mot de passe oublié ». */
  recoveryRequested: boolean;
  current(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null, event: string) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  deleteAccount(): Promise<void>;
  createStore(user: AuthUser): DataStore;
}

export const EMPTY_DATA: AppData = {
  settings: { currency: 'EUR' },
  months: [],
  items: [],
  expenses: [],
};
