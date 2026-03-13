create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_mode text not null default 'individual' check (account_mode in ('individual', 'business', 'both')),
  active_mode text not null default 'individual' check (active_mode in ('individual', 'business')),
  first_name text not null default '',
  last_name text,
  location text not null default '',
  time_zone text not null default 'Australia/Sydney',
  use_cases text[] not null default '{}',
  integrations text[] not null default '{}',
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null default '',
  category text not null default '',
  service_area text not null default '',
  offerings text[] not null default '{}',
  booking_model text not null default 'request-based',
  availability_notes text not null default '',
  visibility_mode text not null default 'progress milestones',
  logo_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null,
  status text not null default 'active' check (status in ('active', 'upcoming', 'completed')),
  target_date date,
  budget_cents integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  starts_on date not null,
  ends_on date not null,
  lane text not null,
  progress integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('template', 'service', 'product')),
  category text not null,
  title text not null,
  summary text not null,
  price_label text not null,
  whimsical_note text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.calendar_events enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.notifications enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "business_profiles_select_own" on public.business_profiles
  for select using (auth.uid() = id);
create policy "business_profiles_modify_own" on public.business_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = owner_id);
create policy "projects_modify_own" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "milestones_select_own_projects" on public.milestones
  for select using (
    exists (
      select 1
      from public.projects
      where projects.id = milestones.project_id
        and projects.owner_id = auth.uid()
    )
  );
create policy "milestones_modify_own_projects" on public.milestones
  for all using (
    exists (
      select 1
      from public.projects
      where projects.id = milestones.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects
      where projects.id = milestones.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "calendar_events_select_own" on public.calendar_events
  for select using (auth.uid() = owner_id);
create policy "calendar_events_modify_own" on public.calendar_events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "marketplace_listings_public_read" on public.marketplace_listings
  for select using (is_published = true);
create policy "marketplace_listings_owner_write" on public.marketplace_listings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = profile_id);
create policy "notifications_modify_own" on public.notifications
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_profile_updated_at();

create trigger business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.handle_profile_updated_at();
