create table if not exists public.coordination_messages (
  id uuid primary key default gen_random_uuid(),
  coordination_object_id uuid not null references public.coordination_objects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  visibility text not null default 'participants' check (visibility in ('private', 'participants', 'followers')),
  source_post_id uuid references public.posts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coordination_messages enable row level security;

create policy "coordination_messages_read_member" on public.coordination_messages
  for select using (
    exists (
      select 1
      from public.coordination_objects
      where coordination_objects.id = coordination_messages.coordination_object_id
        and (
          coordination_objects.owner_id = auth.uid()
          or public.is_coordination_participant(coordination_messages.coordination_object_id, auth.uid())
        )
    )
  );

create policy "coordination_messages_write_member" on public.coordination_messages
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.coordination_objects
      where coordination_objects.id = coordination_messages.coordination_object_id
        and (
          coordination_objects.owner_id = auth.uid()
          or public.is_coordination_participant(coordination_messages.coordination_object_id, auth.uid())
        )
    )
  );

create policy "coordination_messages_update_author" on public.coordination_messages
  for update using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop trigger if exists coordination_messages_touch_updated_at on public.coordination_messages;
create trigger coordination_messages_touch_updated_at
  before update on public.coordination_messages
  for each row execute function public.touch_coordination_updated_at();
