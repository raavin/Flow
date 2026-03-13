create table if not exists public.project_listing_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings (id) on delete cascade,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, listing_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_on date,
  assignee_name text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.project_listing_links enable row level security;
alter table public.tasks enable row level security;

create policy "project_listing_links_read_own" on public.project_listing_links
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_listing_links.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "project_listing_links_write_own" on public.project_listing_links
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = project_listing_links.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_listing_links.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "tasks_read_own" on public.tasks
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = tasks.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "tasks_write_own" on public.tasks
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = tasks.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = tasks.project_id
        and projects.owner_id = auth.uid()
    )
  );
