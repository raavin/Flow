import { createRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, AppTextarea, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchCoordinationObjects } from '@/lib/coordination-objects'
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, fetchProjects, updateCalendarEvent } from '@/lib/projects'

type CalendarView = 'month' | 'week' | 'agenda'

function CalendarPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const [view, setView] = useState<CalendarView>('month')
  const [cursor, setCursor] = useState(startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(toIsoDate(new Date()))
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState(defaultDateTime(new Date()))
  const [endsAt, setEndsAt] = useState(defaultDateTime(addHours(new Date(), 1)))
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const eventsQuery = useQuery({ queryKey: ['calendar-events'], queryFn: fetchCalendarEvents })
  const coordinationQuery = useQuery({
    queryKey: ['coordination-objects', 'calendar'],
    queryFn: () => fetchCoordinationObjects({ onlyTimed: true }),
    enabled: Boolean(session?.user.id),
  })

  const calendarEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])
  const projects = projectsQuery.data ?? []
  const timedFlows = useMemo(
    () => (coordinationQuery.data ?? []).filter((item) => item.sourceTable !== 'calendar_events'),
    [coordinationQuery.data],
  )

  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor])
  const weekDays = useMemo(() => buildWeekDays(selectedDay), [selectedDay])
  const selectedDayEvents = useMemo(
    () => calendarEvents.filter((item) => item.startsAt.slice(0, 10) === selectedDay),
    [calendarEvents, selectedDay],
  )
  const selectedDayFlows = useMemo(
    () =>
      timedFlows.filter((item) => {
        const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
        const end = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
        return Boolean(start && end && selectedDay >= start && selectedDay <= end)
      }),
    [selectedDay, timedFlows],
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createCalendarEvent({
        ownerId: session!.user.id,
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        projectId: projectId || null,
        notes,
      }),
    onSuccess: () => {
      resetEditor()
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCalendarEvent({
        eventId: editingEventId!,
        ownerId: session!.user.id,
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        projectId: projectId || null,
        notes,
      }),
    onSuccess: () => {
      resetEditor()
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCalendarEvent(editingEventId!),
    onSuccess: () => {
      resetEditor()
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  function resetEditor() {
    setEditingEventId(null)
    setTitle('')
    const start = new Date(`${selectedDay}T09:00:00`)
    setStartsAt(defaultDateTime(start))
    setEndsAt(defaultDateTime(addHours(start, 1)))
    setProjectId('')
    setNotes('')
  }

  function loadEvent(eventId: string) {
    const event = calendarEvents.find((item) => item.id === eventId)
    if (!event) return
    setEditingEventId(event.id)
    setTitle(event.title)
    setStartsAt(toLocalDateTimeValue(event.startsAt))
    setEndsAt(toLocalDateTimeValue(event.endsAt))
    setProjectId(event.projectId ?? '')
    setNotes(event.notes ?? '')
    setSelectedDay(event.startsAt.slice(0, 10))
  }

  function applyDay(day: string) {
    setSelectedDay(day)
    const start = new Date(`${day}T09:00:00`)
    if (!editingEventId) {
      setStartsAt(defaultDateTime(start))
      setEndsAt(defaultDateTime(addHours(start, 1)))
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <AppCard className="space-y-4">
          <SectionHeading
            eyebrow="Calendar"
            title="Interactive planner"
            action={
              <div className="flex flex-wrap gap-2">
                <AppButton variant="ghost" onClick={() => setCursor(stepCursor(cursor, view, -1))}>
                  Back
                </AppButton>
                <AppButton variant="ghost" onClick={() => {
                  const today = new Date()
                  setCursor(startOfMonth(today))
                  applyDay(toIsoDate(today))
                }}>
                  Today
                </AppButton>
                <AppButton variant="ghost" onClick={() => setCursor(stepCursor(cursor, view, 1))}>
                  Forward
                </AppButton>
              </div>
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['month', 'week', 'agenda'] as CalendarView[]).map((item) => (
                <AppButton key={item} variant={view === item ? 'primary' : 'ghost'} onClick={() => setView(item)}>
                  {item[0].toUpperCase() + item.slice(1)}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/app/coordination">
                <AppButton variant="secondary">Open flows</AppButton>
              </Link>
              <Link to="/app/gantt">
                <AppButton variant="ghost">Open timeline</AppButton>
              </Link>
            </div>
          </div>
          <AppPanel tone="butter" className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-ink">{view === 'week' ? weekLabel(selectedDay) : monthLabel(cursor)}</p>
              <p className="text-sm text-ink/65">Move between calendar, flows, timeline, and linked projects without losing context.</p>
            </div>
            <AppPill tone="teal">{selectedDay}</AppPill>
          </AppPanel>

          {view === 'month' ? (
            <MonthView days={monthDays} events={calendarEvents} flows={timedFlows} selectedDay={selectedDay} onSelectDay={applyDay} />
          ) : null}
          {view === 'week' ? (
            <WeekView days={weekDays} events={calendarEvents} flows={timedFlows} selectedDay={selectedDay} onSelectDay={applyDay} />
          ) : null}
          {view === 'agenda' ? (
            <AgendaView days={buildAgendaDays(selectedDay, calendarEvents, timedFlows)} onSelectDay={applyDay} />
          ) : null}
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Selected day" title={selectedDay} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-bold text-ink/60">Calendar events</p>
              {selectedDayEvents.map((event) => (
                <AppPanel key={event.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-ink">{event.title}</p>
                      <p className="text-sm text-ink/65">
                        {formatTime(event.startsAt)} to {formatTime(event.endsAt)}
                      </p>
                    </div>
                    <AppButton variant="ghost" onClick={() => loadEvent(event.id)}>
                      Edit
                    </AppButton>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.projectId ? (
                      <Link to="/app/projects/$projectId" params={{ projectId: event.projectId }}>
                        <AppButton variant="secondary">Open project</AppButton>
                      </Link>
                    ) : null}
                    <Link to="/app/gantt">
                      <AppButton variant="ghost">Timeline</AppButton>
                    </Link>
                  </div>
                </AppPanel>
              ))}
              {!selectedDayEvents.length ? <AppPanel className="text-sm text-ink/60">No calendar events on this day.</AppPanel> : null}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-bold text-ink/60">Coordination clips</p>
              {selectedDayFlows.map((item) => (
                <AppPanel key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-ink">{item.title}</p>
                      <p className="text-sm text-ink/65">{item.displayKind} · {item.intent}</p>
                    </div>
                    <AppPill tone="butter">{item.state}</AppPill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/app/coordination">
                      <AppButton variant="secondary">Open flow board</AppButton>
                    </Link>
                    <Link to="/app/gantt">
                      <AppButton variant="ghost">Timeline</AppButton>
                    </Link>
                    {item.linkedProjectId ? (
                      <Link to="/app/projects/$projectId" params={{ projectId: item.linkedProjectId }}>
                        <AppButton variant="ghost">Project</AppButton>
                      </Link>
                    ) : null}
                  </div>
                </AppPanel>
              ))}
              {!selectedDayFlows.length ? <AppPanel className="text-sm text-ink/60">No extra flow clips landing on this day.</AppPanel> : null}
            </div>
          </div>
        </AppCard>
      </div>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow={editingEventId ? 'Edit event' : 'Add event'} title={editingEventId ? 'Update calendar event' : 'Create calendar event'} />
        <FieldLabel>
          Title
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" placeholder="Doctor appointment, dinner, leave request..." />
        </FieldLabel>
        <FieldLabel>
          Starts
          <AppInput type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2" />
        </FieldLabel>
        <FieldLabel>
          Ends
          <AppInput type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2" />
        </FieldLabel>
        <FieldLabel>
          Linked project
          <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2">
            <option value="">No linked project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </AppSelect>
        </FieldLabel>
        <FieldLabel>
          Notes
          <AppTextarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-24" placeholder="Anything that should travel with this event?" />
        </FieldLabel>
        <div className="flex flex-wrap gap-2">
          <AppButton
            disabled={!session || !title.trim() || !startsAt || !endsAt || createMutation.isPending || updateMutation.isPending}
            onClick={() => (editingEventId ? updateMutation.mutate() : createMutation.mutate())}
          >
            {editingEventId ? 'Save changes' : 'Add event'}
          </AppButton>
          <AppButton variant="ghost" onClick={() => resetEditor()}>
            Reset
          </AppButton>
          {editingEventId ? (
            <AppButton variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Delete
            </AppButton>
          ) : null}
        </div>
      </AppCard>
    </div>
  )
}

function MonthView({
  days,
  events,
  flows,
  selectedDay,
  onSelectDay,
}: {
  days: Date[]
  events: Awaited<ReturnType<typeof fetchCalendarEvents>>
  flows: Awaited<ReturnType<typeof fetchCoordinationObjects>>
  selectedDay: string
  onSelectDay: (day: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-ink/50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const iso = toIsoDate(day)
          const dayEvents = events.filter((event) => event.startsAt.slice(0, 10) === iso)
          const dayFlows = flows.filter((item) => {
            const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            const end = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            return Boolean(start && end && iso >= start && iso <= end)
          })
          const isSelected = iso === selectedDay
          const isCurrentMonth = day.getMonth() === days[10].getMonth()

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`min-h-28 rounded-panel border p-3 text-left transition ${isSelected ? 'border-ink bg-butter/50 shadow-card' : 'border-white/70 bg-cloud/70 hover:bg-white/80'} ${!isCurrentMonth ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-ink">{day.getDate()}</p>
                {dayEvents.length || dayFlows.length ? <AppPill tone="teal">{dayEvents.length + dayFlows.length}</AppPill> : null}
              </div>
              <div className="mt-3 space-y-2">
                {dayEvents.slice(0, 2).map((event) => (
                  <div key={event.id} className="truncate rounded-pill bg-white px-2 py-1 text-[11px] font-bold text-ink">
                    {formatTime(event.startsAt)} {event.title}
                  </div>
                ))}
                {dayFlows.slice(0, 1).map((item) => (
                  <div key={item.id} className="truncate rounded-pill bg-teal/15 px-2 py-1 text-[11px] font-bold text-ink">
                    {item.title}
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  days,
  events,
  flows,
  selectedDay,
  onSelectDay,
}: {
  days: Date[]
  events: Awaited<ReturnType<typeof fetchCalendarEvents>>
  flows: Awaited<ReturnType<typeof fetchCoordinationObjects>>
  selectedDay: string
  onSelectDay: (day: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const iso = toIsoDate(day)
        const dayEvents = events.filter((event) => event.startsAt.slice(0, 10) === iso)
        const dayFlows = flows.filter((item) => {
          const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
          const end = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
          return Boolean(start && end && iso >= start && iso <= end)
        })
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelectDay(iso)}
            className={`ui-panel min-h-56 text-left transition ${iso === selectedDay ? 'ring-2 ring-ink/15' : ''}`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-berry/70">{day.toLocaleDateString('en-AU', { weekday: 'short' })}</p>
            <p className="mt-1 text-lg font-extrabold text-ink">{day.getDate()}</p>
            <div className="mt-4 space-y-2">
              {dayEvents.map((event) => (
                <div key={event.id} className="rounded-control bg-white/90 px-3 py-2 text-sm font-bold text-ink">
                  <p>{event.title}</p>
                  <p className="text-xs text-ink/55">{formatTime(event.startsAt)}</p>
                </div>
              ))}
              {dayFlows.map((item) => (
                <div key={item.id} className="rounded-control bg-teal/10 px-3 py-2 text-sm font-bold text-ink">
                  <p>{item.title}</p>
                  <p className="text-xs text-ink/55">{item.displayKind}</p>
                </div>
              ))}
              {!dayEvents.length && !dayFlows.length ? <p className="text-sm text-ink/50">Open space</p> : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function AgendaView({
  days,
  onSelectDay,
}: {
  days: Array<{ day: string; items: Array<{ id: string; title: string; kind: string; timeLabel: string }> }>
  onSelectDay: (day: string) => void
}) {
  return (
    <div className="space-y-3">
      {days.map((entry) => (
        <AppPanel key={entry.day} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-extrabold text-ink">{entry.day}</p>
            <AppButton variant="ghost" onClick={() => onSelectDay(entry.day)}>
              Focus day
            </AppButton>
          </div>
          <div className="space-y-2">
            {entry.items.map((item) => (
              <div key={item.id} className="rounded-control bg-white/85 px-3 py-2">
                <p className="font-bold text-ink">{item.title}</p>
                <p className="text-xs text-ink/55">{item.kind} · {item.timeLabel}</p>
              </div>
            ))}
          </div>
        </AppPanel>
      ))}
      {!days.length ? <AppPanel className="text-sm text-ink/60">No upcoming items in the next two weeks.</AppPanel> : null}
    </div>
  )
}

function buildMonthGrid(cursor: Date) {
  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeekMonday(monthStart)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

function buildWeekDays(selectedDay: string) {
  const base = new Date(`${selectedDay}T00:00:00`)
  const start = startOfWeekMonday(base)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function buildAgendaDays(
  selectedDay: string,
  events: Awaited<ReturnType<typeof fetchCalendarEvents>>,
  flows: Awaited<ReturnType<typeof fetchCoordinationObjects>>,
) {
  const start = new Date(`${selectedDay}T00:00:00`)
  return Array.from({ length: 14 }, (_, index) => toIsoDate(addDays(start, index)))
    .map((day) => {
      const items = [
        ...events
          .filter((event) => event.startsAt.slice(0, 10) === day)
          .map((event) => ({ id: event.id, title: event.title, kind: 'event', timeLabel: `${formatTime(event.startsAt)}-${formatTime(event.endsAt)}` })),
        ...flows
          .filter((item) => {
            const startDay = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            const endDay = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            return Boolean(startDay && endDay && day >= startDay && day <= endDay)
          })
          .map((item) => ({ id: item.id, title: item.title, kind: item.displayKind, timeLabel: 'coordination clip' })),
      ]

      return { day, items }
    })
    .filter((entry) => entry.items.length)
}

function monthLabel(cursor: Date) {
  return cursor.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

function weekLabel(selectedDay: string) {
  const base = new Date(`${selectedDay}T00:00:00`)
  const start = startOfWeekMonday(base)
  const end = addDays(start, 6)
  return `${toIsoDate(start)} to ${toIsoDate(end)}`
}

function stepCursor(cursor: Date, view: CalendarView, direction: -1 | 1) {
  if (view === 'week') return addDays(cursor, direction * 7)
  if (view === 'agenda') return addDays(cursor, direction * 14)
  return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfWeekMonday(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const offset = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + offset)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function addHours(date: Date, hours: number) {
  const copy = new Date(date)
  copy.setHours(copy.getHours() + hours)
  return copy
}

function toIsoDate(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'calendar',
  component: CalendarPage,
})
