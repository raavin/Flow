-- Fix circular RLS between calendar_events ↔ calendar_event_guests.
-- The calendar_events_invited_select policy references calendar_event_guests,
-- and calendar_guests_owner references calendar_events — mutual recursion.
-- Same pattern as 20260313100000_fix_recursive_rls.sql.

-- ── Security-definer helpers ───────────────────────────────────────────────

create or replace function public.is_calendar_event_guest(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.calendar_event_guests
    where event_id  = p_event_id
      and profile_id = p_user_id
  );
$$;

create or replace function public.is_calendar_event_owner(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.calendar_events
    where id       = p_event_id
      and owner_id = p_user_id
  );
$$;

-- ── Drop and recreate the offending policies ───────────────────────────────

drop policy if exists "calendar_events_invited_select" on public.calendar_events;
create policy "calendar_events_invited_select" on public.calendar_events
  for select using (
    owner_id = auth.uid()
    or public.is_calendar_event_guest(id, auth.uid())
  );

drop policy if exists "calendar_guests_owner" on public.calendar_event_guests;
create policy "calendar_guests_owner" on public.calendar_event_guests
  for all using (
    public.is_calendar_event_owner(event_id, auth.uid())
  );

drop policy if exists "calendar_exceptions_owner" on public.calendar_event_exceptions;
create policy "calendar_exceptions_owner" on public.calendar_event_exceptions
  for all using (
    public.is_calendar_event_owner(event_id, auth.uid())
  );
