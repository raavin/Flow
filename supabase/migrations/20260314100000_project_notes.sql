create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Note',
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.project_notes enable row level security;

create policy "project_notes_read_own_projects" on public.project_notes
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_notes.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "project_notes_write_own_projects" on public.project_notes
  for all using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_notes.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_notes.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop trigger if exists project_notes_touch_updated_at on public.project_notes;
create trigger project_notes_touch_updated_at
  before update on public.project_notes
  for each row execute function public.touch_coordination_updated_at();
