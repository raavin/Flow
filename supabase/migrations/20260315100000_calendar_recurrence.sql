-- ─── Calendar recurrence & exceptions ─────────────────────────────────────────
-- Adds rrule support, all-day events, color, and per-occurrence exceptions
-- to calendar_events. Also adds a guests (participants) table.

-- ── Extend calendar_events ────────────────────────────────────────────────────
alter table public.calendar_events
  add column if not exists rrule       text,          -- RFC 5545 RRULE string, null = one-off
  add column if not exists is_all_day  boolean        not null default false,
  add column if not exists color       text,          -- e.g. '#C45A3B' — optional per-event
  add column if not exists timezone    text           not null default 'UTC',
  add column if not exists updated_at  timestamptz    not null default timezone('utc', now());

-- ── calendar_event_exceptions ─────────────────────────────────────────────────
-- One row per occurrence override: either skip or rescheduled/renamed.
create table if not exists public.calendar_event_exceptions (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null references public.calendar_events (id) on delete cascade,
  original_date   date        not null,                          -- which occurrence date this overrides
  exception_type  text        not null check (exception_type in ('deleted', 'modified')),
  new_title       text,
  new_starts_at   timestamptz,
  new_ends_at     timestamptz,
  new_notes       text,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (event_id, original_date)
);

-- ── calendar_event_guests ─────────────────────────────────────────────────────
-- RSVP/invite list per event (profiles or freeform names)
create table if not exists public.calendar_event_guests (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null references public.calendar_events (id) on delete cascade,
  profile_id      uuid        references public.profiles (id) on delete set null,
  display_name    text        not null,                          -- fallback when no profile
  rsvp_state      text        not null default 'invited'
                                check (rsvp_state in ('invited', 'accepted', 'declined', 'tentative')),
  created_at      timestamptz not null default timezone('utc', now()),
  unique (event_id, profile_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.calendar_event_exceptions enable row level security;
alter table public.calendar_event_guests      enable row level security;

-- Exceptions: owner of parent event can read/write
create policy "calendar_exceptions_owner" on public.calendar_event_exceptions
  for all using (
    exists (
      select 1 from public.calendar_events e
      where e.id = calendar_event_exceptions.event_id
        and e.owner_id = auth.uid()
    )
  );

-- Guests: event owner manages, invited profile can read their own row
create policy "calendar_guests_owner" on public.calendar_event_guests
  for all using (
    exists (
      select 1 from public.calendar_events e
      where e.id = calendar_event_guests.event_id
        and e.owner_id = auth.uid()
    )
  );

create policy "calendar_guests_self" on public.calendar_event_guests
  for select using (profile_id = auth.uid());

-- ── Existing calendar_events policies (already exist but need coverage) ───────
-- Events: owner can do everything; guests can read events they're invited to
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'calendar_events'
      and policyname = 'calendar_events_invited_select'
  ) then
    execute $pol$
      create policy "calendar_events_invited_select" on public.calendar_events
        for select using (
          owner_id = auth.uid()
          or exists (
            select 1 from public.calendar_event_guests g
            where g.event_id   = calendar_events.id
              and g.profile_id = auth.uid()
          )
        )
    $pol$;
  end if;
end;
$$;

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();
