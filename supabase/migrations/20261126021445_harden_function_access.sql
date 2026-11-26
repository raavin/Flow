-- Restrict privileged RPCs to their intended callers. Trigger execution is unaffected.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature, p.prorettype::regtype::text as result_type
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
 loop
  execute format('revoke execute on function %s from public, anon', f.signature);
  if f.result_type in ('trigger','event_trigger') then
   execute format('revoke execute on function %s from authenticated', f.signature);
  else
   execute format('grant execute on function %s to authenticated', f.signature);
  end if;
 end loop;
end $$;
-- API key verification is called by the server-side Edge Function, not browsers.
revoke execute on function public.verify_integration_api_key(text) from public, anon, authenticated;
grant execute on function public.verify_integration_api_key(text) to service_role;

alter function public.handle_profile_updated_at() set search_path = '';
alter function public.handle_social_profile_defaults() set search_path = '';
alter function public.touch_coordination_updated_at() set search_path = '';
alter function public.next_order_number() set search_path = '';
alter function public.handle_updated_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';

-- Keep recursive-RLS helpers, but never disclose another user's membership.
create or replace function public.is_dm_thread_member(p_thread_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select p_user_id = auth.uid() and exists (
  select 1 from public.dm_thread_members where thread_id = p_thread_id and user_id = auth.uid()
 );
$$;
revoke execute on function public.is_dm_thread_member(uuid,uuid) from public, anon;
grant execute on function public.is_dm_thread_member(uuid,uuid) to authenticated;
create or replace function public.is_coordination_participant(p_coordination_object_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select p_user_id = auth.uid() and exists (
  select 1 from public.coordination_object_participants where coordination_object_id = p_coordination_object_id and profile_id = auth.uid()
 );
$$;
revoke execute on function public.is_coordination_participant(uuid,uuid) from public, anon;
grant execute on function public.is_coordination_participant(uuid,uuid) to authenticated;
create or replace function public.is_calendar_event_guest(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select p_user_id = auth.uid() and exists (
  select 1 from public.calendar_event_guests where event_id = p_event_id and profile_id = auth.uid()
 );
$$;
revoke execute on function public.is_calendar_event_guest(uuid,uuid) from public, anon;
grant execute on function public.is_calendar_event_guest(uuid,uuid) to authenticated;
create or replace function public.is_calendar_event_owner(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select p_user_id = auth.uid() and exists (
  select 1 from public.calendar_events where id = p_event_id and owner_id = auth.uid()
 );
$$;
revoke execute on function public.is_calendar_event_owner(uuid,uuid) from public, anon;
grant execute on function public.is_calendar_event_owner(uuid,uuid) to authenticated;
