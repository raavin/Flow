import { createRoute, Link } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  AppButton,
  AppCard,
  AppInput,
  AppPanel,
  AppPill,
  AppSelect,
  AppTextarea,
  FieldLabel,
  SectionHeading,
} from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchCoordinationObjects } from '@/lib/coordination-objects'
import {
  buildRRule,
  createCalendarEvent,
  deleteCalendarEvent,
  describeRRule,
  expandOccurrences,
  fetchAllCalendarEvents,
  fetchExceptionsForEvents,
  toIsoDate,
  updateCalendarEvent,
} from '@/lib/calendar'
import type {
  CalendarEventRow,
  CalendarOccurrence,
  RecurrenceConfig,
  RecurringEditScope,
} from '@/lib/calendar'
import { createMilestone, createTask, fetchProjects } from '@/lib/projects'

// ─── Constants ────────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'day' | 'agenda'

const COLOR_SWATCHES = [
  { value: '', label: 'None' },
  { value: '#6B8E5E', label: 'Green' },
  { value: '#C45A3B', label: 'Terracotta' },
  { value: '#4A90D9', label: 'Blue' },
  { value: '#9B59B6', label: 'Purple' },
  { value: '#E67E22', label: 'Orange' },
  { value: '#1A1A1A', label: 'Black' },
]

const HOURS_START = 7   // 7 am
const HOURS_END = 22    // 10 pm
const PX_PER_HOUR = 60

// ─── Main page ────────────────────────────────────────────────────────────────

export function CalendarPage({ linkedProjectId }: { linkedProjectId?: string | null } = {}) {
  const { session } = useAppStore()
  const queryClient = useQueryClient()

  // ── Navigation state
  const [view, setView] = useState<CalendarView>('month')
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => toIsoDate(new Date()))

  // ── Event editor state
  const [editingOccurrence, setEditingOccurrence] = useState<CalendarOccurrence | null>(null)
  const [title, setTitle] = useState('')
  const [isAllDay, setIsAllDay] = useState(false)
  const [startsAt, setStartsAt] = useState(() => defaultDateTime(new Date()))
  const [endsAt, setEndsAt] = useState(() => defaultDateTime(addHours(new Date(), 1)))
  const [color, setColor] = useState('')
  const [projectId, setProjectId] = useState(linkedProjectId ?? '')
  const [notes, setNotes] = useState('')
  const [rruleConfig, setRruleConfig] = useState<RecurrenceConfig | null>(null)

  // ── Scope modal for recurring edits/deletes
  const [scopeModal, setScopeModal] = useState<{
    mode: 'edit' | 'delete'
    occurrence: CalendarOccurrence
  } | null>(null)

  // ── Project-linked shortcuts
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueOn, setTaskDueOn] = useState(() => toIsoDate(new Date()))
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneStart, setMilestoneStart] = useState(() => toIsoDate(new Date()))
  const [milestoneEnd, setMilestoneEnd] = useState(() => toIsoDate(addDays(new Date(), 1)))
  const [milestoneLane, setMilestoneLane] = useState('Planning')
  const [projectAddModal, setProjectAddModal] = useState<null | 'task' | 'milestone'>(null)

  const titleInputRef = useRef<HTMLInputElement | null>(null)

  // ── Range for occurrence expansion: ±2 months around cursor
  const rangeStart = useMemo(() => addDays(startOfMonth(cursor), -61), [cursor])
  const rangeEnd = useMemo(() => addDays(startOfMonth(cursor), 92), [cursor])

  // ── Queries
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const eventsQuery = useQuery({
    queryKey: ['calendar-events'],
    queryFn: fetchAllCalendarEvents,
  })
  const eventIds = useMemo(
    () => (eventsQuery.data ?? []).map((e) => e.id),
    [eventsQuery.data],
  )
  const exceptionsQuery = useQuery({
    queryKey: ['calendar-exceptions', eventIds],
    queryFn: () => fetchExceptionsForEvents(eventIds),
    enabled: eventIds.length > 0,
  })
  const coordinationQuery = useQuery({
    queryKey: ['coordination-objects', 'calendar'],
    queryFn: () => fetchCoordinationObjects({ onlyTimed: true }),
    enabled: Boolean(session?.user.id),
  })

  // ── Derived data
  const allEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])
  const allExceptions = useMemo(() => exceptionsQuery.data ?? [], [exceptionsQuery.data])

  const occurrences = useMemo(
    () => expandOccurrences(
      linkedProjectId
        ? allEvents.filter((e) => e.projectId === linkedProjectId)
        : allEvents,
      allExceptions,
      rangeStart,
      rangeEnd,
    ),
    [allEvents, allExceptions, rangeStart, rangeEnd, linkedProjectId],
  )

  const projects = projectsQuery.data ?? []
  const timedFlows = useMemo(
    () =>
      (coordinationQuery.data ?? []).filter(
        (item) =>
          item.sourceTable !== 'calendar_events' &&
          (!linkedProjectId || item.linkedProjectId === linkedProjectId),
      ),
    [coordinationQuery.data, linkedProjectId],
  )

  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor])
  const weekDays = useMemo(() => buildWeekDays(selectedDay), [selectedDay])

  const selectedDayOccurrences = useMemo(
    () => occurrences.filter((o) => o.instanceDate === selectedDay),
    [occurrences, selectedDay],
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

  // ── Mutations
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const dtstart = isAllDay ? new Date(`${startsAt}T00:00:00`) : new Date(startsAt)
      return createCalendarEvent({
        ownerId: session!.user.id,
        title,
        startsAt: isAllDay ? `${startsAt}T00:00:00.000Z` : new Date(startsAt).toISOString(),
        endsAt: isAllDay ? `${endsAt}T23:59:59.000Z` : new Date(endsAt).toISOString(),
        projectId: projectId || linkedProjectId || null,
        notes,
        isAllDay,
        color: color || null,
        rrule: rruleConfig ? buildRRule(rruleConfig, dtstart) : null,
      })
    },
    onSuccess: () => {
      resetEditor()
      invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (params: { scope: RecurringEditScope }) => {
      if (!editingOccurrence) throw new Error('No occurrence selected')
      const dtstart = isAllDay
        ? new Date(`${startsAt}T00:00:00`)
        : new Date(startsAt)
      return updateCalendarEvent({
        eventId: editingOccurrence.eventId,
        ownerId: session!.user.id,
        title,
        startsAt: isAllDay ? `${startsAt}T00:00:00.000Z` : new Date(startsAt).toISOString(),
        endsAt: isAllDay ? `${endsAt}T23:59:59.000Z` : new Date(endsAt).toISOString(),
        projectId: projectId || linkedProjectId || null,
        notes,
        isAllDay,
        color: color || null,
        rrule: rruleConfig ? buildRRule(rruleConfig, dtstart) : null,
        scope: params.scope,
        instanceDate: editingOccurrence.instanceDate,
      })
    },
    onSuccess: () => {
      setScopeModal(null)
      resetEditor()
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (params: { scope: RecurringEditScope }) => {
      if (!editingOccurrence) throw new Error('No occurrence selected')
      return deleteCalendarEvent(
        editingOccurrence.eventId,
        params.scope,
        editingOccurrence.instanceDate,
      )
    },
    onSuccess: () => {
      setScopeModal(null)
      resetEditor()
      invalidate()
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createTask({
        projectId: linkedProjectId ?? projectId,
        title: taskTitle.trim(),
        dueOn: taskDueOn,
      }),
    onSuccess: () => {
      setTaskTitle('')
      setTaskDueOn(selectedDay)
      setProjectAddModal(null)
      void queryClient.invalidateQueries({ queryKey: ['project-detail', linkedProjectId] })
    },
  })

  const createMilestoneMutation = useMutation({
    mutationFn: () =>
      createMilestone({
        projectId: linkedProjectId ?? projectId,
        title: milestoneTitle.trim(),
        startsOn: milestoneStart,
        endsOn: milestoneEnd,
        lane: milestoneLane.trim() || 'Planning',
      }),
    onSuccess: () => {
      setMilestoneTitle('')
      setMilestoneStart(selectedDay)
      setMilestoneEnd(selectedDay)
      setMilestoneLane('Planning')
      setProjectAddModal(null)
      void queryClient.invalidateQueries({ queryKey: ['project-detail', linkedProjectId] })
    },
  })

  // ── Helpers
  function resetEditor() {
    setEditingOccurrence(null)
    setTitle('')
    setIsAllDay(false)
    const start = new Date(`${selectedDay}T09:00:00`)
    setStartsAt(defaultDateTime(start))
    setEndsAt(defaultDateTime(addHours(start, 1)))
    setColor('')
    setProjectId(linkedProjectId ?? '')
    setNotes('')
    setRruleConfig(null)
  }

  function loadOccurrence(occ: CalendarOccurrence) {
    setEditingOccurrence(occ)
    setTitle(occ.title)
    setIsAllDay(occ.isAllDay)
    if (occ.isAllDay) {
      setStartsAt(occ.startsAt.slice(0, 10))
      setEndsAt(occ.endsAt.slice(0, 10))
    } else {
      setStartsAt(toLocalDateTimeValue(occ.startsAt))
      setEndsAt(toLocalDateTimeValue(occ.endsAt))
    }
    setColor(occ.color ?? '')
    setProjectId(occ.projectId ?? linkedProjectId ?? '')
    setNotes(occ.notes ?? '')

    // Parse existing rrule into config if present
    if (occ.rrule) {
      // We can't round-trip perfectly, but keep config null and let the
      // RecurrenceEditor show the description. User can reconfigure if needed.
      setRruleConfig(null)
    } else {
      setRruleConfig(null)
    }

    setSelectedDay(occ.instanceDate)
    window.setTimeout(() => titleInputRef.current?.focus(), 40)
  }

  function handleOccurrenceClick(occ: CalendarOccurrence) {
    if (occ.isRecurring) {
      setScopeModal({ mode: 'edit', occurrence: occ })
    } else {
      loadOccurrence(occ)
    }
  }

  function handleSaveClick() {
    if (!editingOccurrence) {
      createMutation.mutate()
      return
    }
    if (editingOccurrence.isRecurring) {
      setScopeModal({ mode: 'edit', occurrence: editingOccurrence })
    } else {
      updateMutation.mutate({ scope: 'all' })
    }
  }

  function handleDeleteClick() {
    if (!editingOccurrence) return
    if (editingOccurrence.isRecurring) {
      setScopeModal({ mode: 'delete', occurrence: editingOccurrence })
    } else {
      deleteMutation.mutate({ scope: 'all' })
    }
  }

  function applyDay(day: string, focusComposer = false) {
    setSelectedDay(day)
    const start = new Date(`${day}T09:00:00`)
    if (!editingOccurrence) {
      setStartsAt(defaultDateTime(start))
      setEndsAt(defaultDateTime(addHours(start, 1)))
    }
    setTaskDueOn(day)
    setMilestoneStart(day)
    setMilestoneEnd(day)
    if (focusComposer) {
      window.setTimeout(() => titleInputRef.current?.focus(), 40)
    }
  }

  // ── Render
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT: calendar grid + selected day panel */}
        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading
              eyebrow={linkedProjectId ? 'Project calendar' : 'Calendar'}
              title={linkedProjectId ? 'Project planner' : 'Interactive planner'}
              action={
                <div className="flex flex-wrap gap-2">
                  <AppButton variant="ghost" onClick={() => setCursor(stepCursor(cursor, view, -1))}>
                    Back
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    onClick={() => {
                      const today = new Date()
                      setCursor(startOfMonth(today))
                      applyDay(toIsoDate(today))
                    }}
                  >
                    Today
                  </AppButton>
                  <AppButton variant="ghost" onClick={() => setCursor(stepCursor(cursor, view, 1))}>
                    Forward
                  </AppButton>
                </div>
              }
            />

            {/* View switcher + shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(['month', 'week', 'day', 'agenda'] as CalendarView[]).map((v) => (
                  <AppButton
                    key={v}
                    variant={view === v ? 'primary' : 'ghost'}
                    onClick={() => setView(v)}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </AppButton>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedProjectId ? (
                  <>
                    <AppButton variant="secondary" onClick={() => setProjectAddModal('milestone')}>
                      Add block
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => setProjectAddModal('task')}>
                      Add task
                    </AppButton>
                  </>
                ) : null}
                {!linkedProjectId ? (
                  <Link to="/app/coordination">
                    <AppButton variant="secondary">Open flows</AppButton>
                  </Link>
                ) : null}
                <Link
                  to={linkedProjectId ? '/app/projects/$projectId/timeline' : '/app/gantt'}
                  params={linkedProjectId ? { projectId: linkedProjectId } : (undefined as never)}
                >
                  <AppButton variant="ghost">Open timeline</AppButton>
                </Link>
              </div>
            </div>

            {/* Period label */}
            <AppPanel tone="butter" className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-extrabold text-ink">
                  {view === 'week'
                    ? weekLabel(selectedDay)
                    : view === 'day'
                      ? selectedDay
                      : monthLabel(cursor)}
                </p>
                <p className="text-sm text-ink/65">
                  Move between calendar, flows, timeline, and linked projects without losing context.
                </p>
              </div>
              <AppPill tone="teal">{selectedDay}</AppPill>
            </AppPanel>

            {view === 'month' ? (
              <MonthView
                days={monthDays}
                occurrences={occurrences}
                flows={timedFlows}
                selectedDay={selectedDay}
                onSelectDay={applyDay}
                onClickOccurrence={handleOccurrenceClick}
              />
            ) : null}
            {view === 'week' ? (
              <WeekView
                days={weekDays}
                occurrences={occurrences}
                flows={timedFlows}
                selectedDay={selectedDay}
                onSelectDay={applyDay}
                onClickOccurrence={handleOccurrenceClick}
              />
            ) : null}
            {view === 'day' ? (
              <DayView
                day={selectedDay}
                occurrences={occurrences}
                flows={timedFlows}
                onClickOccurrence={handleOccurrenceClick}
              />
            ) : null}
            {view === 'agenda' ? (
              <AgendaView
                days={buildAgendaDays(selectedDay, occurrences, timedFlows)}
                onSelectDay={applyDay}
                onClickOccurrence={handleOccurrenceClick}
              />
            ) : null}
          </AppCard>

          {/* Selected day panel */}
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Selected day" title={selectedDay} />
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Calendar events for this day */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink/60">Calendar events</p>
                {selectedDayOccurrences.map((occ) => (
                  <AppPanel key={occ.key} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {occ.color ? (
                          <span
                            className="mt-1 h-3 w-3 shrink-0 rounded-full"
                            style={{ background: occ.color }}
                          />
                        ) : (
                          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-teal" />
                        )}
                        <div>
                          <p className="font-extrabold text-ink">{occ.title}</p>
                          <p className="text-sm text-ink/65">
                            {occ.isAllDay
                              ? 'All day'
                              : `${formatTime(occ.startsAt)} to ${formatTime(occ.endsAt)}`}
                            {occ.isRecurring ? ' · Recurring' : ''}
                          </p>
                        </div>
                      </div>
                      <AppButton variant="ghost" onClick={() => handleOccurrenceClick(occ)}>
                        Edit
                      </AppButton>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {occ.projectId ? (
                        <Link
                          to="/app/projects/$projectId/conversation"
                          params={{ projectId: occ.projectId }}
                        >
                          <AppButton variant="secondary">Open project</AppButton>
                        </Link>
                      ) : null}
                      <Link
                        to={
                          occ.projectId
                            ? '/app/projects/$projectId/timeline'
                            : '/app/gantt'
                        }
                        params={
                          occ.projectId ? { projectId: occ.projectId } : (undefined as never)
                        }
                      >
                        <AppButton variant="ghost">Timeline</AppButton>
                      </Link>
                    </div>
                  </AppPanel>
                ))}
                {!selectedDayOccurrences.length ? (
                  <AppPanel className="text-sm text-ink/60">No calendar events on this day.</AppPanel>
                ) : null}
              </div>

              {/* Coordination clips */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink/60">Coordination clips</p>
                {selectedDayFlows.map((item) => (
                  <AppPanel key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-ink">{item.title}</p>
                        <p className="text-sm text-ink/65">
                          {item.displayKind} · {item.intent}
                        </p>
                      </div>
                      <AppPill tone="butter">{item.state}</AppPill>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/app/coordination/$coordinationId"
                        params={{ coordinationId: item.id }}
                      >
                        <AppButton variant="secondary">Open flow</AppButton>
                      </Link>
                      <Link to="/app/gantt">
                        <AppButton variant="ghost">Timeline</AppButton>
                      </Link>
                      {item.linkedProjectId ? (
                        <Link
                          to="/app/projects/$projectId/conversation"
                          params={{ projectId: item.linkedProjectId }}
                        >
                          <AppButton variant="ghost">Project</AppButton>
                        </Link>
                      ) : null}
                    </div>
                  </AppPanel>
                ))}
                {!selectedDayFlows.length ? (
                  <AppPanel className="text-sm text-ink/60">
                    No extra flow clips landing on this day.
                  </AppPanel>
                ) : null}
                <AppButton
                  variant="secondary"
                  onClick={() => {
                    setEditingOccurrence(null)
                    setTitle('')
                    applyDay(selectedDay, true)
                  }}
                >
                  Quick add for this day
                </AppButton>
              </div>
            </div>
          </AppCard>
        </div>

        {/* RIGHT: event editor */}
        <AppCard className="space-y-4">
          <SectionHeading
            eyebrow={editingOccurrence ? 'Edit event' : 'Add event'}
            title={
              editingOccurrence
                ? 'Update calendar event'
                : linkedProjectId
                  ? 'Add to project calendar'
                  : 'Create calendar event'
            }
          />

          <FieldLabel>
            Title
            <AppInput
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
              placeholder="Doctor appointment, dinner, leave request..."
            />
          </FieldLabel>

          {/* All-day toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => {
                setIsAllDay(e.target.checked)
                if (e.target.checked) {
                  // Collapse to date-only values
                  setStartsAt(startsAt.slice(0, 10))
                  setEndsAt(endsAt.slice(0, 10))
                } else {
                  // Expand back to datetime
                  const base = startsAt.length === 10 ? `${startsAt}T09:00` : startsAt
                  setStartsAt(base)
                  setEndsAt(base.slice(0, 10) + 'T10:00')
                }
              }}
              className="h-4 w-4 accent-teal"
            />
            <span className="text-sm font-bold text-ink">All day</span>
          </label>

          <FieldLabel>
            Starts
            <AppInput
              type={isAllDay ? 'date' : 'datetime-local'}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-2"
            />
          </FieldLabel>
          <FieldLabel>
            Ends
            <AppInput
              type={isAllDay ? 'date' : 'datetime-local'}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-2"
            />
          </FieldLabel>

          {/* Color picker */}
          <div>
            <p className="mb-2 text-sm font-bold text-ink">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.label}
                  onClick={() => setColor(swatch.value)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    color === swatch.value
                      ? 'border-ink scale-110'
                      : 'border-transparent hover:border-ink/30'
                  } ${swatch.value === '' ? 'bg-cloud/80' : ''}`}
                  style={swatch.value ? { background: swatch.value } : undefined}
                >
                  {swatch.value === '' ? (
                    <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-ink/40">
                      ∅
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {!linkedProjectId ? (
            <FieldLabel>
              Linked project
              <AppSelect
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2"
              >
                <option value="">No linked project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </AppSelect>
            </FieldLabel>
          ) : null}

          <FieldLabel>
            Notes
            <AppTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 min-h-24"
              placeholder="Anything that should travel with this event?"
            />
          </FieldLabel>

          {/* Recurrence editor */}
          <RecurrenceEditor
            value={rruleConfig}
            onChange={setRruleConfig}
            existingRrule={editingOccurrence?.rrule ?? null}
            startsAt={isAllDay ? `${startsAt}T00:00:00` : startsAt}
          />

          <div className="flex flex-wrap gap-2">
            <AppButton
              disabled={
                !session ||
                !title.trim() ||
                !startsAt ||
                !endsAt ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              onClick={handleSaveClick}
            >
              {editingOccurrence ? 'Save changes' : 'Add event'}
            </AppButton>
            <AppButton variant="ghost" onClick={resetEditor}>
              {editingOccurrence ? 'Cancel' : 'Reset'}
            </AppButton>
            {editingOccurrence ? (
              <AppButton
                variant="ghost"
                disabled={deleteMutation.isPending}
                onClick={handleDeleteClick}
              >
                Delete
              </AppButton>
            ) : null}
          </div>
        </AppCard>
      </div>

      {/* ── Scope modal for recurring events */}
      {scopeModal ? (
        <RecurringScopeModal
          mode={scopeModal.mode}
          onClose={() => setScopeModal(null)}
          onConfirm={(scope) => {
            if (scopeModal.mode === 'delete') {
              deleteMutation.mutate({ scope })
            } else {
              // Load the occurrence first if we came from clicking (not from save)
              if (!editingOccurrence || editingOccurrence.key !== scopeModal.occurrence.key) {
                loadOccurrence(scopeModal.occurrence)
                setScopeModal(null)
              } else {
                updateMutation.mutate({ scope })
              }
            }
          }}
          isPending={deleteMutation.isPending || updateMutation.isPending}
          onLoadAndEdit={() => {
            loadOccurrence(scopeModal.occurrence)
            setScopeModal(null)
          }}
          isEditMode={scopeModal.mode === 'edit'}
          hasLoadedOccurrence={
            editingOccurrence?.key === scopeModal.occurrence.key
          }
        />
      ) : null}

      {/* ── Project add modal */}
      {projectAddModal && linkedProjectId ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-md space-y-4">
            <SectionHeading
              eyebrow="Add inside project"
              title={projectAddModal === 'milestone' ? 'New timeline block' : 'New dated task'}
              action={
                <button
                  type="button"
                  className="ui-soft-icon-button"
                  onClick={() => setProjectAddModal(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
            {projectAddModal === 'milestone' ? (
              <div className="grid gap-3">
                <AppInput
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="Packing sprint, venue hold..."
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <AppInput
                    type="date"
                    value={milestoneStart}
                    onChange={(e) => setMilestoneStart(e.target.value)}
                  />
                  <AppInput
                    type="date"
                    value={milestoneEnd}
                    onChange={(e) => setMilestoneEnd(e.target.value)}
                  />
                </div>
                <AppInput
                  value={milestoneLane}
                  onChange={(e) => setMilestoneLane(e.target.value)}
                  placeholder="Lane"
                />
                <div className="flex justify-end gap-2">
                  <AppButton variant="ghost" onClick={() => setProjectAddModal(null)}>
                    Cancel
                  </AppButton>
                  <AppButton
                    disabled={
                      !linkedProjectId ||
                      !milestoneTitle.trim() ||
                      !milestoneStart ||
                      !milestoneEnd ||
                      new Date(milestoneStart).getTime() > new Date(milestoneEnd).getTime() ||
                      createMilestoneMutation.isPending
                    }
                    onClick={() => createMilestoneMutation.mutate()}
                  >
                    {createMilestoneMutation.isPending ? 'Adding...' : 'Add block'}
                  </AppButton>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <AppInput
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Send invites, confirm transport..."
                />
                <AppInput
                  type="date"
                  value={taskDueOn}
                  onChange={(e) => setTaskDueOn(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <AppButton variant="ghost" onClick={() => setProjectAddModal(null)}>
                    Cancel
                  </AppButton>
                  <AppButton
                    disabled={
                      !linkedProjectId ||
                      !taskTitle.trim() ||
                      !taskDueOn ||
                      createTaskMutation.isPending
                    }
                    onClick={() => createTaskMutation.mutate()}
                  >
                    {createTaskMutation.isPending ? 'Adding...' : 'Add task'}
                  </AppButton>
                </div>
              </div>
            )}
          </AppCard>
        </div>
      ) : null}
    </>
  )
}

// ─── Recurring scope modal ─────────────────────────────────────────────────────

function RecurringScopeModal({
  mode,
  onClose,
  onConfirm,
  onLoadAndEdit,
  isEditMode,
  hasLoadedOccurrence,
  isPending,
}: {
  mode: 'edit' | 'delete'
  onClose: () => void
  onConfirm: (scope: RecurringEditScope) => void
  onLoadAndEdit: () => void
  isEditMode: boolean
  hasLoadedOccurrence: boolean
  isPending: boolean
}) {
  const verb = mode === 'delete' ? 'Delete' : 'Edit'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <AppCard className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-extrabold text-ink">{verb} recurring event</p>
          <button type="button" className="ui-soft-icon-button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-ink/65">How many occurrences should be affected?</p>
        <div className="grid gap-2">
          {isEditMode && !hasLoadedOccurrence ? (
            <AppButton
              variant="secondary"
              disabled={isPending}
              onClick={onLoadAndEdit}
            >
              {verb} just this event
            </AppButton>
          ) : (
            <AppButton
              variant="secondary"
              disabled={isPending}
              onClick={() => onConfirm('this')}
            >
              {verb} just this event
            </AppButton>
          )}
          <AppButton
            variant="secondary"
            disabled={isPending}
            onClick={() => onConfirm('future')}
          >
            {verb} this and all following events
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={isPending}
            onClick={() => onConfirm('all')}
          >
            {verb} all events in the series
          </AppButton>
        </div>
        <AppButton variant="ghost" onClick={onClose}>
          Cancel
        </AppButton>
      </AppCard>
    </div>
  )
}

// ─── RecurrenceEditor ─────────────────────────────────────────────────────────

function RecurrenceEditor({
  value,
  onChange,
  existingRrule,
  startsAt,
}: {
  value: RecurrenceConfig | null
  onChange: (config: RecurrenceConfig | null) => void
  existingRrule: string | null
  startsAt: string
}) {
  const [open, setOpen] = useState(false)

  const description = value
    ? previewRRule(value, startsAt)
    : existingRrule
      ? describeRRule(existingRrule)
      : 'Does not repeat'

  function handleFreqChange(freq: string) {
    if (freq === '') {
      onChange(null)
      return
    }
    onChange({
      freq: freq as RecurrenceConfig['freq'],
      interval: value?.interval ?? 1,
      byweekday: freq === 'weekly' ? (value?.byweekday ?? []) : undefined,
      endType: value?.endType ?? 'never',
      until: value?.until,
      count: value?.count,
    })
  }

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="rounded-panel border border-white/70 bg-cloud/50 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-sm font-bold text-ink">Recurrence</p>
          <p className="text-xs text-ink/60">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-ink/40" /> : <ChevronDown className="h-4 w-4 text-ink/40" />}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {/* Frequency */}
          <FieldLabel>
            Frequency
            <AppSelect
              value={value?.freq ?? ''}
              onChange={(e) => handleFreqChange(e.target.value)}
              className="mt-1"
            >
              <option value="">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </AppSelect>
          </FieldLabel>

          {value ? (
            <>
              {/* Interval */}
              <FieldLabel>
                Every
                <div className="mt-1 flex items-center gap-2">
                  <AppInput
                    type="number"
                    min={1}
                    max={99}
                    value={value.interval}
                    onChange={(e) =>
                      onChange({ ...value, interval: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-ink/70">
                    {value.freq === 'daily'
                      ? value.interval === 1
                        ? 'day'
                        : 'days'
                      : value.freq === 'weekly'
                        ? value.interval === 1
                          ? 'week'
                          : 'weeks'
                        : value.freq === 'monthly'
                          ? value.interval === 1
                            ? 'month'
                            : 'months'
                          : value.interval === 1
                            ? 'year'
                            : 'years'}
                  </span>
                </div>
              </FieldLabel>

              {/* Day-of-week checkboxes for weekly */}
              {value.freq === 'weekly' ? (
                <div>
                  <p className="mb-1 text-sm font-bold text-ink">On days</p>
                  <div className="flex flex-wrap gap-2">
                    {weekdayLabels.map((label, index) => {
                      const checked = (value.byweekday ?? []).includes(index)
                      return (
                        <label
                          key={label}
                          className={`flex cursor-pointer items-center gap-1 rounded-pill px-2 py-1 text-xs font-bold transition ${
                            checked
                              ? 'bg-teal text-white'
                              : 'bg-white/80 text-ink/70 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={(e) => {
                              const days = value.byweekday ?? []
                              onChange({
                                ...value,
                                byweekday: e.target.checked
                                  ? [...days, index].sort()
                                  : days.filter((d) => d !== index),
                              })
                            }}
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Monthly: just show the day number */}
              {value.freq === 'monthly' ? (
                <p className="text-sm text-ink/60">
                  On day {new Date(startsAt).getDate()} of the month
                </p>
              ) : null}

              {/* End condition */}
              <div>
                <p className="mb-1 text-sm font-bold text-ink">Ends</p>
                <div className="space-y-2">
                  {(
                    [
                      { key: 'never', label: 'Never' },
                      { key: 'date', label: 'On date' },
                      { key: 'count', label: 'After N occurrences' },
                    ] as Array<{ key: RecurrenceConfig['endType']; label: string }>
                  ).map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="rrule-end"
                        checked={value.endType === key}
                        onChange={() => onChange({ ...value, endType: key })}
                        className="accent-teal"
                      />
                      <span className="text-ink">{label}</span>
                      {key === 'date' && value.endType === 'date' ? (
                        <AppInput
                          type="date"
                          value={value.until ?? ''}
                          onChange={(e) => onChange({ ...value, until: e.target.value })}
                          className="ml-2 w-36"
                        />
                      ) : null}
                      {key === 'count' && value.endType === 'count' ? (
                        <AppInput
                          type="number"
                          min={1}
                          max={999}
                          value={value.count ?? 1}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              count: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="ml-2 w-20"
                        />
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <AppPanel tone="butter" className="text-sm text-ink/70">
                {previewRRule(value, startsAt)}
              </AppPanel>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  days,
  occurrences,
  flows,
  selectedDay,
  onSelectDay,
  onClickOccurrence,
}: {
  days: Date[]
  occurrences: CalendarOccurrence[]
  flows: ReturnType<typeof buildFlowList>
  selectedDay: string
  onSelectDay: (day: string, focusComposer?: boolean) => void
  onClickOccurrence: (occ: CalendarOccurrence) => void
}) {
  const today = toIsoDate(new Date())
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-ink/50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toIsoDate(day)
          const dayOccs = occurrences.filter((o) => o.instanceDate === iso)
          const dayFlows = flows.filter((item) => {
            const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            const end = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            return Boolean(start && end && iso >= start && iso <= end)
          })
          const isSelected = iso === selectedDay
          const isToday = iso === today
          const isCurrentMonth = day.getMonth() === days[10].getMonth()
          const visibleOccs = dayOccs.slice(0, 3)
          const extraCount = dayOccs.length - visibleOccs.length + Math.max(0, dayFlows.length - (3 - visibleOccs.length > 0 ? 3 - visibleOccs.length : 0))
          const visibleFlows = dayFlows.slice(0, Math.max(0, 3 - visibleOccs.length))
          const realExtra =
            dayOccs.length + dayFlows.length -
            visibleOccs.length -
            visibleFlows.length

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              onDoubleClick={() => onSelectDay(iso, true)}
              className={`min-h-28 rounded-panel border p-2 text-left transition ${
                isSelected
                  ? 'border-ink bg-butter/50 shadow-card'
                  : 'border-white/70 bg-cloud/70 hover:bg-white/80'
              } ${!isCurrentMonth ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-extrabold ${
                    isToday ? 'bg-teal text-white' : 'text-ink'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayOccs.length + dayFlows.length > 0 ? (
                  <AppPill tone="teal">{dayOccs.length + dayFlows.length}</AppPill>
                ) : null}
              </div>
              <div className="mt-2 space-y-1">
                {visibleOccs.map((occ) => (
                  <button
                    key={occ.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClickOccurrence(occ)
                    }}
                    className="flex w-full items-center gap-1 truncate rounded-pill bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink hover:bg-butter/60"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={
                        occ.color
                          ? { background: occ.color }
                          : { background: 'var(--color-teal, #0d9488)' }
                      }
                    />
                    <span className="truncate">{occ.title}</span>
                  </button>
                ))}
                {visibleFlows.map((item) => (
                  <div
                    key={item.id}
                    className="truncate rounded-pill bg-teal/15 px-1.5 py-0.5 text-[10px] font-bold text-ink"
                  >
                    {item.title}
                  </div>
                ))}
                {realExtra > 0 ? (
                  <p className="text-[10px] font-bold text-ink/50">+{realExtra} more</p>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  days,
  occurrences,
  flows,
  selectedDay,
  onSelectDay,
  onClickOccurrence,
}: {
  days: Date[]
  occurrences: CalendarOccurrence[]
  flows: ReturnType<typeof buildFlowList>
  selectedDay: string
  onSelectDay: (day: string, focusComposer?: boolean) => void
  onClickOccurrence: (occ: CalendarOccurrence) => void
}) {
  const today = toIsoDate(new Date())
  const totalHeight = (HOURS_END - HOURS_START) * PX_PER_HOUR

  // All-day occurrences across the week
  const allDayOccs = occurrences.filter(
    (o) => o.isAllDay && days.some((d) => toIsoDate(d) === o.instanceDate),
  )

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Day headers */}
      <div className="grid min-w-[600px] grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-px bg-white/40">
        <div />
        {days.map((day) => {
          const iso = toIsoDate(day)
          const isToday = iso === today
          const isSelected = iso === selectedDay
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              onDoubleClick={() => onSelectDay(iso, true)}
              className={`rounded-t-panel p-2 text-center transition ${
                isSelected ? 'bg-butter/60' : 'bg-cloud/60 hover:bg-white/70'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-berry/70">
                {day.toLocaleDateString('en-AU', { weekday: 'short' })}
              </p>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-extrabold ${
                  isToday ? 'bg-teal text-white' : 'text-ink'
                }`}
              >
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* All-day strip */}
      {allDayOccs.length > 0 ? (
        <div className="min-w-[600px] grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-px bg-white/40 rounded-panel border border-white/60 p-1">
          <div className="flex items-center justify-end pr-1">
            <span className="text-[9px] font-bold text-ink/40">all day</span>
          </div>
          {days.map((day) => {
            const iso = toIsoDate(day)
            const dayOccs = allDayOccs.filter((o) => o.instanceDate === iso)
            return (
              <div key={iso} className="min-h-6 space-y-0.5 p-0.5">
                {dayOccs.map((occ) => (
                  <button
                    key={occ.key}
                    type="button"
                    onClick={() => onClickOccurrence(occ)}
                    className="w-full truncate rounded-pill px-1.5 py-0.5 text-[10px] font-bold text-white text-left"
                    style={{ background: occ.color ?? 'var(--color-teal, #0d9488)' }}
                  >
                    {occ.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Time grid */}
      <div
        className="relative min-w-[600px] overflow-y-auto rounded-panel border border-white/60 bg-cloud/40"
        style={{ maxHeight: 560 }}
      >
        <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr]" style={{ height: totalHeight }}>
          {/* Hour labels */}
          <div className="relative">
            {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i + HOURS_START).map(
              (hour) => (
                <div
                  key={hour}
                  className="absolute right-1 text-[9px] font-bold text-ink/35"
                  style={{ top: (hour - HOURS_START) * PX_PER_HOUR - 6 }}
                >
                  {formatHour(hour)}
                </div>
              ),
            )}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const iso = toIsoDate(day)
            const timedOccs = occurrences.filter(
              (o) => !o.isAllDay && o.instanceDate === iso,
            )
            const dayFlows = flows.filter((item) => {
              const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
              const end =
                (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
              return Boolean(start && end && iso >= start && iso <= end)
            })
            return (
              <div
                key={iso}
                className="relative border-l border-white/50"
                style={{ height: totalHeight }}
              >
                {/* Hour lines */}
                {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i).map((i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 border-t border-white/50"
                    style={{ top: i * PX_PER_HOUR }}
                  />
                ))}

                {/* Timed event blocks */}
                {timedOccs.map((occ) => {
                  const { top, height } = occurrencePosition(occ)
                  if (height < 2) return null
                  return (
                    <button
                      key={occ.key}
                      type="button"
                      onClick={() => onClickOccurrence(occ)}
                      className="absolute inset-x-0.5 overflow-hidden rounded-control px-1.5 py-0.5 text-left text-[10px] font-bold text-white shadow-sm transition hover:opacity-90"
                      style={{
                        top,
                        height: Math.max(height, 18),
                        background: occ.color ?? 'var(--color-teal, #0d9488)',
                        zIndex: 1,
                      }}
                    >
                      <p className="truncate">{occ.title}</p>
                      {height > 28 ? (
                        <p className="truncate opacity-80">{formatTime(occ.startsAt)}</p>
                      ) : null}
                    </button>
                  )
                })}

                {/* Flow clips (displayed as small strips) */}
                {dayFlows.map((item, idx) => (
                  <div
                    key={item.id}
                    className="absolute inset-x-0.5 rounded-control bg-teal/20 px-1.5 py-0.5 text-[9px] font-bold text-ink"
                    style={{ top: idx * 14, zIndex: 0, opacity: 0.75 }}
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayView({
  day,
  occurrences,
  flows,
  onClickOccurrence,
}: {
  day: string
  occurrences: CalendarOccurrence[]
  flows: ReturnType<typeof buildFlowList>
  onClickOccurrence: (occ: CalendarOccurrence) => void
}) {
  const totalHeight = (HOURS_END - HOURS_START) * PX_PER_HOUR
  const timedOccs = occurrences.filter((o) => !o.isAllDay && o.instanceDate === day)
  const allDayOccs = occurrences.filter((o) => o.isAllDay && o.instanceDate === day)
  const dayFlows = flows.filter((item) => {
    const start = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
    const end = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
    return Boolean(start && end && day >= start && day <= end)
  })

  return (
    <div className="space-y-2">
      {/* All-day strip */}
      {allDayOccs.length > 0 ? (
        <div className="flex flex-wrap gap-1 rounded-panel border border-white/60 bg-cloud/40 p-2">
          <span className="mr-2 text-xs font-bold text-ink/40">All day</span>
          {allDayOccs.map((occ) => (
            <button
              key={occ.key}
              type="button"
              onClick={() => onClickOccurrence(occ)}
              className="rounded-pill px-2 py-0.5 text-xs font-bold text-white"
              style={{ background: occ.color ?? 'var(--color-teal, #0d9488)' }}
            >
              {occ.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Time grid */}
      <div
        className="relative overflow-y-auto rounded-panel border border-white/60 bg-cloud/40"
        style={{ maxHeight: 560 }}
      >
        <div className="grid grid-cols-[3rem_1fr]" style={{ height: totalHeight }}>
          {/* Hour labels */}
          <div className="relative">
            {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i + HOURS_START).map(
              (hour) => (
                <div
                  key={hour}
                  className="absolute right-1 text-[10px] font-bold text-ink/35"
                  style={{ top: (hour - HOURS_START) * PX_PER_HOUR - 6 }}
                >
                  {formatHour(hour)}
                </div>
              ),
            )}
          </div>

          {/* Single day column */}
          <div className="relative border-l border-white/50" style={{ height: totalHeight }}>
            {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i).map((i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-white/50"
                style={{ top: i * PX_PER_HOUR }}
              />
            ))}

            {timedOccs.map((occ) => {
              const { top, height } = occurrencePosition(occ)
              if (height < 2) return null
              return (
                <button
                  key={occ.key}
                  type="button"
                  onClick={() => onClickOccurrence(occ)}
                  className="absolute inset-x-1 overflow-hidden rounded-control px-2 py-1 text-left text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                  style={{
                    top,
                    height: Math.max(height, 22),
                    background: occ.color ?? 'var(--color-teal, #0d9488)',
                    zIndex: 1,
                  }}
                >
                  <p className="truncate">{occ.title}</p>
                  {height > 32 ? (
                    <p className="truncate text-[10px] opacity-80">
                      {formatTime(occ.startsAt)} – {formatTime(occ.endsAt)}
                    </p>
                  ) : null}
                </button>
              )
            })}

            {dayFlows.map((item, idx) => (
              <div
                key={item.id}
                className="absolute inset-x-1 rounded-control bg-teal/20 px-2 py-1 text-[10px] font-bold text-ink"
                style={{ top: idx * 16, zIndex: 0, opacity: 0.8 }}
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Agenda view ──────────────────────────────────────────────────────────────

type AgendaEntry = {
  day: string
  items: Array<{
    key: string
    title: string
    kind: string
    timeLabel: string
    occ: CalendarOccurrence | null
  }>
}

function AgendaView({
  days,
  onSelectDay,
  onClickOccurrence,
}: {
  days: AgendaEntry[]
  onSelectDay: (day: string) => void
  onClickOccurrence: (occ: CalendarOccurrence) => void
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
              <div
                key={item.key}
                className="rounded-control bg-white/85 px-3 py-2"
                role={item.occ ? 'button' : undefined}
                tabIndex={item.occ ? 0 : undefined}
                onClick={() => item.occ && onClickOccurrence(item.occ)}
                onKeyDown={(e) => {
                  if (item.occ && (e.key === 'Enter' || e.key === ' ')) onClickOccurrence(item.occ)
                }}
                style={item.occ ? { cursor: 'pointer' } : undefined}
              >
                <div className="flex items-center gap-2">
                  {item.occ?.color ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: item.occ.color }}
                    />
                  ) : item.occ ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal" />
                  ) : null}
                  <p className="font-bold text-ink">{item.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-ink/55">
                  {item.kind} · {item.timeLabel}
                </p>
              </div>
            ))}
          </div>
        </AppPanel>
      ))}
      {!days.length ? (
        <AppPanel className="text-sm text-ink/60">
          No upcoming items in the next four weeks.
        </AppPanel>
      ) : null}
    </div>
  )
}

// ─── Grid builders ────────────────────────────────────────────────────────────

function buildMonthGrid(cursor: Date) {
  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeekMonday(monthStart)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

function buildWeekDays(selectedDay: string) {
  const base = new Date(`${selectedDay}T00:00:00`)
  const start = startOfWeekMonday(base)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// Type helper to get the right return type for flow list filtering
type FlowItem = Awaited<ReturnType<typeof fetchCoordinationObjects>>[number]
function buildFlowList(items: FlowItem[]) {
  return items
}

function buildAgendaDays(
  selectedDay: string,
  occurrences: CalendarOccurrence[],
  flows: FlowItem[],
): AgendaEntry[] {
  const start = new Date(`${selectedDay}T00:00:00`)
  return Array.from({ length: 28 }, (_, i) => toIsoDate(addDays(start, i)))
    .map((day) => {
      const items: AgendaEntry['items'] = [
        ...occurrences
          .filter((o) => o.instanceDate === day)
          .map((occ) => ({
            key: occ.key,
            title: occ.title,
            kind: occ.isRecurring ? 'recurring event' : 'event',
            timeLabel: occ.isAllDay
              ? 'all day'
              : `${formatTime(occ.startsAt)}–${formatTime(occ.endsAt)}`,
            occ,
          })),
        ...flows
          .filter((item) => {
            const startDay = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            const endDay =
              (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
            return Boolean(startDay && endDay && day >= startDay && day <= endDay)
          })
          .map((item) => ({
            key: item.id,
            title: item.title,
            kind: item.displayKind,
            timeLabel: 'coordination clip',
            occ: null,
          })),
      ]
      return { day, items }
    })
    .filter((entry) => entry.items.length > 0)
}

// ─── Label helpers ────────────────────────────────────────────────────────────

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
  if (view === 'day') return addDays(cursor, direction)
  if (view === 'agenda') return addDays(cursor, direction * 28)
  return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
}

// ─── Date math ────────────────────────────────────────────────────────────────

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

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function formatHour(hour: number) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultDateTime(value: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

// ─── Time-grid positioning ────────────────────────────────────────────────────

function occurrencePosition(occ: CalendarOccurrence): { top: number; height: number } {
  const start = new Date(occ.startsAt)
  const end = new Date(occ.endsAt)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const gridStartMinutes = HOURS_START * 60
  const top = Math.max(0, ((startMinutes - gridStartMinutes) / 60) * PX_PER_HOUR)
  const height = Math.max(0, ((endMinutes - startMinutes) / 60) * PX_PER_HOUR)
  return { top, height }
}

// ─── Recurrence preview ───────────────────────────────────────────────────────

function previewRRule(config: RecurrenceConfig, startsAt: string): string {
  try {
    const dtstart = new Date(startsAt)
    const rruleStr = buildRRule(config, dtstart)
    return describeRRule(rruleStr)
  } catch {
    return 'Custom recurrence'
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'calendar',
  component: CalendarPage,
})
