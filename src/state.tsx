import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, AuthUser, BudgetMonth, Expense, MonthItem, Settings } from './lib/types';
import { EMPTY_DATA } from './lib/types';
import { auth } from './lib/backend';
import { frError } from './lib/cloud';
import { buildIndex, emptyMonth, summarize, type DataIndex, type MonthSummary } from './lib/kakeibo';
import { setCurrency, uuid } from './lib/format';
import { shiftMonth } from './lib/dates';
import { toast } from './lib/toast';

export type SyncState = 'live' | 'connecting' | 'offline' | 'local';

interface DataContextValue {
  user: AuthUser;
  mode: 'cloud' | 'local';
  data: AppData;
  index: DataIndex;
  loading: boolean;
  sync: SyncState;
  summary: (month: string) => MonthSummary;
  saveExpense: (e: Omit<Expense, 'id'> & { id?: string }) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  saveItem: (i: Omit<MonthItem, 'id'> & { id?: string }) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  saveMonth: (month: string, patch: Partial<Omit<BudgetMonth, 'month'>>) => Promise<boolean>;
  saveSettings: (s: Settings) => Promise<boolean>;
  copyFromPrevious: (month: string) => Promise<string | null>;
  importData: (d: Partial<AppData>) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}

const cacheKey = (uid: string) => `kakeibo-cache-${uid}`;

function readCache(uid: string): AppData | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}

export function DataProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const store = useMemo(() => auth.createStore(user), [user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState<AppData>(() => (auth.mode === 'cloud' && readCache(user.id)) || EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loadFailed, setLoadFailed] = useState(false);
  const lastLoad = useRef(0);
  const pendingWrites = useRef(0);
  const reloadAfterWrites = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  setCurrency(data.settings.currency);

  const reload = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const fresh = await store.load();
      // Pendant une écriture, on garde l'affichage optimiste et on rechargera une fois l'écriture terminée.
      if (pendingWrites.current === 0) setData(fresh);
      else reloadAfterWrites.current = true;
      setLoadFailed(false);
      if (auth.mode === 'cloud') {
        try {
          localStorage.setItem(cacheKey(user.id), JSON.stringify(fresh));
        } catch {
          /* stockage plein : le cache hors ligne est facultatif */
        }
      }
    } catch (err) {
      setLoadFailed(true);
      console.warn('Chargement impossible', err);
    } finally {
      setLoading(false);
    }
  }, [store, user.id]);

  useEffect(() => {
    void reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onRemoteChange = (deletedId?: string) => {
      // Une suppression qui ne concerne pas nos données (ou que l'on a déjà faite ici) est ignorée.
      const d = dataRef.current;
      if (deletedId && !d.expenses.some((e) => e.id === deletedId) && !d.items.some((i) => i.id === deletedId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 350);
    };
    const unsubscribe = store.subscribe(onRemoteChange, setLive);
    const onFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 15000) void reload();
    };
    const onOnline = () => {
      setOnline(true);
      void reload();
    };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [store, reload]);

  const index = useMemo(() => buildIndex(data), [data]);
  const summary = useMemo(() => {
    const cache = new Map<string, MonthSummary>();
    return (month: string) => {
      let s = cache.get(month);
      if (!s) {
        s = summarize(index, month);
        cache.set(month, s);
      }
      return s;
    };
  }, [index]);

  /** Applique la modification à l'écran tout de suite, puis l'enregistre. En cas d'échec, on recharge. */
  const mutate = useCallback(
    async (local: (d: AppData) => AppData, remote: () => Promise<void>): Promise<boolean> => {
      setData(local);
      pendingWrites.current++;
      try {
        await remote();
        return true;
      } catch (err) {
        toast(frError(err), 'error');
        reloadAfterWrites.current = true; // on revient à l'état réel enregistré
        return false;
      } finally {
        pendingWrites.current--;
        if (pendingWrites.current === 0 && reloadAfterWrites.current) {
          reloadAfterWrites.current = false;
          void reload();
        }
      }
    },
    [store, reload],
  );

  const value: DataContextValue = {
    user,
    mode: auth.mode,
    data,
    index,
    loading,
    sync: auth.mode === 'local' ? 'local' : !online || loadFailed ? 'offline' : live ? 'live' : 'connecting',
    summary,
    saveExpense: (input) => {
      const e: Expense = { ...input, id: input.id ?? uuid(), created_at: input.created_at ?? new Date().toISOString() };
      return mutate(
        (d) => ({ ...d, expenses: d.expenses.some((x) => x.id === e.id) ? d.expenses.map((x) => (x.id === e.id ? { ...x, ...e } : x)) : [...d.expenses, e] }),
        () => store.upsertExpense(e),
      );
    },
    deleteExpense: (id) =>
      mutate(
        (d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }),
        () => store.deleteExpense(id),
      ),
    saveItem: (input) => {
      const i: MonthItem = { ...input, id: input.id ?? uuid() };
      return mutate(
        (d) => ({ ...d, items: d.items.some((x) => x.id === i.id) ? d.items.map((x) => (x.id === i.id ? i : x)) : [...d.items, i] }),
        () => store.upsertItem(i),
      );
    },
    deleteItem: (id) =>
      mutate(
        (d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }),
        () => store.deleteItem(id),
      ),
    saveMonth: (month, patch) => {
      const next: BudgetMonth = { ...(index.monthsByKey.get(month) ?? emptyMonth(month)), ...patch, month };
      return mutate(
        (d) => ({ ...d, months: d.months.some((m) => m.month === month) ? d.months.map((m) => (m.month === month ? next : m)) : [...d.months, next] }),
        () => store.upsertMonth(next),
      );
    },
    saveSettings: (s) =>
      mutate(
        (d) => ({ ...d, settings: s }),
        () => store.saveSettings(s),
      ),
    copyFromPrevious: async (month) => {
      for (let i = 1; i <= 12; i++) {
        const from = shiftMonth(month, -i);
        const items = index.itemsByMonth.get(from) ?? [];
        const plan = index.monthsByKey.get(from);
        if (items.length === 0 && !plan) continue;
        const copy: Partial<AppData> = {
          items: items.map((it) => ({ ...it, id: uuid(), month })),
          months: [{ ...(index.monthsByKey.get(month) ?? emptyMonth(month)), savings_goal: plan?.savings_goal ?? 0, cat_budgets: plan?.cat_budgets ?? {} }],
        };
        const ok = await mutate(
          (d) => ({ ...d, items: [...d.items, ...(copy.items ?? [])], months: [...d.months.filter((m) => m.month !== month), ...(copy.months ?? [])] }),
          () => store.importData(copy),
        );
        return ok ? from : null;
      }
      return null;
    },
    importData: (imp) =>
      mutate(
        (d) => ({
          ...d,
          expenses: [...d.expenses.filter((x) => !imp.expenses?.some((e) => e.id === x.id)), ...(imp.expenses ?? [])],
          items: [...d.items.filter((x) => !imp.items?.some((e) => e.id === x.id)), ...(imp.items ?? [])],
          months: [...d.months.filter((x) => !imp.months?.some((m) => m.month === x.month)), ...(imp.months ?? [])],
        }),
        () => store.importData(imp),
      ),
    clearAll: () =>
      mutate(
        (d) => ({ ...d, expenses: [], items: [], months: [] }),
        () => store.clearAll(),
      ),
    reload,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
