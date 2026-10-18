import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { uuid } from './format';
import type { AppData, AuthService, AuthUser, BudgetMonth, DataStore, Expense, MonthItem, Settings } from './types';
import { EMPTY_DATA } from './types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined)?.trim();

/** Vrai quand l'adresse et la clé Supabase ont été fournies au moment de la compilation. */
export const cloudConfigured = Boolean(url && key && /^https?:\/\//.test(url));

// Lu avant que Supabase ne nettoie l'adresse : la page vient-elle du lien « mot de passe oublié » ?
const recoveryInUrl = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);

const toUser = (u: User): AuthUser => ({ id: u.id, email: u.email ?? '' });

/** Adresse vers laquelle Supabase renvoie après un clic dans un e-mail (confirmation, mot de passe oublié). */
function redirectUrl(): string | undefined {
  const isNative = location.protocol === 'file:' || 'Capacitor' in window || import.meta.env.MODE === 'native';
  if (!isNative) return location.origin + location.pathname;
  return (import.meta.env.VITE_PUBLIC_URL as string | undefined) || undefined;
}

/** Traduit les messages d'erreur de Supabase. */
export function frError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Ton adresse e-mail n’est pas encore confirmée : clique sur le lien reçu par e-mail.';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user_already_exists')) return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
  if (m.includes('password should be at least') || m.includes('weak_password') || m.includes('weak password')) return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate_limit')) return 'Trop de tentatives ou d’e-mails envoyés. Réessaie dans quelques minutes.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Les inscriptions sont fermées sur cette appli.';
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('email_address_invalid')) return 'Adresse e-mail invalide.';
  if (m.includes('error sending') || m.includes('sending confirmation') || m.includes('sending recovery')) return 'L’e-mail n’a pas pu être envoyé. Le propriétaire de l’appli doit configurer l’envoi d’e-mails dans Supabase (voir le tuto).';
  if (m.includes('same_password') || m.includes('should be different')) return 'Le nouveau mot de passe doit être différent de l’ancien.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Pas de connexion internet (ou serveur injoignable).';
  if (m.includes('jwt') || m.includes('session')) return 'Ta session a expiré : reconnecte-toi.';
  return msg || 'Une erreur est survenue.';
}

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

export function createCloudAuth(): AuthService {
  const sb = createClient(url as string, key as string, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });

  return {
    mode: 'cloud',
    recoveryRequested: recoveryInUrl,
    async current() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ? toUser(data.session.user) : null;
    },
    onChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => cb(session?.user ? toUser(session.user) : null, event));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
      if (error) throw error;
      // Si la confirmation par e-mail est activée et que l'adresse existe déjà, Supabase renvoie un utilisateur sans identité.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('User already registered');
      }
      return { needsConfirmation: !data.session };
    },
    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await sb.auth.signOut({ scope: 'local' });
    },
    async sendReset(email) {
      check(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }));
    },
    async updatePassword(password) {
      check(await sb.auth.updateUser({ password }));
    },
    async deleteAccount() {
      check(await sb.rpc('delete_my_account'));
      await sb.auth.signOut({ scope: 'local' });
    },
    createStore(user) {
      return createCloudStore(sb, user);
    },
  };
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

async function fetchAll<T>(sb: SupabaseClient, table: string, order: string): Promise<T[]> {
  const size = 1000; // Supabase renvoie 1000 lignes maximum par requête
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.from(table).select('*').order(order).range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

function chunks<T>(xs: T[], n = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function createCloudStore(sb: SupabaseClient, user: AuthUser): DataStore {
  const uid = user.id;
  const expenseRow = (e: Expense) => ({ id: e.id, user_id: uid, spent_on: e.spent_on, amount: e.amount, category: e.category, label: e.label, note: e.note });
  const itemRow = (i: MonthItem) => ({ id: i.id, user_id: uid, month: i.month, kind: i.kind, label: i.label, amount: i.amount });
  const monthRow = (m: BudgetMonth) => ({ user_id: uid, month: m.month, savings_goal: m.savings_goal, cat_budgets: m.cat_budgets, reflection: m.reflection, updated_at: new Date().toISOString() });

  return {
    async load(): Promise<AppData> {
      const [settingsRes, months, items, expenses] = await Promise.all([
        sb.from('settings').select('*').maybeSingle(),
        fetchAll<Record<string, unknown>>(sb, 'budget_months', 'month'),
        fetchAll<Record<string, unknown>>(sb, 'month_items', 'id'),
        fetchAll<Record<string, unknown>>(sb, 'expenses', 'id'),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      const s = settingsRes.data as { currency?: string } | null;
      return {
        settings: { currency: s?.currency || EMPTY_DATA.settings.currency },
        months: months.map((m) => ({
          month: String(m.month),
          savings_goal: num(m.savings_goal),
          cat_budgets: (m.cat_budgets as BudgetMonth['cat_budgets']) ?? {},
          reflection: (m.reflection as BudgetMonth['reflection']) ?? {},
        })),
        items: items.map((i) => ({ id: String(i.id), month: String(i.month), kind: i.kind as MonthItem['kind'], label: String(i.label ?? ''), amount: num(i.amount) })),
        expenses: expenses.map((e) => ({
          id: String(e.id),
          spent_on: String(e.spent_on),
          amount: num(e.amount),
          category: e.category as Expense['category'],
          label: String(e.label ?? ''),
          note: String(e.note ?? ''),
          created_at: String(e.created_at ?? ''),
        })),
      };
    },
    async upsertExpense(e) {
      check(await sb.from('expenses').upsert(expenseRow(e)));
    },
    async deleteExpense(id) {
      check(await sb.from('expenses').delete().eq('id', id));
    },
    async upsertItem(i) {
      check(await sb.from('month_items').upsert(itemRow(i)));
    },
    async deleteItem(id) {
      check(await sb.from('month_items').delete().eq('id', id));
    },
    async upsertMonth(m) {
      check(await sb.from('budget_months').upsert(monthRow(m), { onConflict: 'user_id,month' }));
    },
    async saveSettings(s: Settings) {
      check(await sb.from('settings').upsert({ user_id: uid, currency: s.currency, updated_at: new Date().toISOString() }));
    },
    async importData(d) {
      for (const part of chunks(d.months ?? [])) check(await sb.from('budget_months').upsert(part.map(monthRow), { onConflict: 'user_id,month' }));
      for (const part of chunks(d.items ?? [])) check(await sb.from('month_items').upsert(part.map(itemRow)));
      for (const part of chunks(d.expenses ?? [])) check(await sb.from('expenses').upsert(part.map(expenseRow)));
      if (d.settings) await this.saveSettings(d.settings);
    },
    async clearAll() {
      for (const t of ['expenses', 'month_items', 'budget_months']) check(await sb.from(t).delete().eq('user_id', uid));
    },
    subscribe(onRemoteChange, onStatus) {
      // Un canal par abonnement (nom unique) : React peut monter / démonter deux fois en développement.
      const channel = sb.channel(`kakeibo-db-${uid}-${uuid()}`);
      for (const table of ['expenses', 'month_items', 'budget_months', 'settings']) {
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${uid}` }, () => onRemoteChange());
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${uid}` }, () => onRemoteChange());
      }
      // Supabase ne sait pas filtrer les suppressions par utilisateur : on reçoit l'id supprimé
      // et l'appli ne recharge que s'il fait partie de nos données.
      for (const table of ['expenses', 'month_items']) {
        channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
          const id = (payload.old as { id?: string } | undefined)?.id;
          if (id) onRemoteChange(id);
        });
      }
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'budget_months' }, (payload) => {
        if ((payload.old as { user_id?: string } | undefined)?.user_id === uid) onRemoteChange();
      });
      channel.subscribe((status) => onStatus(status === 'SUBSCRIBED'));
      return () => {
        void sb.removeChannel(channel);
      };
    },
  };
}
