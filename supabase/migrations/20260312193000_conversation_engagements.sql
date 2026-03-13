create table if not exists public.conversation_engagements (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  liked boolean not null default false,
  reposted boolean not null default false,
  bookmarked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (thread_id, user_id)
);

alter table public.conversation_engagements enable row level security;

create policy "conversation_engagements_read_own_threads" on public.conversation_engagements
  for select using (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = conversation_engagements.thread_id
        and conversation_threads.owner_id = auth.uid()
    )
  );

create policy "conversation_engagements_write_own_threads" on public.conversation_engagements
  for all using (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = conversation_engagements.thread_id
        and conversation_threads.owner_id = auth.uid()
        and conversation_engagements.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversation_threads
      where conversation_threads.id = conversation_engagements.thread_id
        and conversation_threads.owner_id = auth.uid()
    )
    and conversation_engagements.user_id = auth.uid()
  );
