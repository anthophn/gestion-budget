import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, BookHeart, ChevronLeft, ChevronRight, Home, LayoutGrid, ListChecks, LogOut, Plus, Settings as SettingsIcon, Wallet } from 'lucide-react';
import { auth } from './lib/backend';
import type { AuthUser, Category } from './lib/types';
import { DataProvider, useData, type SyncState } from './state';
import { NavContext, useNav, type Nav, type Page } from './nav';
import { currentMonth, monthLabel, shiftMonth } from './lib/dates';
import { ExpenseForm, type ExpenseDraft } from './components/ExpenseForm';
import { ConfirmHost, ToastHost } from './components/ui';
import { AuthPage, ResetPasswordPage } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Plan } from './pages/Plan';
import { Analysis } from './pages/Analysis';
import { Review } from './pages/Review';
import { SettingsPage } from './pages/Settings';
import { More } from './pages/More';
import { useTheme } from './theme';
import { Logo } from './components/Logo';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(auth.recoveryRequested);
  useTheme();

  useEffect(() => {
    let alive = true;
    auth.current().then((u) => {
      if (!alive) return;
      setUser(u);
      setReady(true);
    });
    const off = auth.onChange((u, event) => {
      if (!u) {
        try {
          sessionStorage.removeItem('kakeibo-page'); // après une déconnexion, on repart du tableau de bord
        } catch {
          /* navigation privée */
        }
      }
      setUser((prev) => (prev?.id === u?.id ? prev : u));
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return (
    <>
      {!ready ? (
        <Splash />
      ) : recovery && user ? (
        <ResetPasswordPage onDone={() => setRecovery(false)} />
      ) : user ? (
        <DataProvider key={user.id} user={user}>
          <Shell />
        </DataProvider>
      ) : (
        <AuthPage />
      )}
      <ToastHost />
      <ConfirmHost />
    </>
  );
}

function Splash() {
  return (
    <div className="splash">
      <Logo big />
    </div>
  );
}

const NAV: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Home },
  { id: 'expenses', label: 'Dépenses', icon: ListChecks },
  { id: 'plan', label: 'Budget du mois', icon: Wallet },
  { id: 'analysis', label: 'Analyse', icon: BarChart3 },
  { id: 'review', label: 'Bilan', icon: BookHeart },
  { id: 'settings', label: 'Réglages', icon: SettingsIcon },
];

function Shell() {
  const [page, setPage] = useState<Page>(() => {
    try {
      return (sessionStorage.getItem('kakeibo-page') as Page) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [month, setMonth] = useState(currentMonth());
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  const go = useCallback((p: Page) => {
    setPage(p);
    try {
      sessionStorage.setItem('kakeibo-page', p);
    } catch {
      /* navigation privée */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const nav: Nav = useMemo(
    () => ({
      page,
      go,
      month,
      setMonth,
      openExpense: (d = {}) => setDraft(d),
      filter,
      showCategory: (c) => {
        setFilter(c);
        go('expenses');
      },
    }),
    [page, go, month, filter],
  );

  // Raccourci clavier « N » pour ajouter une dépense (version PC).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !document.body.classList.contains('modal-open')) {
        e.preventDefault();
        setDraft({});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showMonth = page !== 'settings' && page !== 'more';

  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        <Sidebar />
        <div className="main">
          <header className="topbar">
            <div className="topbar-logo">
              <Logo />
            </div>
            {showMonth ? <MonthSwitcher /> : <h1 className="topbar-title">{page === 'settings' ? 'Réglages' : 'Plus'}</h1>}
            <div className="topbar-actions">
              <SyncBadge />
              <button type="button" className="btn btn-primary desktop-only" onClick={() => setDraft({})} title="Raccourci : touche N">
                <Plus size={18} /> Ajouter une dépense
              </button>
            </div>
          </header>
          <LocalModeBanner />
          <main className="content">
            <PageView page={page} />
          </main>
        </div>
        <BottomNav />
        {draft && <ExpenseForm draft={draft} month={month} onClose={() => setDraft(null)} />}
      </div>
    </NavContext.Provider>
  );
}

function PageView({ page }: { page: Page }) {
  const { loading, data } = useData();
  if (loading && data.expenses.length === 0 && data.items.length === 0) {
    return (
      <div className="loading">
        <div className="spinner" aria-hidden />
        Chargement de tes données…
      </div>
    );
  }
  switch (page) {
    case 'dashboard':
      return <Dashboard />;
    case 'expenses':
      return <Expenses />;
    case 'plan':
      return <Plan />;
    case 'analysis':
      return <Analysis />;
    case 'review':
      return <Review />;
    case 'settings':
      return <SettingsPage />;
    case 'more':
      return <More />;
  }
}

function Sidebar() {
  const { page, go } = useNav();
  const { user } = useData();
  return (
    <aside className="sidebar">
      <Logo />
      <nav className="side-nav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <button type="button" key={n.id} className={`side-link ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={page === n.id ? 'page' : undefined}>
            <n.icon size={19} />
            {n.label}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-user" title={user.email}>
          {user.email}
        </div>
        <button type="button" className="side-link" onClick={() => auth.signOut()}>
          <LogOut size={18} /> Se déconnecter
        </button>
      </div>
    </aside>
  );
}

function BottomNav() {
  const { page, go, openExpense } = useNav();
  const tab = (id: Page, label: string, Icon: typeof Home, alsoActive: Page[] = []) => (
    <button type="button" className={`tab ${page === id || alsoActive.includes(page) ? 'active' : ''}`} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="bottomnav" aria-label="Navigation">
      {tab('dashboard', 'Accueil', Home)}
      {tab('expenses', 'Dépenses', ListChecks)}
      <button type="button" className="fab" onClick={() => openExpense()} aria-label="Ajouter une dépense">
        <Plus size={28} />
      </button>
      {tab('analysis', 'Analyse', BarChart3)}
      {tab('more', 'Plus', LayoutGrid, ['plan', 'review', 'settings'])}
    </nav>
  );
}

function MonthSwitcher() {
  const { month, setMonth } = useNav();
  const cur = currentMonth();
  return (
    <div className="month-switcher">
      <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">
        <ChevronLeft size={20} />
      </button>
      <h1 className="month-label">{monthLabel(month)}</h1>
      <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">
        <ChevronRight size={20} />
      </button>
      {month !== cur && (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setMonth(cur)}>
          Aujourd’hui
        </button>
      )}
    </div>
  );
}

const SYNC_LABEL: Record<SyncState, string> = {
  live: 'Synchronisé',
  connecting: 'Connexion…',
  offline: 'Hors ligne',
  local: 'Mode local',
};

function SyncBadge() {
  const { sync } = useData();
  const title =
    sync === 'live'
      ? 'Tes données sont enregistrées en ligne et synchronisées en temps réel avec tes autres appareils.'
      : sync === 'offline'
        ? 'Pas de connexion : tu vois la dernière version enregistrée. Les modifications nécessitent internet.'
        : sync === 'local'
          ? 'Supabase n’est pas configuré : les données restent sur cet appareil.'
          : 'Connexion au serveur…';
  return (
    <span className={`sync sync-${sync}`} title={title}>
      <span className="sync-dot" aria-hidden />
      <span className="sync-label">{SYNC_LABEL[sync]}</span>
    </span>
  );
}

function LocalModeBanner() {
  const { mode } = useData();
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('kakeibo-hide-local') === '1');
  if (mode !== 'local' || hidden) return null;
  return (
    <div className="banner">
      <span>
        <strong>Mode local :</strong> tes données restent sur cet appareil. Pour synchroniser téléphone et PC, connecte Supabase (voir le tuto).
      </span>
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          sessionStorage.setItem('kakeibo-hide-local', '1');
          setHidden(true);
        }}
      >
        Masquer
      </button>
    </div>
  );
}
