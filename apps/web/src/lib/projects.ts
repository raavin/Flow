import type { CalendarEvent, Milestone, Project } from '@superapp/types'
import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'
import {
  archiveCoordinationObjectBySource,
  syncCalendarCoordinationObject,
  syncProjectCoordinationObject,
  syncTaskCoordinationObject,
} from './coordination-objects'

type ProjectRow = {
  id: string
  title: string
  category: string
  status: Project['status']
  project_kind: NonNullable<Project['projectKind']>
  target_date: string | null
  budget_cents: number | null
}

type MilestoneRow = {
  id: string
  project_id: string
  title: string
  starts_on: string
  ends_on: string
  lane: string
  progress: number
}

type EventRow = {
  id: string
  project_id: string | null
  title: string
  starts_at: string
  ends_at: string
  notes: string | null
}

type ProjectNoteRow = {
  id: string
  project_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export async function fetchProjects() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, category, status, project_kind, target_date, budget_cents')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as ProjectRow[]).map((project) => ({
    id: project.id,
    title: project.title,
    category: project.category,
    status: project.status,
    projectKind: project.project_kind,
    targetDate: project.target_date,
    budgetCents: project.budget_cents,
  }))
}

export async function createProject(input: {
  ownerId: string
  title: string
  category: string
  targetDate: string
  budgetCents?: number | null
  projectKind?: NonNullable<Project['projectKind']>
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const normalizedCategory = input.category.trim() || 'General'
  const normalizedTargetDate = input.targetDate || todayDate()

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      category: normalizedCategory,
      project_kind: input.projectKind ?? 'general',
      target_date: normalizedTargetDate,
      budget_cents: input.budgetCents ?? null,
    })
    .select('id, title, category, status, project_kind, target_date, budget_cents')
    .single<ProjectRow>()

  if (error) throw error

  const seedMilestones = [
    {
      project_id: project.id,
      title: 'Kickoff',
      starts_on: normalizedTargetDate,
      ends_on: normalizedTargetDate,
      lane: 'Planning',
      progress: 0,
    },
    {
      project_id: project.id,
      title: 'Mid-point review',
      starts_on: shiftDate(normalizedTargetDate, 30),
      ends_on: shiftDate(normalizedTargetDate, 30),
      lane: 'Planning',
      progress: 0,
    },
    {
      project_id: project.id,
      title: 'Delivery',
      starts_on: shiftDate(normalizedTargetDate, 60),
      ends_on: shiftDate(normalizedTargetDate, 60),
      lane: 'Planning',
      progress: 0,
    },
  ]

  const { error: milestoneError } = await supabase.from('milestones').insert(seedMilestones)
  if (milestoneError) throw milestoneError

  await createNotification({
    profileId: input.ownerId,
    title: 'Project created',
    body: `${project.title} is ready for planning.`,
    kind: 'projects',
    linkUrl: `/app/projects/${project.id}`,
  })

  await syncProjectCoordinationObject({
    ownerId: input.ownerId,
    projectId: project.id,
    title: project.title,
    category: project.category,
    targetDate: project.target_date,
    status: project.status,
  })

  return {
    id: project.id,
    title: project.title,
    category: project.category,
    status: project.status,
    projectKind: project.project_kind,
    targetDate: project.target_date,
    budgetCents: project.budget_cents,
  } satisfies Project
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function createProjectFromTemplate(input: {
  ownerId: string
  title: string
  category: string
  startDate: string
  templatePayload: {
    milestones?: Array<{ title: string; offsetDays: number; durationDays: number; lane: string }>
    tasks?: Array<{ title: string; offsetDays: number }>
  }
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const milestoneRows = (input.templatePayload.milestones ?? []).map((milestone) => ({
    title: milestone.title,
    starts_on: shiftDate(input.startDate, milestone.offsetDays),
    ends_on: shiftDate(input.startDate, milestone.offsetDays + Math.max(0, milestone.durationDays - 1)),
    lane: milestone.lane,
    progress: 0,
  }))

  const targetDate =
    milestoneRows.length > 0 ? milestoneRows[milestoneRows.length - 1].ends_on : input.startDate

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      category: input.category,
      project_kind: 'general',
      target_date: targetDate,
    })
    .select('id, title, category, status, project_kind, target_date, budget_cents')
    .single<ProjectRow>()

  if (error) throw error

  if (milestoneRows.length) {
    const { error: milestonesError } = await supabase.from('milestones').insert(
      milestoneRows.map((milestone) => ({
        ...milestone,
        project_id: project.id,
      })),
    )
    if (milestonesError) throw milestonesError
  }

  const taskRows = (input.templatePayload.tasks ?? []).map((task) => ({
    project_id: project.id,
    title: task.title,
    due_on: shiftDate(input.startDate, task.offsetDays),
  }))

  if (taskRows.length) {
    const { error: tasksError } = await supabase.from('tasks').insert(taskRows)
    if (tasksError) throw tasksError
  }

  await createNotification({
    profileId: input.ownerId,
    title: 'Template imported',
    body: `${input.title} is ready in your project board.`,
    kind: 'projects',
    linkUrl: `/app/projects/${project.id}`,
  })

  await syncProjectCoordinationObject({
    ownerId: input.ownerId,
    projectId: project.id,
    title: project.title,
    category: project.category,
    targetDate: project.target_date,
    status: project.status,
  })

  return {
    id: project.id,
    title: project.title,
    category: project.category,
    status: project.status,
    projectKind: project.project_kind,
    targetDate: project.target_date,
    budgetCents: project.budget_cents,
  } satisfies Project
}

export async function fetchProjectDetail(projectId: string) {
  if (!supabase) return null

  const [
    { data: project, error: projectError },
    { data: milestones, error: milestonesError },
    { data: events, error: eventsError },
    { data: links, error: linksError },
    { data: tasks, error: tasksError },
  ] =
    await Promise.all([
      supabase.from('projects').select('id, title, category, status, project_kind, target_date, budget_cents').eq('id', projectId).single<ProjectRow>(),
      supabase.from('milestones').select('id, project_id, title, starts_on, ends_on, lane, progress').eq('project_id', projectId).order('starts_on', { ascending: true }),
      supabase.from('calendar_events').select('id, project_id, title, starts_at, ends_at, notes').eq('project_id', projectId).order('starts_at', { ascending: true }),
      supabase.from('project_listing_links').select('id, listing_id, marketplace_listings(title, kind, price_label)').eq('project_id', projectId),
      supabase.from('tasks').select('id, title, status, due_on, assignee_name').eq('project_id', projectId).order('created_at', { ascending: true }),
    ])

  if (projectError) throw projectError
  if (milestonesError) throw milestonesError
  if (eventsError) throw eventsError
  if (linksError) throw linksError
  if (tasksError) throw tasksError

  return {
    project: {
      id: project.id,
      title: project.title,
      category: project.category,
      status: project.status,
      projectKind: project.project_kind,
      targetDate: project.target_date,
      budgetCents: project.budget_cents,
    } satisfies Project,
    milestones: (milestones as MilestoneRow[]).map(mapMilestone),
    events: (events as EventRow[]).map(mapEvent),
    attachments: links ?? [],
    tasks: tasks ?? [],
  }
}

export async function updateProject(
  projectId: string,
  input: {
    title?: string
    category?: string
    targetDate?: string | null
    status?: Project['status']
  },
) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) updates.title = input.title.trim() || 'Untitled'
  if (input.category !== undefined) updates.category = input.category.trim() || 'General'
  if ('targetDate' in input) updates.target_date = input.targetDate || null
  if (input.status !== undefined) updates.status = input.status
  const { error } = await supabase.from('projects').update(updates).eq('id', projectId)
  if (error) throw error
}

export async function deleteProject(projectId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

export async function setProjectKind(projectId: string, projectKind: NonNullable<Project['projectKind']>) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('projects').update({ project_kind: projectKind }).eq('id', projectId)
  if (error) throw error
}

export async function shiftMilestone(milestoneId: string, days: number) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('milestones')
    .select('id, project_id, title, starts_on, ends_on, lane, progress')
    .eq('id', milestoneId)
    .single<MilestoneRow>()

  if (error) throw error

  const startsOn = shiftDate(data.starts_on, days)
  const endsOn = shiftDate(data.ends_on, days)

  const { error: updateError } = await supabase
    .from('milestones')
    .update({ starts_on: startsOn, ends_on: endsOn })
    .eq('id', milestoneId)

  if (updateError) throw updateError

  const shiftOwnerId = await currentUserId()
  if (shiftOwnerId) {
    await createActivity({
      ownerId: shiftOwnerId,
      projectId: data.project_id,
      activityType: 'milestone_shifted',
      title: 'Milestone moved',
      detail: `${data.title} shifted by ${days} day${Math.abs(days) === 1 ? '' : 's'}.`,
    })
  }
}

export async function resizeMilestoneBoundary(
  milestoneId: string,
  boundary: 'start' | 'end',
  days: number,
) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('milestones')
    .select('id, project_id, title, starts_on, ends_on')
    .eq('id', milestoneId)
    .single<Pick<MilestoneRow, 'id' | 'project_id' | 'title' | 'starts_on' | 'ends_on'>>()

  if (error) throw error

  const nextStartsOn = boundary === 'start' ? shiftDate(data.starts_on, days) : data.starts_on
  const nextEndsOn = boundary === 'end' ? shiftDate(data.ends_on, days) : data.ends_on

  if (new Date(nextStartsOn).getTime() > new Date(nextEndsOn).getTime()) {
    throw new Error('A milestone needs at least one day in its range.')
  }

  const { error: updateError } = await supabase
    .from('milestones')
    .update({ starts_on: nextStartsOn, ends_on: nextEndsOn })
    .eq('id', milestoneId)

  if (updateError) throw updateError

  const resizeOwnerId = await currentUserId()
  if (resizeOwnerId) {
    await createActivity({
      ownerId: resizeOwnerId,
      projectId: data.project_id,
      activityType: 'milestone_resized',
      title: 'Milestone resized',
      detail:
        boundary === 'start'
          ? `${data.title} now starts on ${nextStartsOn}.`
          : `${data.title} now ends on ${nextEndsOn}.`,
    })
  }
}

export async function createCalendarEvent(input: {
  ownerId: string
  title: string
  startsAt: string
  endsAt: string
  projectId?: string | null
  notes?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      project_id: input.projectId ?? null,
      notes: input.notes ?? null,
    })
    .select('id, project_id, title, starts_at, ends_at, notes')
    .single<EventRow>()
  if (error) throw error
  await createNotification({
    profileId: input.ownerId,
    title: 'Event added',
    body: input.title,
    kind: 'projects',
    linkUrl: input.projectId ? `/app/projects/${input.projectId}/calendar` : '/app/calendar',
  })
  if (input.projectId) {
    await createActivity({
      ownerId: input.ownerId,
      projectId: input.projectId,
      activityType: 'event_created',
      title: 'Calendar event added',
      detail: input.title,
    })
  }

  await syncCalendarCoordinationObject({
    ownerId: input.ownerId,
    eventId: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    projectId: event.project_id,
    notes: event.notes,
  })
}

export async function fetchCalendarEvents() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, project_id, title, starts_at, ends_at, notes')
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data as EventRow[]).map(mapEvent)
}

export async function updateCalendarEvent(input: {
  eventId: string
  ownerId: string
  title: string
  startsAt: string
  endsAt: string
  projectId?: string | null
  notes?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: event, error } = await supabase
    .from('calendar_events')
    .update({
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      project_id: input.projectId ?? null,
      notes: input.notes ?? null,
    })
    .eq('id', input.eventId)
    .select('id, project_id, title, starts_at, ends_at, notes')
    .single<EventRow>()

  if (error) throw error

  await syncCalendarCoordinationObject({
    ownerId: input.ownerId,
    eventId: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    projectId: event.project_id,
    notes: event.notes,
  })
}

export async function deleteCalendarEvent(eventId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase.from('calendar_events').delete().eq('id', eventId)
  if (error) throw error

  await archiveCoordinationObjectBySource('calendar_events', eventId)
}

export async function attachListingToProject(projectId: string, listingId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('project_listing_links')
    .insert({ project_id: projectId, listing_id: listingId })
  if (error) throw error
  const userId = await currentUserId()
  if (userId) {
    await createActivity({
      ownerId: userId,
      projectId,
      activityType: 'listing_attached',
      title: 'Marketplace item attached',
      detail: `Listing ${listingId} is now linked to this project.`,
    })
  }
}

export async function createTask(input: {
  projectId: string
  title: string
  dueOn?: string | null
  assigneeName?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const dueOn = input.dueOn ?? (await suggestTaskDueDate(input.projectId))
  const userId = await currentUserId()
  if (!userId) throw new Error('You need to be signed in.')
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.projectId,
      title: input.title,
      due_on: dueOn,
      assignee_name: input.assigneeName ?? null,
    })
    .select('id, project_id, title, status, due_on, assignee_name')
    .single()
  if (error) throw error
  if (userId) {
    await createActivity({
      ownerId: userId,
      projectId: input.projectId,
      activityType: 'task_created',
      title: 'Task added',
      detail: input.title,
    })
  }

  await syncTaskCoordinationObject({
    ownerId: userId,
    taskId: task.id,
    projectId: task.project_id,
    title: task.title,
    dueOn: task.due_on,
    status: task.status,
    assigneeName: task.assignee_name,
  })
}

export async function createMilestone(input: {
  projectId: string
  title: string
  startsOn: string
  endsOn: string
  lane?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const userId = await currentUserId()
  if (!userId) throw new Error('You need to be signed in.')

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: input.projectId,
      title: input.title,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      lane: input.lane ?? 'Planning',
      progress: 0,
    })
    .select('id, project_id, title, starts_on, ends_on, lane, progress')
    .single<MilestoneRow>()
  if (error) throw error

  await createActivity({
    ownerId: userId,
    projectId: input.projectId,
    activityType: 'milestone_created',
    title: 'Milestone added',
    detail: input.title,
  })

  return mapMilestone(data)
}

export async function updateTaskStatus(taskId: string, status: 'todo' | 'doing' | 'done') {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('tasks').select('project_id, title').eq('id', taskId).single()
  if (error) throw error
  const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (updateError) throw updateError
  const userId = await currentUserId()
  if (userId) {
    await createActivity({
      ownerId: userId,
      projectId: data.project_id,
      activityType: 'task_status',
      title: 'Task updated',
      detail: `${data.title} moved to ${status}.`,
    })
  }
}

export async function fetchProjectNotes(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_notes')
    .select('id, project_id, title, body, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as ProjectNoteRow[]) ?? []
}

export async function createProjectNote(input: {
  ownerId: string
  projectId: string
  title: string
  body: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('project_notes')
    .insert({
      owner_id: input.ownerId,
      project_id: input.projectId,
      title: input.title.trim() || 'Note',
      body: input.body,
    })
    .select('id, project_id, title, body, created_at, updated_at')
    .single<ProjectNoteRow>()
  if (error) throw error
  await createActivity({
    ownerId: input.ownerId,
    projectId: input.projectId,
    activityType: 'note_created',
    title: 'Note added',
    detail: input.title.trim() || 'Note',
  })
  return data
}

export async function updateProjectNote(input: {
  noteId: string
  title: string
  body: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('project_notes')
    .update({
      title: input.title.trim() || 'Note',
      body: input.body,
    })
    .eq('id', input.noteId)
    .select('id, project_id, title, body, created_at, updated_at')
    .single<ProjectNoteRow>()
  if (error) throw error
  return data
}

export async function deleteProjectNote(noteId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('project_notes').delete().eq('id', noteId)
  if (error) throw error
}

export async function updateMilestone(milestoneId: string, input: { title?: string; lane?: string }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = input.title.trim() || 'Milestone'
  if (input.lane !== undefined) payload.lane = input.lane.trim() || 'Planning'
  const { error } = await supabase.from('milestones').update(payload).eq('id', milestoneId)
  if (error) throw error
}

export async function deleteMilestone(milestoneId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('milestones').delete().eq('id', milestoneId)
  if (error) throw error
}

export async function updateTask(taskId: string, input: { title?: string }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = input.title.trim() || 'Task'
  const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)
  if (error) throw error
}

export async function deleteTask(taskId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export async function moveTaskDueDate(taskId: string, days: number) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('tasks').select('project_id, title, due_on').eq('id', taskId).single()
  if (error) throw error
  if (!data.due_on) throw new Error('This task does not have a scheduled date yet.')

  const dueOn = shiftDate(data.due_on, days)
  const { error: updateError } = await supabase.from('tasks').update({ due_on: dueOn }).eq('id', taskId)
  if (updateError) throw updateError

  const userId = await currentUserId()
  if (userId) {
    await createActivity({
      ownerId: userId,
      projectId: data.project_id,
      activityType: 'task_rescheduled',
      title: 'Task rescheduled',
      detail: `${data.title} moved to ${dueOn}.`,
    })
  }
}

async function currentUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function suggestTaskDueDate(projectId: string) {
  if (!supabase) return null

  const [{ data: milestones, error: milestonesError }, { data: project, error: projectError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase.from('milestones').select('ends_on').eq('project_id', projectId).order('ends_on', { ascending: true }),
      supabase.from('projects').select('target_date').eq('id', projectId).maybeSingle(),
      supabase.from('tasks').select('due_on').eq('project_id', projectId).not('due_on', 'is', null).order('due_on', { ascending: false }).limit(1),
    ])

  if (milestonesError) throw milestonesError
  if (projectError) throw projectError
  if (tasksError) throw tasksError

  const lastTaskDueOn = tasks?.[0]?.due_on as string | undefined
  if (lastTaskDueOn) {
    return shiftDate(lastTaskDueOn, 1)
  }

  const lastMilestoneEnd = milestones?.at(-1)?.ends_on as string | undefined
  if (lastMilestoneEnd) {
    return lastMilestoneEnd
  }

  const targetDate = project?.target_date as string | null | undefined
  if (targetDate) {
    return targetDate
  }

  return new Date().toISOString().slice(0, 10)
}

function mapMilestone(item: MilestoneRow): Milestone {
  return {
    id: item.id,
    projectId: item.project_id,
    title: item.title,
    startsOn: item.starts_on,
    endsOn: item.ends_on,
    lane: item.lane,
    progress: item.progress,
  }
}

function mapEvent(item: EventRow): CalendarEvent {
  return {
    id: item.id,
    projectId: item.project_id,
    title: item.title,
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    notes: item.notes,
  }
}

function shiftDate(input: string, days: number) {
  // Use UTC throughout — local-time construction + toISOString() loses a day in UTC+ timezones
  const date = new Date(`${input}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
