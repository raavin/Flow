create table if not exists public.job_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  customer_visible boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  linked_project_id uuid references public.projects (id) on delete set null,
  prompt text not null,
  suggestion_type text not null,
  suggestion_title text not null,
  suggestion_detail text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'ignored')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.job_workflow_steps enable row level security;
alter table public.ai_actions enable row level security;

create policy "job_workflow_steps_read_own" on public.job_workflow_steps
  for select using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.jobs
      where jobs.id = job_workflow_steps.job_id
        and jobs.owner_id = auth.uid()
    )
  );

create policy "job_workflow_steps_write_own" on public.job_workflow_steps
  for all using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.jobs
      where jobs.id = job_workflow_steps.job_id
        and jobs.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.jobs
      where jobs.id = job_workflow_steps.job_id
        and jobs.owner_id = auth.uid()
    )
  );

create policy "ai_actions_read_own" on public.ai_actions
  for select using (auth.uid() = owner_id);

create policy "ai_actions_write_own" on public.ai_actions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
