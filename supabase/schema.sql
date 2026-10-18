-- ============================================================================
--  Kakeibo — base de données Supabase
--  À coller dans Supabase > SQL Editor > New query, puis cliquer sur « Run ».
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- ============================================================================

-- 1. Réglages de chaque utilisateur ------------------------------------------
create table if not exists public.settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency    text not null default 'EUR',
  updated_at  timestamptz not null default now()
);

-- 2. Plan de chaque mois : objectif d'épargne, budgets par catégorie, bilan --
create table if not exists public.budget_months (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-\d{2}$'),            -- ex. 2026-10
  savings_goal numeric(12, 2) not null default 0 check (savings_goal >= 0),
  cat_budgets  jsonb not null default '{}'::jsonb,                        -- { "survie": 300, ... }
  reflection   jsonb not null default '{}'::jsonb,                        -- réponses du bilan
  updated_at   timestamptz not null default now(),
  primary key (user_id, month)
);

-- 3. Revenus et charges fixes du mois ----------------------------------------
create table if not exists public.month_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  kind        text not null check (kind in ('income', 'fixed')),
  label       text not null default '' check (char_length(label) <= 120),
  amount      numeric(12, 2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists month_items_user_month on public.month_items (user_id, month);

-- 4. Dépenses du quotidien, rangées dans les 4 catégories Kakeibo ------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spent_on    date not null,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null check (category in ('survie', 'optionnel', 'culture', 'imprevus')),
  label       text not null default '' check (char_length(label) <= 120),
  note        text not null default '' check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists expenses_user_date on public.expenses (user_id, spent_on);

-- 5. Sécurité : chaque utilisateur ne voit et ne modifie QUE ses données ------
alter table public.settings      enable row level security;
alter table public.budget_months enable row level security;
alter table public.month_items   enable row level security;
alter table public.expenses      enable row level security;

drop policy if exists "Mes réglages"  on public.settings;
drop policy if exists "Mes mois"      on public.budget_months;
drop policy if exists "Mes lignes"    on public.month_items;
drop policy if exists "Mes dépenses"  on public.expenses;

create policy "Mes réglages" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Mes mois" on public.budget_months
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Mes lignes" on public.month_items
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Mes dépenses" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.settings, public.budget_months,
  public.month_items, public.expenses to authenticated;

-- 6. Supprimer son compte depuis l'appli (Réglages > Supprimer mon compte) ----
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();   -- les données partent avec (on delete cascade)
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 7. Temps réel : un ajout sur le téléphone apparaît tout de suite sur le PC --
do $$
declare t text;
begin
  foreach t in array array['settings', 'budget_months', 'month_items', 'expenses'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
