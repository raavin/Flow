create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null,
  estimate_cents integer not null default 0,
  actual_cents integer not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid')),
  linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.structured_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  update_type text not null,
  affected_milestone_id uuid references public.milestones (id) on delete set null,
  previous_time timestamptz,
  next_time timestamptz,
  note text,
  ai_replan boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.project_expenses enable row level security;
alter table public.structured_updates enable row level security;

create policy "project_expenses_read_own" on public.project_expenses
  for select using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_expenses.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "project_expenses_write_own" on public.project_expenses
  for all using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_expenses.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_expenses.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "structured_updates_read_own" on public.structured_updates
  for select using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = structured_updates.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "structured_updates_write_own" on public.structured_updates
  for all using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = structured_updates.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = structured_updates.project_id
        and projects.owner_id = auth.uid()
    )
  );
