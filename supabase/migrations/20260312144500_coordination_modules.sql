create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  thread_kind text not null default 'project' check (thread_kind in ('project', 'direct', 'business', 'request')),
  linked_project_id uuid references public.projects (id) on delete set null,
  pending_action boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  message_type text not null default 'text' check (message_type in ('text', 'structured_update', 'payment_request', 'task_request')),
  structured_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  linked_project_id uuid references public.projects (id) on delete set null,
  entry_kind text not null check (entry_kind in ('send', 'request', 'iou')),
  direction text not null check (direction in ('in', 'out')),
  amount_cents integer not null check (amount_cents >= 0),
  counterparty text not null,
  reason text not null,
  note text,
  due_on date,
  status text not null default 'pending' check (status in ('pending', 'settled')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  customer_name text not null,
  linked_project_id uuid references public.projects (id) on delete set null,
  linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  booking_at timestamptz,
  status text not null default 'upcoming' check (status in ('today', 'upcoming', 'waiting', 'delayed', 'completed')),
  payment_state text not null default 'unpaid' check (payment_state in ('unpaid', 'deposit due', 'paid')),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null,
  title text not null,
  detail text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.conversation_threads enable row level security;
alter table public.messages enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.jobs enable row level security;
alter table public.project_activity enable row level security;

create policy "threads_read_own" on public.conversation_threads
  for select using (auth.uid() = owner_id);
create policy "threads_write_own" on public.conversation_threads
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "messages_read_own_threads" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = messages.thread_id
        and conversation_threads.owner_id = auth.uid()
    )
  );
create policy "messages_write_own_threads" on public.messages
  for all using (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = messages.thread_id
        and conversation_threads.owner_id = auth.uid()
        and messages.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = messages.thread_id
        and conversation_threads.owner_id = auth.uid()
    )
    and messages.author_id = auth.uid()
  );

create policy "wallet_entries_read_own" on public.wallet_entries
  for select using (auth.uid() = profile_id);
create policy "wallet_entries_write_own" on public.wallet_entries
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "jobs_read_own" on public.jobs
  for select using (auth.uid() = owner_id);
create policy "jobs_write_own" on public.jobs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "project_activity_read_own" on public.project_activity
  for select using (auth.uid() = owner_id);
create policy "project_activity_write_own" on public.project_activity
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
