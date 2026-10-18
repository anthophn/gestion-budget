// Mode local : utilisé tant que Supabase n'est pas configuré (développement, démo).
// Les comptes et les données restent dans le navigateur de l'appareil, sans synchronisation.
import type { AppData, AuthService, AuthUser, DataStore } from './types';
import { EMPTY_DATA } from './types';
import { uuid } from './format';

const USERS_KEY = 'kakeibo-local-users';
const SESSION_KEY = 'kakeibo-local-session';
const dataKey = (uid: string) => `kakeibo-local-data-${uid}`;

interface LocalUser extends AuthUser {
  salt: string;
  hash: string;
}

function readJSON<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const b of bytes) h = (Math.imul(31, h) + b) | 0;
  return String(h);
}

const publicUser = (u: LocalUser): AuthUser => ({ id: u.id, email: u.email });

export function createLocalAuth(): AuthService {
  const listeners = new Set<(u: AuthUser | null, event: string) => void>();
  const users = () => readJSON<LocalUser[]>(USERS_KEY, []);
  const sessionUser = (): AuthUser | null => {
    const id = localStorage.getItem(SESSION_KEY);
    const u = users().find((x) => x.id === id);
    return u ? publicUser(u) : null;
  };
  const emit = (event: string) => listeners.forEach((cb) => cb(sessionUser(), event));

  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY) emit(e.newValue ? 'SIGNED_IN' : 'SIGNED_OUT');
  });

  return {
    mode: 'local',
    recoveryRequested: false,
    async current() {
      return sessionUser();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp(email, password) {
      const normalized = email.trim().toLowerCase();
      if (users().some((u) => u.email === normalized)) throw new Error('User already registered');
      const salt = uuid();
      const user: LocalUser = { id: uuid(), email: normalized, salt, hash: await hashPassword(password, salt) };
      writeJSON(USERS_KEY, [...users(), user]);
      localStorage.setItem(SESSION_KEY, user.id);
      emit('SIGNED_IN');
      return { needsConfirmation: false };
    },
    async signIn(email, password) {
      const u = users().find((x) => x.email === email.trim().toLowerCase());
      if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new Error('Invalid login credentials');
      localStorage.setItem(SESSION_KEY, u.id);
      emit('SIGNED_IN');
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emit('SIGNED_OUT');
    },
    async sendReset() {
      throw new Error('En mode local, aucun e-mail ne peut être envoyé : crée un nouveau compte ou configure Supabase.');
    },
    async updatePassword(password) {
      const current = sessionUser();
      if (!current) throw new Error('Ta session a expiré : reconnecte-toi.');
      const salt = uuid();
      const hash = await hashPassword(password, salt);
      writeJSON(USERS_KEY, users().map((u) => (u.id === current.id ? { ...u, salt, hash } : u)));
    },
    async deleteAccount() {
      const current = sessionUser();
      if (!current) return;
      writeJSON(USERS_KEY, users().filter((u) => u.id !== current.id));
      localStorage.removeItem(dataKey(current.id));
      localStorage.removeItem(SESSION_KEY);
      emit('SIGNED_OUT');
    },
    createStore(user) {
      return createLocalStore(user.id);
    },
  };
}

function createLocalStore(uid: string): DataStore {
  const k = dataKey(uid);
  const read = (): AppData => ({ ...EMPTY_DATA, ...readJSON<Partial<AppData>>(k, {}) });
  const update = (fn: (d: AppData) => AppData) => writeJSON(k, fn(read()));
  const upsertBy = <T>(list: T[], item: T, same: (a: T) => boolean) => (list.some(same) ? list.map((x) => (same(x) ? item : x)) : [...list, item]);

  return {
    async load() {
      return read();
    },
    async upsertExpense(e) {
      const prev = read().expenses.find((x) => x.id === e.id);
      const row = { ...e, created_at: prev?.created_at ?? e.created_at ?? new Date().toISOString() };
      update((d) => ({ ...d, expenses: upsertBy(d.expenses, row, (x) => x.id === e.id) }));
    },
    async deleteExpense(id) {
      update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }));
    },
    async upsertItem(i) {
      update((d) => ({ ...d, items: upsertBy(d.items, i, (x) => x.id === i.id) }));
    },
    async deleteItem(id) {
      update((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
    },
    async upsertMonth(m) {
      update((d) => ({ ...d, months: upsertBy(d.months, m, (x) => x.month === m.month) }));
    },
    async saveSettings(s) {
      update((d) => ({ ...d, settings: s }));
    },
    async importData(imp) {
      update((d) => {
        let { expenses, items, months } = d;
        for (const e of imp.expenses ?? []) expenses = upsertBy(expenses, { ...e, created_at: e.created_at ?? new Date().toISOString() }, (x) => x.id === e.id);
        for (const i of imp.items ?? []) items = upsertBy(items, i, (x) => x.id === i.id);
        for (const m of imp.months ?? []) months = upsertBy(months, m, (x) => x.month === m.month);
        return { ...d, expenses, items, months, settings: imp.settings ?? d.settings };
      });
    },
    async clearAll() {
      update((d) => ({ ...d, expenses: [], items: [], months: [] }));
    },
    subscribe(onRemoteChange, onStatus) {
      // Un autre onglet du même navigateur joue le rôle d'un « autre appareil ».
      const handler = (e: StorageEvent) => {
        if (e.key === k) onRemoteChange();
      };
      window.addEventListener('storage', handler);
      onStatus(true);
      return () => window.removeEventListener('storage', handler);
    },
  };
}
