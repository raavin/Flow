create table if not exists public.coordination_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_table text,
  source_id uuid,
  kind text not null check (
    kind in (
      'message',
      'dm_thread',
      'event',
      'reminder',
      'task',
      'booking',
      'purchase',
      'request',
      'plan',
      'project',
      'workflow',
      'job',
      'listing',
      'template'
    )
  ),
  display_kind text not null check (
    display_kind in ('chat', 'event', 'task', 'booking', 'purchase', 'reminder', 'plan', 'project', 'workflow')
  ),
  title text not null,
  summary text,
  intent text not null check (
    intent in (
      'coordinate',
      'meet',
      'attend',
      'buy',
      'book',
      'remind',
      'notify',
      'ask',
      'deliver',
      'celebrate',
      'travel',
      'health',
      'work',
      'support',
      'custom'
    )
  ),
  state text not null default 'draft' check (
    state in ('draft', 'pending', 'scheduled', 'active', 'blocked', 'completed', 'cancelled', 'archived')
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  is_all_day boolean not null default false,
  flexibility text not null default 'fixed' check (flexibility in ('fixed', 'shiftable', 'floating')),
  parent_id uuid references public.coordination_objects (id) on delete set null,
  linked_project_id uuid references public.projects (id) on delete set null,
  linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  linked_job_id uuid references public.jobs (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_table, source_id)
);

create table if not exists public.coordination_object_participants (
  id uuid primary key default gen_random_uuid(),
  coordination_object_id uuid not null references public.coordination_objects (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  participant_name text not null,
  role text not null check (role in ('owner', 'participant', 'viewer', 'provider', 'customer', 'assignee', 'watcher')),
  state text not null default 'active' check (state in ('invited', 'active', 'blocked', 'declined', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (coordination_object_id, profile_id)
);

create table if not exists public.coordination_object_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_id uuid not null references public.coordination_objects (id) on delete cascade,
  successor_id uuid not null references public.coordination_objects (id) on delete cascade,
  dependency_kind text not null default 'blocks' check (dependency_kind in ('blocks', 'supports', 'follows', 'overlaps', 'duplicates')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (predecessor_id, successor_id, dependency_kind),
  check (predecessor_id <> successor_id)
);

create table if not exists public.coordination_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  summary text,
  display_kind text not null check (
    display_kind in ('chat', 'event', 'task', 'booking', 'purchase', 'reminder', 'plan', 'project', 'workflow')
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coordination_objects enable row level security;
alter table public.coordination_object_participants enable row level security;
alter table public.coordination_object_dependencies enable row level security;
alter table public.coordination_templates enable row level security;

create policy "coordination_objects_read_owner_or_participant" on public.coordination_objects
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.coordination_object_participants
      where coordination_object_participants.coordination_object_id = coordination_objects.id
        and coordination_object_participants.profile_id = auth.uid()
    )
  );

create policy "coordination_objects_write_owner" on public.coordination_objects
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "coordination_object_participants_read_member" on public.coordination_object_participants
  for select using (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_participants.coordination_object_id
        and (
          coordination_objects.owner_id = auth.uid()
          or exists (
            select 1 from public.coordination_object_participants as membership
            where membership.coordination_object_id = coordination_object_participants.coordination_object_id
              and membership.profile_id = auth.uid()
          )
        )
    )
  );

create policy "coordination_object_participants_write_owner" on public.coordination_object_participants
  for all using (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_participants.coordination_object_id
        and coordination_objects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_participants.coordination_object_id
        and coordination_objects.owner_id = auth.uid()
    )
  );

create policy "coordination_object_dependencies_read_member" on public.coordination_object_dependencies
  for select using (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_dependencies.predecessor_id
        and (
          coordination_objects.owner_id = auth.uid()
          or exists (
            select 1 from public.coordination_object_participants
            where coordination_object_participants.coordination_object_id = coordination_objects.id
              and coordination_object_participants.profile_id = auth.uid()
          )
        )
    )
  );

create policy "coordination_object_dependencies_write_owner" on public.coordination_object_dependencies
  for all using (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_dependencies.predecessor_id
        and coordination_objects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_dependencies.predecessor_id
        and coordination_objects.owner_id = auth.uid()
    )
  );

create policy "coordination_templates_read_owner" on public.coordination_templates
  for select using (auth.uid() = owner_id);

create policy "coordination_templates_write_owner" on public.coordination_templates
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create or replace function public.touch_coordination_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists coordination_objects_touch_updated_at on public.coordination_objects;
create trigger coordination_objects_touch_updated_at
  before update on public.coordination_objects
  for each row execute function public.touch_coordination_updated_at();

drop trigger if exists coordination_templates_touch_updated_at on public.coordination_templates;
create trigger coordination_templates_touch_updated_at
  before update on public.coordination_templates
  for each row execute function public.touch_coordination_updated_at();
