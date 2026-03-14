import { RRule, RRuleSet, rrulestr } from 'rrule'
import { supabase } from './supabase'
import { syncCalendarCoordinationObject } from './coordination-objects'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEventRow = {
  id: string
  projectId: string | null
  ownerId: string
  title: string
  startsAt: string
  endsAt: string
  notes: string | null
  rrule: string | null
  isAllDay: boolean
  color: string | null
  timezone: string
}

export type CalendarEventException = {
  id: string
  eventId: string
  originalDate: string        // YYYY-MM-DD
  exceptionType: 'deleted' | 'modified'
  newTitle: string | null
  newStartsAt: string | null
  newEndsAt: string | null
  newNotes: string | null
}

// A single calendar occurrence — may be the master event or an expanded instance
export type CalendarOccurrence = {
  // Unique per occurrence: eventId for one-off; eventId_YYYY-MM-DD for recurring
  key: string
  eventId: string
  instanceDate: string        // YYYY-MM-DD of this occurrence
  title: string
  startsAt: string
  endsAt: string
  notes: string | null
  isAllDay: boolean
  color: string | null
  projectId: string | null
  rrule: string | null        // null for one-off or expanded exceptions
  isRecurring: boolean
}

// Scope for editing/deleting a recurring event occurrence
export type RecurringEditScope = 'this' | 'future' | 'all'

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CalendarEventRow {
  return {
    id: row.id as string,
    projectId: (row.project_id as string | null) ?? null,
    ownerId: row.owner_id as string,
    title: row.title as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    notes: (row.notes as string | null) ?? null,
    rrule: (row.rrule as string | null) ?? null,
    isAllDay: (row.is_all_day as boolean) ?? false,
    color: (row.color as string | null) ?? null,
    timezone: (row.timezone as string) ?? 'UTC',
  }
}

function mapException(row: Record<string, unknown>): CalendarEventException {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    originalDate: row.original_date as string,
    exceptionType: row.exception_type as 'deleted' | 'modified',
    newTitle: (row.new_title as string | null) ?? null,
    newStartsAt: (row.new_starts_at as string | null) ?? null,
    newEndsAt: (row.new_ends_at as string | null) ?? null,
    newNotes: (row.new_notes as string | null) ?? null,
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchCalendarEventsInRange(rangeStart: string, rangeEnd: string): Promise<CalendarEventRow[]> {
  // Fetch events that either:
  // - start within range (one-off)
  // - are recurring (we expand client-side)
  // - started before range end (for multi-day events)
  const { data, error } = await supabase!
    .from('calendar_events')
    .select('*')
    .or(`rrule.not.is.null,and(starts_at.lte.${rangeEnd},ends_at.gte.${rangeStart})`)
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchAllCalendarEvents(): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase!
    .from('calendar_events')
    .select('*')
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchExceptionsForEvents(eventIds: string[]): Promise<CalendarEventException[]> {
  if (!eventIds.length) return []
  const { data, error } = await supabase!
    .from('calendar_event_exceptions')
    .select('*')
    .in('event_id', eventIds)

  if (error) throw error
  return (data ?? []).map(mapException)
}

// ─── Occurrence expansion ─────────────────────────────────────────────────────

/**
 * Expands a list of CalendarEventRow records (including recurring) into
 * individual CalendarOccurrence objects for the given date range.
 * Applies exceptions (deleted/modified occurrences) before returning.
 */
export function expandOccurrences(
  events: CalendarEventRow[],
  exceptions: CalendarEventException[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarOccurrence[] {
  const exMap = new Map<string, CalendarEventException>()
  for (const ex of exceptions) {
    exMap.set(`${ex.eventId}_${ex.originalDate}`, ex)
  }

  const results: CalendarOccurrence[] = []

  for (const event of events) {
    if (!event.rrule) {
      // One-off event: include if it overlaps the range
      const start = new Date(event.startsAt)
      const end = new Date(event.endsAt)
      if (start <= rangeEnd && end >= rangeStart) {
        results.push(oneOffOccurrence(event))
      }
      continue
    }

    // Recurring event: expand using rrule
    const masterStart = new Date(event.startsAt)
    const masterEnd = new Date(event.endsAt)
    const durationMs = masterEnd.getTime() - masterStart.getTime()

    let occurrenceDates: Date[]
    try {
      const rule = rrulestr(event.rrule, { dtstart: masterStart, forceset: true }) as RRuleSet
      // Add EXDATE for deleted occurrences so rrule itself skips them
      // (we'll also filter below, but this avoids showing deleted ones)
      occurrenceDates = rule.between(rangeStart, rangeEnd, true)
    } catch {
      // Fallback: just include the master start if in range
      occurrenceDates = masterStart >= rangeStart && masterStart <= rangeEnd ? [masterStart] : []
    }

    for (const occDate of occurrenceDates) {
      const dateKey = toIsoDate(occDate)
      const exKey = `${event.id}_${dateKey}`
      const exception = exMap.get(exKey)

      if (exception?.exceptionType === 'deleted') continue

      const occStart = exception?.newStartsAt ? new Date(exception.newStartsAt) : occDate
      const occEnd = exception?.newEndsAt ? new Date(exception.newEndsAt) : new Date(occDate.getTime() + durationMs)

      results.push({
        key: `${event.id}_${dateKey}`,
        eventId: event.id,
        instanceDate: dateKey,
        title: exception?.newTitle ?? event.title,
        startsAt: occStart.toISOString(),
        endsAt: occEnd.toISOString(),
        notes: exception?.newNotes ?? event.notes,
        isAllDay: event.isAllDay,
        color: event.color,
        projectId: event.projectId,
        rrule: event.rrule,
        isRecurring: true,
      })
    }
  }

  return results.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

function oneOffOccurrence(event: CalendarEventRow): CalendarOccurrence {
  return {
    key: event.id,
    eventId: event.id,
    instanceDate: event.startsAt.slice(0, 10),
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    notes: event.notes,
    isAllDay: event.isAllDay,
    color: event.color,
    projectId: event.projectId,
    rrule: null,
    isRecurring: false,
  }
}

// ─── RRULE builder ────────────────────────────────────────────────────────────

export type RecurrenceConfig = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  byweekday?: number[]    // 0=Mon … 6=Sun
  endType: 'never' | 'date' | 'count'
  until?: string          // YYYY-MM-DD
  count?: number
}

const FREQ_MAP = {
  daily:   RRule.DAILY,
  weekly:  RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly:  RRule.YEARLY,
} as const

const WEEKDAY_MAP = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

export function buildRRule(config: RecurrenceConfig, dtstart: Date): string {
  const options: ConstructorParameters<typeof RRule>[0] = {
    freq: FREQ_MAP[config.freq],
    interval: config.interval,
    dtstart,
  }

  if (config.byweekday?.length) {
    options.byweekday = config.byweekday.map((d) => WEEKDAY_MAP[d])
  }

  if (config.endType === 'date' && config.until) {
    options.until = new Date(`${config.until}T23:59:59Z`)
  } else if (config.endType === 'count' && config.count) {
    options.count = config.count
  }

  return new RRule(options).toString()
}

export function describeRRule(rruleStr: string): string {
  try {
    return rrulestr(rruleStr).toText()
  } catch {
    return rruleStr
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCalendarEvent(params: {
  ownerId: string
  title: string
  startsAt: string
  endsAt: string
  projectId?: string | null
  notes?: string | null
  rrule?: string | null
  isAllDay?: boolean
  color?: string | null
  timezone?: string
}): Promise<CalendarEventRow> {
  const { data, error } = await supabase!
    .from('calendar_events')
    .insert({
      owner_id:   params.ownerId,
      title:      params.title,
      starts_at:  params.startsAt,
      ends_at:    params.endsAt,
      project_id: params.projectId ?? null,
      notes:      params.notes ?? null,
      rrule:      params.rrule ?? null,
      is_all_day: params.isAllDay ?? false,
      color:      params.color ?? null,
      timezone:   params.timezone ?? 'UTC',
    })
    .select()
    .single()

  if (error) throw error
  const event = mapRow(data as Record<string, unknown>)
  await syncCalendarCoordinationObject({
    eventId:   event.id,
    ownerId:   params.ownerId,
    title:     event.title,
    startsAt:  event.startsAt,
    endsAt:    event.endsAt,
    projectId: event.projectId,
  })
  return event
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update a calendar event.
 * For recurring events, scope controls which occurrences are affected:
 *   'all'    — update the master record (affects all future un-excepted occurrences)
 *   'future' — split: create exception (deleted) for all from instanceDate, create new event
 *   'this'   — create a 'modified' exception for just this occurrence date
 */
export async function updateCalendarEvent(params: {
  eventId: string
  ownerId: string
  title: string
  startsAt: string
  endsAt: string
  projectId?: string | null
  notes?: string | null
  rrule?: string | null
  isAllDay?: boolean
  color?: string | null
  timezone?: string
  scope?: RecurringEditScope
  instanceDate?: string      // required when scope is 'this' or 'future'
}): Promise<void> {
  const scope = params.scope ?? 'all'

  if (scope === 'all' || !params.instanceDate) {
    // Just update the master row
    const { error } = await supabase!
      .from('calendar_events')
      .update({
        title:      params.title,
        starts_at:  params.startsAt,
        ends_at:    params.endsAt,
        project_id: params.projectId ?? null,
        notes:      params.notes ?? null,
        rrule:      params.rrule ?? null,
        is_all_day: params.isAllDay ?? false,
        color:      params.color ?? null,
        timezone:   params.timezone ?? 'UTC',
      })
      .eq('id', params.eventId)

    if (error) throw error
    await syncCalendarCoordinationObject({
      eventId:   params.eventId,
      ownerId:   params.ownerId,
      title:     params.title,
      startsAt:  params.startsAt,
      endsAt:    params.endsAt,
      projectId: params.projectId ?? null,
    })
    return
  }

  if (scope === 'this') {
    // Upsert a 'modified' exception for this specific occurrence
    const { error } = await supabase!
      .from('calendar_event_exceptions')
      .upsert({
        event_id:       params.eventId,
        original_date:  params.instanceDate,
        exception_type: 'modified',
        new_title:      params.title,
        new_starts_at:  params.startsAt,
        new_ends_at:    params.endsAt,
        new_notes:      params.notes ?? null,
      }, { onConflict: 'event_id,original_date' })

    if (error) throw error
    return
  }

  // scope === 'future': terminate original series before instanceDate, create new series
  if (scope === 'future') {
    // Fetch the original master to get its rrule
    const { data: master, error: fetchErr } = await supabase!
      .from('calendar_events')
      .select('*')
      .eq('id', params.eventId)
      .single()

    if (fetchErr || !master) throw fetchErr ?? new Error('Event not found')

    // Set UNTIL on the original rrule to the day before instanceDate
    const until = new Date(`${params.instanceDate}T00:00:00Z`)
    until.setDate(until.getDate() - 1)

    let updatedOriginalRRule: string | null = master.rrule as string | null
    if (updatedOriginalRRule) {
      try {
        const parsed = rrulestr(updatedOriginalRRule)
        const opts = { ...parsed.options, until }
        opts.count = null
        updatedOriginalRRule = new RRule(opts).toString()
      } catch {
        updatedOriginalRRule = null
      }
    }

    // Update original to end before instanceDate
    const { error: updateErr } = await supabase!
      .from('calendar_events')
      .update({ rrule: updatedOriginalRRule })
      .eq('id', params.eventId)

    if (updateErr) throw updateErr

    // Create new event starting from instanceDate
    await createCalendarEvent({
      ownerId:   params.ownerId,
      title:     params.title,
      startsAt:  params.startsAt,
      endsAt:    params.endsAt,
      projectId: params.projectId ?? null,
      notes:     params.notes ?? null,
      rrule:     params.rrule ?? null,
      isAllDay:  params.isAllDay ?? false,
      color:     params.color ?? null,
      timezone:  params.timezone ?? 'UTC',
    })
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCalendarEvent(
  eventId: string,
  scope: RecurringEditScope = 'all',
  instanceDate?: string,
): Promise<void> {
  if (scope === 'all') {
    const { error } = await supabase!.from('calendar_events').delete().eq('id', eventId)
    if (error) throw error
    return
  }

  if (scope === 'this' && instanceDate) {
    // Insert a 'deleted' exception
    const { error } = await supabase!
      .from('calendar_event_exceptions')
      .upsert({
        event_id:       eventId,
        original_date:  instanceDate,
        exception_type: 'deleted',
      }, { onConflict: 'event_id,original_date' })

    if (error) throw error
    return
  }

  if (scope === 'future' && instanceDate) {
    // Set UNTIL on original rrule to the day before instanceDate
    const { data: master, error: fetchErr } = await supabase!
      .from('calendar_events')
      .select('rrule')
      .eq('id', eventId)
      .single()

    if (fetchErr || !master) throw fetchErr ?? new Error('Event not found')

    const until = new Date(`${instanceDate}T00:00:00Z`)
    until.setDate(until.getDate() - 1)

    let updatedRRule: string | null = master.rrule as string | null
    if (updatedRRule) {
      try {
        const parsed = rrulestr(updatedRRule)
        const opts = { ...parsed.options, until }
        opts.count = null
        updatedRRule = new RRule(opts).toString()
      } catch {
        updatedRRule = null
      }
    }

    const { error } = await supabase!
      .from('calendar_events')
      .update({ rrule: updatedRRule })
      .eq('id', eventId)

    if (error) throw error
  }
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export async function addGuest(eventId: string, profileId: string, displayName: string): Promise<void> {
  const { error } = await supabase!.from('calendar_event_guests').insert({
    event_id:     eventId,
    profile_id:   profileId,
    display_name: displayName,
  })
  if (error && !error.message.includes('unique')) throw error
}

export async function updateGuestRsvp(guestId: string, rsvpState: 'accepted' | 'declined' | 'tentative'): Promise<void> {
  const { error } = await supabase!
    .from('calendar_event_guests')
    .update({ rsvp_state: rsvpState })
    .eq('id', guestId)
  if (error) throw error
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export { toIsoDate }
