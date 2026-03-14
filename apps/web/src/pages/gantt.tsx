import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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

type DragState = {
  itemId: string
  mode: 'move' | 'start' | 'end'
  startX: number
}

const zoomConfig: Record<ZoomLevel, { label: string; cellWidth: number; labelEvery: number }> = {
  detail: { label: 'Detail', cellWidth: 54, labelEvery: 1 },
  comfortable: { label: 'Comfortable', cellWidth: 34, labelEvery: 2 },
  overview: { label: 'Overview', cellWidth: 22, labelEvery: 5 },
  strategic: { label: 'Strategic', cellWidth: 14, labelEvery: 10 },
}

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
        .sort((left, right) => new Date(left!.startsOn).getTime() - new Date(right!.startsOn).getTime()) as GanttItem[]
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
      (left, right) => new Date(left.startsOn).getTime() - new Date(right.startsOn).getTime(),
    )
  }, [coordinationQuery.data, detailQuery.data, timelineMode])

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

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState
    const dayWidth = zoomConfig[zoom].cellWidth

    function handlePointerMove(event: PointerEvent) {
      setDragDays(Math.round((event.clientX - activeDrag.startX) / dayWidth))
    }

    function handlePointerUp() {
      if (dragDays !== 0) {
        const target = items.find((item) => item.id === activeDrag.itemId)
        if (target?.source === 'coordination') {
          moveCoordinationMutation.mutate({ item: target, mode: activeDrag.mode, days: dragDays })
        } else if (target?.source === 'task') {
          moveTaskMutation.mutate({ taskId: activeDrag.itemId, days: dragDays })
        } else if (activeDrag.mode === 'move') {
          shiftMutation.mutate({ milestoneId: activeDrag.itemId, days: dragDays })
        } else {
          resizeMutation.mutate({
            milestoneId: activeDrag.itemId,
            boundary: activeDrag.mode,
            days: dragDays,
          })
        }
      }
      setDragState(null)
      setDragDays(0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragDays, dragState, items, moveCoordinationMutation, moveTaskMutation, resizeMutation, shiftMutation, zoom])

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
        <p className="text-sm text-ink/65">
          Zoom changes the timeline horizontally only. The full plan stays in view, and the left-side titles stay anchored while you scroll.
        </p>

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
          <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="ui-timeline-shell">
              <div className="ui-timeline-label-header">
                {timelineMode === 'coordination' ? 'Clips' : 'Tasks'}
              </div>
              <div className="mt-3 space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="ui-timeline-label-row">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink">{item.title}</p>
                      <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-ink/45">{item.lane}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ui-timeline-shell">
              <div ref={scrollRef} className="overflow-x-auto">
                <div style={{ minWidth: `${timeline.days.length * timeline.cellWidth}px` }}>
                  <div className="space-y-1 border-b border-white/80 pb-3">
                    <div
                      className="relative grid gap-1"
                      style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${timeline.cellWidth}px)` }}
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

                    <div className="relative">
                      <TodayMarker offsetLeft={timeline.todayLeft} />
                      <div
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${timeline.cellWidth}px)` }}
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

                  <div className="mt-2 space-y-1.5">
                    {items.map((item) => {
                      const geometry = getItemGeometry(item, timeline, dragState?.itemId === item.id ? dragDays : 0, dragState?.mode)
                      if (!geometry.visible) return null

                      return (
                        <div key={item.id} className="ui-timeline-row">
                          <TodayMarker offsetLeft={timeline.todayLeft} compact />
                          <div
                            className="relative grid h-full items-center gap-1"
                            style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${timeline.cellWidth}px)` }}
                          >
                            {timeline.days.map((day) => (
                              <div
                                key={`${item.id}-${day.iso}`}
                                className={`h-8 rounded-md ${day.isToday ? 'bg-berry/10' : 'bg-ink/[0.04]'}`}
                              />
                            ))}

                            <div
                              className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center rounded-full shadow-floaty ${
                                item.isTask ? 'bg-gradient-to-r from-teal to-butter text-ink' : 'bg-gradient-to-r from-peach to-berry text-white'
                              } ${dragState?.itemId === item.id ? 'ring-2 ring-ink/20' : ''}`}
                              style={{
                                left: `${geometry.left + 4}px`,
                                width: `${geometry.width}px`,
                                minWidth: `${item.isTask ? 20 : 28}px`,
                              }}
                            >
                              {!item.isTask ? (
                                <Handle
                                  side="start"
                                  label={`Resize start for ${item.title}`}
                                  onPointerDown={(event) => beginDrag(event, item.id, 'start', setDragState, setDragDays)}
                                />
                              ) : null}

                              <button
                                type="button"
                                className="flex min-w-0 flex-1 cursor-grab items-center justify-center px-2 text-xs font-black active:cursor-grabbing"
                                onPointerDown={(event) => beginDrag(event, item.id, 'move', setDragState, setDragDays)}
                                aria-label={`Move ${item.title}`}
                              >
                                <span className="truncate">{item.title}</span>
                              </button>

                              {!item.isTask ? (
                                <Handle
                                  side="end"
                                  label={`Resize end for ${item.title}`}
                                  onPointerDown={(event) => beginDrag(event, item.id, 'end', setDragState, setDragDays)}
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
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
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className={`h-6 w-3 shrink-0 cursor-ew-resize bg-white/85 shadow ${side === 'start' ? 'rounded-l-full rounded-r-md' : 'rounded-r-full rounded-l-md'}`}
      onPointerDown={onPointerDown}
      aria-label={label}
    />
  )
}

function beginDrag(
  event: ReactPointerEvent<HTMLButtonElement>,
  itemId: string,
  mode: 'move' | 'start' | 'end',
  setDragState: (state: DragState | null) => void,
  setDragDays: (days: number) => void,
) {
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  setDragState({ itemId, mode, startX: event.clientX })
  setDragDays(0)
}

function TodayMarker({ offsetLeft, compact = false }: { offsetLeft: number | null; compact?: boolean }) {
  if (offsetLeft === null) return null
  return (
    <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${offsetLeft}px` }}>
      {!compact ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-berry px-2 py-1 text-[10px] font-black text-white">
          Today
        </div>
      ) : null}
      <div className="h-full w-[2px] rounded-full bg-berry/80" />
    </div>
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
  element.scrollTo({
    left: Math.max(0, todayLeft - element.clientWidth / 2),
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
