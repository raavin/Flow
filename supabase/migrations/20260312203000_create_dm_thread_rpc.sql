create or replace function public.create_dm_thread(
  p_title text,
  p_thread_kind text,
  p_linked_project_id uuid,
  p_member_ids uuid[]
)
returns table (
  id uuid,
  title text,
  thread_kind text,
  linked_project_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_thread_id uuid := gen_random_uuid();
begin
  v_owner_id := auth.uid();

  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_thread_kind not in ('direct', 'group') then
    raise exception 'Invalid thread kind';
  end if;

  insert into public.dm_threads (id, owner_id, title, thread_kind, linked_project_id)
  values (v_thread_id, v_owner_id, coalesce(p_title, ''), p_thread_kind, p_linked_project_id);

  insert into public.dm_thread_members (thread_id, user_id)
  select v_thread_id, member_id
  from (
    select distinct unnest(array_append(coalesce(p_member_ids, '{}'), v_owner_id)) as member_id
  ) members;

  return query
  select dm_threads.id, dm_threads.title, dm_threads.thread_kind, dm_threads.linked_project_id, dm_threads.created_at
  from public.dm_threads
  where dm_threads.id = v_thread_id;
end;
$$;
