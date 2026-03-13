create table if not exists public.project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  participant_kind text not null default 'person' check (participant_kind in ('person', 'business')),
  role text not null default 'helper' check (role in ('owner', 'collaborator', 'helper', 'guest', 'provider', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'declined')),
  availability_status text not null default 'unknown',
  visibility_scope text not null default 'project essentials',
  contact_hint text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.project_participants enable row level security;

create policy "participants_read_own_projects" on public.project_participants
  for select using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_participants.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "participants_write_own_projects" on public.project_participants
  for all using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_participants.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_participants.project_id
        and projects.owner_id = auth.uid()
    )
  );
