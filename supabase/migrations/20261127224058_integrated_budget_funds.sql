-- An owner's funding plan is private, just like their project budgets.
-- Saved budget_groups remain filters: they may overlap and cannot be funding parents.
create table public.money_budget_settings (
  owner_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  budget_cents integer check (budget_cents is null or budget_cents >= 0)
);
create table public.budget_funds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  unique (owner_id, id),
  unique (owner_id, name)
);
alter table public.money_budget_settings enable row level security;
alter table public.budget_funds enable row level security;
revoke all on public.money_budget_settings, public.budget_funds from anon;
grant select, insert, update, delete on public.money_budget_settings, public.budget_funds to authenticated;
create policy money_budget_settings_owner on public.money_budget_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy budget_funds_owner on public.budget_funds for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- One project, one parent. The composite FK prevents cross-owner assignment even
-- when a caller bypasses the UI. Removing a group returns its projects to Money.
alter table public.project_budget_limits add column fund_id uuid;
alter table public.project_budget_limits add constraint project_budget_fund_owner
  foreign key (owner_id, fund_id) references public.budget_funds(owner_id, id)
  on delete set null (fund_id);
create index project_budget_limits_fund on public.project_budget_limits(owner_id, fund_id);
