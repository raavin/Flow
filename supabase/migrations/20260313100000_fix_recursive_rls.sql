create or replace function public.is_dm_thread_member(p_thread_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.dm_thread_members
    where thread_id = p_thread_id
      and user_id = p_user_id
  );
$$;

create or replace function public.is_coordination_participant(p_coordination_object_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.coordination_object_participants
    where coordination_object_id = p_coordination_object_id
      and profile_id = p_user_id
  );
$$;

drop policy if exists "dm_threads_read_member" on public.dm_threads;
create policy "dm_threads_read_member" on public.dm_threads
  for select using (
    auth.uid() = owner_id
    or public.is_dm_thread_member(id, auth.uid())
  );

drop policy if exists "dm_thread_members_read_member" on public.dm_thread_members;
create policy "dm_thread_members_read_member" on public.dm_thread_members
  for select using (
    public.is_dm_thread_member(thread_id, auth.uid())
    or exists (
      select 1 from public.dm_threads
      where dm_threads.id = dm_thread_members.thread_id
        and dm_threads.owner_id = auth.uid()
    )
  );

drop policy if exists "coordination_objects_read_owner_or_participant" on public.coordination_objects;
create policy "coordination_objects_read_owner_or_participant" on public.coordination_objects
  for select using (
    auth.uid() = owner_id
    or public.is_coordination_participant(id, auth.uid())
  );

drop policy if exists "coordination_object_participants_read_member" on public.coordination_object_participants;
create policy "coordination_object_participants_read_member" on public.coordination_object_participants
  for select using (
    public.is_coordination_participant(coordination_object_id, auth.uid())
    or exists (
      select 1 from public.coordination_objects
      where coordination_objects.id = coordination_object_participants.coordination_object_id
        and coordination_objects.owner_id = auth.uid()
    )
  );
