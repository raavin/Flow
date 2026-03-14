import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { fetchCoordinationObjects, updateCoordinationObjectSchedule } from '@/lib/coordination-objects'
import {
  createMilestone,
  createTask,
  fetchProjectDetail,
  fetchProjects,
  moveTaskDueDate,
  resizeMilestoneBoundary,
  shiftMilestone,
} from '@/lib/projects'

type GanttItem = {
  id: string
  title: string
  startsOn: string
  endsOn: string
  lane: string
  isTask: boolean
  source: 'milestone' | 'task' | 'coordination'
  scheduleMode: 'range' | 'due'
}

type ZoomLevel = 'detail' | 'comfortable' | 'overview' | 'strategic'
type TimelineMode = 'project' | 'coordination'

type DragMode = 'move' | 'start' | 'end'

type DragState = {
  itemId: string
  mode: DragMode
}

const zoomConfig: Record<ZoomLevel, { label: string; cellWidth: number; labelEvery: number }> = {
  detail: { label: 'Detail', cellWidth: 54, labelEvery: 1 },
  comfortable: { label: 'Comfortable', cellWidth: 34, labelEvery: 2 },
  overview: { label: 'Overview', cellWidth: 22, labelEvery: 5 },
  strategic: { label: 'Strategic', cellWidth: 14, labelEvery: 10 },
}

const TRACK_COLORS = [
  '#4A6FA5',
  '#6B8E5E',
  '#C45A3B',
  '#9B7FA6',
  '#C4883B',
  '#5B8A8A',
  '#A65B5B',
  '#6B7B8A',
]

const LABEL_WIDTH = 240
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 72

export function GanttPage({ linkedProjectId }: { linkedProjectId?: string | null } = {}) {
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [selectedProjectId, setSelectedProjectId] = useState<string>(linkedProjectId ?? '')
  const [timelineMode, setTimelineMode] = useState<TimelineMode>(linkedProjectId ? 'project' : 'coordination')
  const [zoom, setZoom] = useState<ZoomLevel>('comfortable')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragDays, setDragDays] = useState(0)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneStart, setMilestoneStart] = useState(defaultTimelineDay())
  const [milestoneEnd, setMilestoneEnd] = useState(defaultTimelineDay(1))
  const [milestoneLane, setMilestoneLane] = useState('Planning')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueOn, setTaskDueOn] = useState(defaultTimelineDay())
  const [addModal, setAddModal] = useState<null | 'milestone' | 'task'>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [localOverrides, setLocalOverrides] = useState<Record<string, { startsOn: string; endsOn: string }>>({})

  useEffect(() => {
    if (linkedProjectId) {
      setSelectedProjectId(linkedProjectId)
      setTimelineMode('project')
      return
    }
    if (!selectedProjectId && projectsQuery.data?.[0]?.id) {
      setSelectedProjectId(projectsQuery.data[0].id)
    }
  }, [linkedProjectId, projectsQuery.data, selectedProjectId])

  const detailQuery = useQuery({
    queryKey: ['project-detail', selectedProjectId],
    queryFn: () => fetchProjectDetail(selectedProjectId!),
    enabled: timelineMode === 'project' && Boolean(selectedProjectId),
  })

  const coordinationQuery = useQuery({
    queryKey: ['coordination-objects', 'timeline'],
    queryFn: () => fetchCoordinationObjects({ onlyTimed: true }),
    enabled: timelineMode === 'coordination',
  })

  const items = useMemo<GanttItem[]>(() => {
    if (timelineMode === 'coordination') {
      return (coordinationQuery.data ?? [])
        .map((item) => {
          const startDay = (item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
          const endDay = (item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt)?.slice(0, 10)
          if (!startDay || !endDay) return null

          const metadata = item.metadata as Record<string, unknown> | undefined
          const lane = String((metadata?.lane as string | undefined) ?? item.displayKind).replace(/^\w/, (value) => value.toUpperCase())
          const dueOnly = !item.time.startsAt || !item.time.endsAt || item.displayKind === 'reminder' || item.displayKind === 'task'

          return {
            id: item.id,
            title: item.title,
            startsOn: startDay,
            endsOn: endDay,
            lane,
            isTask: dueOnly || startDay === endDay,
            source: 'coordination',
            scheduleMode: dueOnly ? 'due' : 'range',
          } satisfies GanttItem
        })
        .filter(Boolean)
        .sort((left, right) => left!.lane.localeCompare(right!.lane) || left!.id.localeCompare(right!.id)) as GanttItem[]
    }

    const milestones = (detailQuery.data?.milestones ?? []).map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      startsOn: milestone.startsOn,
      endsOn: milestone.endsOn,
      lane: milestone.lane,
      isTask: false,
      source: 'milestone' as const,
      scheduleMode: 'range' as const,
    }))

    const tasks = (detailQuery.data?.tasks ?? [])
      .filter((task: { due_on: string | null }) => task.due_on)
      .map((task: { id: string; title: string; due_on: string; status: string }) => ({
        id: task.id,
        title: task.title,
        startsOn: task.due_on,
        endsOn: task.due_on,
        lane: `Task · ${task.status}`,
        isTask: true,
        source: 'task' as const,
        scheduleMode: 'due' as const,
      }))

    return [...milestones, ...tasks].sort(
      (left, right) => left.lane.localeCompare(right.lane) || left.id.localeCompare(right.id),
    )
  }, [coordinationQuery.data, detailQuery.data, timelineMode])

  // Clear optimistic overrides once items update from the server
  const prevItemsRef = useRef(items)
  useEffect(() => {
    if (items !== prevItemsRef.current) {
      prevItemsRef.current = items
      setLocalOverrides({})
    }
  }, [items])

  const timeline = useMemo(() => buildTimeline(items, zoom), [items, zoom])

  useEffect(() => {
    if (timeline.todayLeft === null || !scrollRef.current) return
    centerToday(scrollRef.current, timeline.todayLeft)
  }, [selectedProjectId, timeline.todayLeft, timelineMode])

  const invalidateTimeline = () => {
    void queryClient.invalidateQueries({ queryKey: ['project-detail', selectedProjectId] })
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
    void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
  }

  const shiftMutation = useMutation({
    mutationFn: ({ milestoneId, days }: { milestoneId: string; days: number }) => shiftMilestone(milestoneId, days),
    onSuccess: invalidateTimeline,
  })

  const resizeMutation = useMutation({
    mutationFn: ({
      milestoneId,
      boundary,
      days,
    }: {
      milestoneId: string
      boundary: 'start' | 'end'
      days: number
    }) => resizeMilestoneBoundary(milestoneId, boundary, days),
    onSuccess: invalidateTimeline,
  })

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, days }: { taskId: string; days: number }) => moveTaskDueDate(taskId, days),
    onSuccess: invalidateTimeline,
  })

  const moveCoordinationMutation = useMutation({
    mutationFn: ({
      item,
      mode,
      days,
    }: {
      item: GanttItem
      mode: 'move' | 'start' | 'end'
      days: number
    }) => {
      if (item.scheduleMode === 'due') {
        const dueOn = shiftIsoDay(item.startsOn, days)
        return updateCoordinationObjectSchedule({
          id: item.id,
          startsAt: `${dueOn}T00:00:00.000Z`,
          endsAt: `${dueOn}T23:59:59.000Z`,
          dueAt: `${dueOn}T17:00:00.000Z`,
        })
      }

      const startsOn = shiftIsoDay(item.startsOn, mode === 'move' || mode === 'start' ? days : 0)
      const endsOn = shiftIsoDay(item.endsOn, mode === 'move' || mode === 'end' ? days : 0)

      return updateCoordinationObjectSchedule({
        id: item.id,
        startsAt: `${startsOn}T00:00:00.000Z`,
        endsAt: `${endsOn}T23:59:59.000Z`,
      })
    },
    onSuccess: invalidateTimeline,
  })

  const createMilestoneMutation = useMutation({
    mutationFn: () =>
      createMilestone({
        projectId: selectedProjectId,
        title: milestoneTitle.trim(),
        startsOn: milestoneStart,
        endsOn: milestoneEnd,
        lane: milestoneLane.trim() || 'Planning',
      }),
    onSuccess: () => {
      setMilestoneTitle('')
      setMilestoneLane('Planning')
      setMilestoneStart(defaultTimelineDay())
      setMilestoneEnd(defaultTimelineDay(1))
      setAddModal(null)
      invalidateTimeline()
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createTask({
        projectId: selectedProjectId,
        title: taskTitle.trim(),
        dueOn: taskDueOn,
      }),
    onSuccess: () => {
      setTaskTitle('')
      setTaskDueOn(defaultTimelineDay())
      setAddModal(null)
      invalidateTimeline()
    },
  })

  // Keep a ref to items so the pointerup closure always sees the current list
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Attach window listeners synchronously inside pointerdown — no useEffect gap
  function startDrag(event: React.PointerEvent<HTMLButtonElement>, item: GanttItem, mode: DragMode) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const cellWidth = zoomConfig[zoom].cellWidth
    let liveDays = 0

    setDragState({ itemId: item.id, mode })
    setDragDays(0)

    function onMove(e: PointerEvent) {
      e.preventDefault()
      liveDays = Math.round((e.clientX - startX) / cellWidth)
      setDragDays(liveDays)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      setDragState(null)
      setDragDays(0)

      if (liveDays !== 0) {
        const target = itemsRef.current.find((i) => i.id === item.id)
        if (target) {
          setLocalOverrides((prev) => ({
            ...prev,
            [item.id]: {
              startsOn: shiftIsoDay(target.startsOn, mode === 'end' ? 0 : liveDays),
              endsOn: shiftIsoDay(target.endsOn, mode === 'start' ? 0 : liveDays),
            },
          }))
          if (target.source === 'coordination') {
            moveCoordinationMutation.mutate({ item: target, mode, days: liveDays })
          } else if (target.source === 'task') {
            moveTaskMutation.mutate({ taskId: item.id, days: liveDays })
          } else if (mode === 'move') {
            shiftMutation.mutate({ milestoneId: item.id, days: liveDays })
          } else {
            resizeMutation.mutate({ milestoneId: item.id, boundary: mode, days: liveDays })
          }
        }
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const totalTrackWidth = timeline.days.length * timeline.cellWidth

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading
          eyebrow="Planning view"
          title="Interactive Gantt"
          action={
            <div className="flex flex-wrap gap-2">
              <AppButton variant="ghost" onClick={() => jogTimeline(scrollRef.current, -1)}>
                Back
              </AppButton>
              <AppButton variant="ghost" onClick={() => centerToday(scrollRef.current, timeline.todayLeft)}>
                Today
              </AppButton>
              <AppButton variant="ghost" onClick={() => jogTimeline(scrollRef.current, 1)}>
                Forward
              </AppButton>
            </div>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!linkedProjectId ? (
            <div className="flex flex-wrap gap-2">
              <AppButton variant={timelineMode === 'coordination' ? 'primary' : 'ghost'} onClick={() => setTimelineMode('coordination')}>
                Coordination mode
              </AppButton>
              <AppButton variant={timelineMode === 'project' ? 'primary' : 'ghost'} onClick={() => setTimelineMode('project')}>
                Project mode
              </AppButton>
            </div>
          ) : <div />}
          <div className="flex flex-wrap gap-2 justify-end">
            {timelineMode === 'project' && Boolean(selectedProjectId) ? (
              <>
                <AppButton variant="secondary" onClick={() => setAddModal('milestone')}>
                  Add block
                </AppButton>
                <AppButton variant="ghost" onClick={() => setAddModal('task')}>
                  Add task
                </AppButton>
              </>
            ) : null}
            {timelineMode === 'project' && projectsQuery.data?.length && !linkedProjectId ? (
              <AppSelect value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="min-w-[220px]">
                {projectsQuery.data.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </AppSelect>
            ) : null}
            {(Object.keys(zoomConfig) as ZoomLevel[]).map((level) => (
              <AppButton key={level} variant={zoom === level ? 'primary' : 'ghost'} onClick={() => setZoom(level)}>
                {zoomConfig[level].label}
              </AppButton>
            ))}
          </div>
        </div>

        {timelineMode === 'coordination' ? (
          <AppPanel tone="teal" className="rounded-control px-4 py-3 text-sm font-bold text-ink">
            Coordination mode treats life and work as clips on the same timeline: reminders, asks, appointments, bookings, and reusable flow blocks.
          </AppPanel>
        ) : null}

        {items.length ? (
          /* Single unified scroll container — labels are sticky left so no two-panel sync needed */
          <div
            ref={scrollRef}
            className="overflow-x-auto rounded-lg border border-ink/8"
            style={{ cursor: dragState ? 'grabbing' : undefined, touchAction: dragState ? 'none' : undefined }}
          >
            <div style={{ minWidth: `${LABEL_WIDTH + totalTrackWidth}px` }}>

              {/* Header row */}
              <div className="flex" style={{ height: HEADER_HEIGHT, borderBottom: '2px solid #e5e7eb' }}>
                {/* Sticky label column header */}
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-end bg-white pb-2 pl-4 pr-3"
                  style={{ width: LABEL_WIDTH, borderRight: '1px solid #e5e7eb' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
                    {timelineMode === 'coordination' ? 'Clips' : 'Tasks'}
                  </span>
                </div>

                {/* Timeline header — month + day rows */}
                <div className="relative flex-1 overflow-hidden">
                  {/* Month labels */}
                  <div
                    className="relative"
                    style={{
                      height: 28,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${timeline.days.length}, ${timeline.cellWidth}px)`,
                    }}
                  >
                    {timeline.months.map((month) => (
                      <div
                        key={`${month.label}-${month.startIndex}`}
                        className="ui-timeline-month"
                        style={{ gridColumn: `${month.startIndex + 1} / span ${month.span}` }}
                      >
                        {month.label}
                      </div>
                    ))}
                  </div>

                  {/* Day labels + today marker */}
                  <div className="relative" style={{ height: 44 }}>
                    {timeline.todayLeft !== null ? (
                      <div
                        className="pointer-events-none absolute z-10"
                        style={{ top: 0, bottom: 0, left: timeline.todayLeft + timeline.cellWidth / 2, width: 2, backgroundColor: 'rgba(196,90,59,0.8)' }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#C45A3B] px-2 py-0.5 text-[9px] font-black text-white">
                          Today
                        </div>
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${timeline.days.length}, ${timeline.cellWidth}px)`,
                        height: '100%',
                      }}
                    >
                      {timeline.days.map((day, index) => (
                        <div
                          key={day.iso}
                          className={`ui-timeline-day ${day.isToday ? 'ui-timeline-day--today' : 'ui-timeline-day--default'}`}
                        >
                          {shouldShowMinorLabel(index, timeline.labelEvery, day) ? (
                            <>
                              <div className="text-[11px] font-bold">{day.dayNumber}</div>
                              <div className="text-[10px] font-semibold">{day.weekday}</div>
                            </>
                          ) : (
                            <div className="text-[10px] font-semibold opacity-45">·</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data rows */}
              {items.map((item, index) => {
                const override = localOverrides[item.id]
                const effectiveItem = override ? { ...item, ...override } : item
                const geometry = getItemGeometry(effectiveItem, timeline, dragState?.itemId === item.id ? dragDays : 0, dragState?.mode)
                const color = TRACK_COLORS[index % TRACK_COLORS.length]
                const isDragging = dragState?.itemId === item.id

                return (
                  <div
                    key={item.id}
                    className="flex"
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: index % 2 === 1 ? '#fafafa' : '#fff',
                    }}
                  >
                    {/* Sticky label */}
                    <div
                      className="sticky left-0 z-10 flex shrink-0 flex-col justify-center pl-4 pr-3"
                      style={{
                        width: LABEL_WIDTH,
                        borderRight: '1px solid #e5e7eb',
                        backgroundColor: index % 2 === 1 ? '#fafafa' : '#fff',
                      }}
                    >
                      <p className="truncate text-sm font-extrabold text-ink">{item.title}</p>
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">{item.lane}</p>
                    </div>

                    {/* Track area */}
                    <div className="relative flex-1" style={{ width: totalTrackWidth }}>
                      {/* Today vertical line */}
                      {timeline.todayLeft !== null ? (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-10"
                          style={{ left: timeline.todayLeft + timeline.cellWidth / 2, width: 1, backgroundColor: 'rgba(196,90,59,0.15)' }}
                        />
                      ) : null}

                      {/* Clip / bar */}
                      {geometry.visible ? (
                        <div
                          className="absolute flex items-stretch overflow-hidden"
                          style={{
                            top: 6,
                            bottom: 6,
                            left: `${geometry.left}px`,
                            width: `${geometry.width}px`,
                            backgroundColor: color,
                            borderRadius: 3,
                            outline: isDragging ? '2px solid rgba(0,0,0,0.35)' : undefined,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          }}
                        >
                          {!item.isTask ? (
                            <Handle
                              side="start"
                              label={`Resize start for ${item.title}`}
                              onPointerDown={(event) => startDrag(event, item, 'start')}
                            />
                          ) : null}

                          <button
                            type="button"
                            className="flex min-w-0 flex-1 cursor-grab items-center px-2 active:cursor-grabbing"
                            onPointerDown={(event) => startDrag(event, item, 'move')}
                            aria-label={`Move ${item.title}`}
                          >
                            <span className="truncate text-[11px] font-bold text-white">{item.title}</span>
                          </button>

                          {!item.isTask ? (
                            <Handle
                              side="end"
                              label={`Resize end for ${item.title}`}
                              onPointerDown={(event) => startDrag(event, item, 'end')}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <AppPanel className="text-sm text-ink/60">
            {timelineMode === 'coordination'
              ? 'Create a coordination object or apply a reusable flow template first and the timeline clips will appear here.'
              : 'Create or import a project first and the planning timeline will appear here.'}
          </AppPanel>
        )}
      </AppCard>

      {addModal ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-md space-y-4">
            <SectionHeading
              eyebrow="Add inside project"
              title={addModal === 'milestone' ? 'New timeline block' : 'New dated task'}
              action={
                <button type="button" className="ui-soft-icon-button" onClick={() => setAddModal(null)}>
                  <X className="h-4 w-4" />
                </button>
              }
            />
            {addModal === 'milestone' ? (
              <div className="grid gap-3">
                <AppInput value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="Packing sprint, venue hold..." />
                <div className="grid gap-2 sm:grid-cols-2">
                  <AppInput type="date" value={milestoneStart} onChange={(event) => setMilestoneStart(event.target.value)} />
                  <AppInput type="date" value={milestoneEnd} onChange={(event) => setMilestoneEnd(event.target.value)} />
                </div>
                <AppInput value={milestoneLane} onChange={(event) => setMilestoneLane(event.target.value)} placeholder="Lane" />
                <div className="flex justify-end gap-2">
                  <AppButton variant="ghost" onClick={() => setAddModal(null)}>
                    Cancel
                  </AppButton>
                  <AppButton
                    disabled={
                      !selectedProjectId ||
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
                <AppInput value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Send invites, confirm transport..." />
                <AppInput type="date" value={taskDueOn} onChange={(event) => setTaskDueOn(event.target.value)} />
                <div className="flex justify-end gap-2">
                  <AppButton variant="ghost" onClick={() => setAddModal(null)}>
                    Cancel
                  </AppButton>
                  <AppButton disabled={!selectedProjectId || !taskTitle.trim() || !taskDueOn || createTaskMutation.isPending} onClick={() => createTaskMutation.mutate()}>
                    {createTaskMutation.isPending ? 'Adding...' : 'Add task'}
                  </AppButton>
                </div>
              </div>
            )}
          </AppCard>
        </div>
      ) : null}
    </div>
  )
}

function Handle({
  side,
  label,
  onPointerDown,
}: {
  side: 'start' | 'end'
  label: string
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className={`h-full w-2.5 shrink-0 cursor-ew-resize bg-white/20 hover:bg-white/35 ${side === 'start' ? 'rounded-l-[3px]' : 'rounded-r-[3px]'}`}
      onPointerDown={onPointerDown}
      aria-label={label}
    />
  )
}

function buildTimeline(items: GanttItem[], zoom: ZoomLevel) {
  const config = zoomConfig[zoom]
  const today = startOfDay(new Date())
  const earliest = items.length
    ? startOfDay(new Date(Math.min(...items.map((item) => new Date(item.startsOn).getTime()))))
    : today
  const latest = items.length
    ? startOfDay(new Date(Math.max(...items.map((item) => new Date(item.endsOn).getTime()))))
    : today

  const timelineStart = addDays(earliest, -2)
  const timelineEnd = addDays(latest, 4)
  const totalDays = Math.max(1, differenceInDays(timelineEnd, timelineStart) + 1)

  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(timelineStart, index)
    const iso = toIsoDate(date)
    return {
      iso,
      dayNumber: String(date.getDate()),
      weekday: date.toLocaleDateString('en-AU', { weekday: 'short' }),
      isToday: iso === toIsoDate(today),
      dayOfMonth: date.getDate(),
      monthKey: date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
    }
  })

  const months = days.reduce<Array<{ label: string; startIndex: number; span: number }>>((accumulator, day, index) => {
    const current = accumulator[accumulator.length - 1]
    if (current && current.label === day.monthKey) {
      current.span += 1
      return accumulator
    }
    accumulator.push({ label: day.monthKey, startIndex: index, span: 1 })
    return accumulator
  }, [])

  const todayIndex = days.findIndex((day) => day.isToday)

  return {
    days,
    months,
    cellWidth: config.cellWidth,
    labelEvery: config.labelEvery,
    timelineStart,
    todayLeft: todayIndex >= 0 ? todayIndex * config.cellWidth : null,
  }
}

function getItemGeometry(
  item: GanttItem,
  timeline: ReturnType<typeof buildTimeline>,
  dragDays: number,
  dragMode?: 'move' | 'start' | 'end',
) {
  let start = differenceInDays(new Date(item.startsOn), timeline.timelineStart)
  let end = differenceInDays(new Date(item.endsOn), timeline.timelineStart)

  if (dragMode === 'move') {
    start += dragDays
    end += dragDays
  } else if (dragMode === 'start') {
    start += dragDays
  } else if (dragMode === 'end') {
    end += dragDays
  }

  if (end < 0 || start > timeline.days.length - 1) {
    return { visible: false, left: 0, width: 0 }
  }

  const clippedStart = Math.max(0, start)
  const clippedEnd = Math.min(timeline.days.length - 1, Math.max(start, end))
  const width = Math.max((clippedEnd - clippedStart + 1) * timeline.cellWidth - 8, item.isTask ? 20 : 28)

  return {
    visible: true,
    left: clippedStart * timeline.cellWidth,
    width,
  }
}

function shouldShowMinorLabel(index: number, every: number, day: { isToday: boolean; dayOfMonth: number }) {
  return day.isToday || day.dayOfMonth === 1 || index % every === 0
}

function jogTimeline(element: HTMLDivElement | null, direction: -1 | 1) {
  if (!element) return
  element.scrollBy({ left: direction * Math.max(240, Math.round(element.clientWidth * 0.55)), behavior: 'smooth' })
}

function centerToday(element: HTMLDivElement | null, todayLeft: number | null) {
  if (!element || todayLeft === null) return
  // Account for the sticky label column so "today" centres in the visible track area
  const trackVisibleWidth = element.clientWidth - LABEL_WIDTH
  element.scrollTo({
    left: Math.max(0, todayLeft - trackVisibleWidth / 2),
    behavior: 'smooth',
  })
}

function startOfDay(input: Date) {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(input: Date, days: number) {
  const date = new Date(input)
  date.setDate(date.getDate() + days)
  return date
}

function differenceInDays(left: Date, right: Date) {
  return Math.round((startOfDay(left).getTime() - startOfDay(right).getTime()) / 86400000)
}

function toIsoDate(input: Date) {
  return startOfDay(input).toISOString().slice(0, 10)
}

function shiftIsoDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function defaultTimelineDay(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const ganttRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'gantt',
  component: GanttPage,
})
