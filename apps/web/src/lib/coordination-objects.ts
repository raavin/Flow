import type {
  CoordinationDependencyKind,
  CoordinationObject,
  CoordinationDisplayKind,
  CoordinationObjectIntent,
  CoordinationObjectKind,
  CoordinationParticipant,
  CoordinationObjectState,
  CoordinationTemplate,
  CoordinationTemplateBlock,
} from '@superapp/types'
import { supabase } from './supabase'

type UpsertCoordinationObjectInput = {
  ownerId: string
  sourceTable: string
  sourceId: string
  kind: CoordinationObjectKind
  displayKind: CoordinationDisplayKind
  title: string
  summary?: string | null
  intent: CoordinationObjectIntent
  state: CoordinationObjectState
  startsAt?: string | null
  endsAt?: string | null
  dueAt?: string | null
  isAllDay?: boolean
  flexibility?: 'fixed' | 'shiftable' | 'floating'
  parentId?: string | null
  linkedProjectId?: string | null
  linkedListingId?: string | null
  linkedJobId?: string | null
  metadata?: Record<string, unknown>
}

type CoordinationObjectRow = {
  id: string
  owner_id: string
  source_table: string | null
  source_id: string | null
  kind: CoordinationObjectKind
  display_kind: CoordinationDisplayKind
  title: string
  summary: string | null
  intent: CoordinationObjectIntent
  state: CoordinationObjectState
  starts_at: string | null
  ends_at: string | null
  due_at: string | null
  is_all_day: boolean
  flexibility: 'fixed' | 'shiftable' | 'floating'
  parent_id: string | null
  linked_project_id: string | null
  linked_listing_id: string | null
  linked_job_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  coordination_object_participants?: CoordinationParticipantRow[]
}

type CoordinationParticipantRow = {
  id: string
  coordination_object_id: string
  profile_id: string | null
  participant_name: string
  role: CoordinationParticipant['role']
  state: CoordinationParticipant['state']
}

type CoordinationTemplateRow = {
  id: string
  owner_id: string
  title: string
  summary: string | null
  display_kind: CoordinationDisplayKind
  payload: {
    blocks?: CoordinationTemplateBlock[]
  } | null
}

type ManualCoordinationInput = {
  ownerId: string
  title: string
  summary?: string | null
  kind: CoordinationObjectKind
  displayKind: CoordinationDisplayKind
  intent: CoordinationObjectIntent
  state?: CoordinationObjectState
  startsAt?: string | null
  endsAt?: string | null
  dueAt?: string | null
  isAllDay?: boolean
  flexibility?: 'fixed' | 'shiftable' | 'floating'
  linkedProjectId?: string | null
  participantNames?: string[]
  metadata?: Record<string, unknown>
}

type FetchCoordinationOptions = {
  states?: CoordinationObjectState[]
  includeArchived?: boolean
  onlyTimed?: boolean
  linkedProjectId?: string | null
}

export async function upsertCoordinationObject(input: UpsertCoordinationObjectInput) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const payload = {
    owner_id: input.ownerId,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    kind: input.kind,
    display_kind: input.displayKind,
    title: input.title,
    summary: input.summary ?? null,
    intent: input.intent,
    state: input.state,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    due_at: input.dueAt ?? null,
    is_all_day: input.isAllDay ?? false,
    flexibility: input.flexibility ?? 'fixed',
    parent_id: input.parentId ?? null,
    linked_project_id: input.linkedProjectId ?? null,
    linked_listing_id: input.linkedListingId ?? null,
    linked_job_id: input.linkedJobId ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await supabase
    .from('coordination_objects')
    .upsert(payload, { onConflict: 'source_table,source_id' })
    .select('id')
    .single()

  if (error) throw error

  const { error: participantError } = await supabase
    .from('coordination_object_participants')
    .upsert(
      {
        coordination_object_id: data.id,
        profile_id: input.ownerId,
        participant_name: 'Owner',
        role: 'owner',
        state: 'active',
      },
      { onConflict: 'coordination_object_id,profile_id' },
    )

  if (participantError && !participantError.message.includes('there is no unique')) {
    throw participantError
  }

  return data.id as string
}

export async function fetchCoordinationObjects(options: FetchCoordinationOptions = {}) {
  if (!supabase) return []

  let query = supabase
    .from('coordination_objects')
    .select(
      'id, owner_id, source_table, source_id, kind, display_kind, title, summary, intent, state, starts_at, ends_at, due_at, is_all_day, flexibility, parent_id, linked_project_id, linked_listing_id, linked_job_id, metadata, created_at, updated_at, coordination_object_participants(id, coordination_object_id, profile_id, participant_name, role, state)',
    )
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (options.states?.length) query = query.in('state', options.states)
  if (!options.includeArchived) query = query.neq('state', 'archived')
  if (options.onlyTimed) query = query.or('starts_at.not.is.null,due_at.not.is.null,ends_at.not.is.null')
  if (options.linkedProjectId) query = query.eq('linked_project_id', options.linkedProjectId)

  const { data, error } = await query

  if (error) throw error

  return (data as CoordinationObjectRow[]).map(mapCoordinationObject)
}

export async function createManualCoordinationObject(input: ManualCoordinationInput) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('coordination_objects')
    .insert({
      owner_id: input.ownerId,
      kind: input.kind,
      display_kind: input.displayKind,
      title: input.title,
      summary: input.summary ?? null,
      intent: input.intent,
      state: input.state ?? 'draft',
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      due_at: input.dueAt ?? null,
      is_all_day: input.isAllDay ?? false,
      flexibility: input.flexibility ?? 'shiftable',
      linked_project_id: input.linkedProjectId ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single()

  if (error) throw error

  const participantRows = [
    {
      coordination_object_id: data.id,
      profile_id: input.ownerId,
      participant_name: 'Owner',
      role: 'owner',
      state: 'active',
    },
    ...(input.participantNames ?? [])
      .map((participantName) => participantName.trim())
      .filter(Boolean)
      .map((participantName) => ({
        coordination_object_id: data.id,
        profile_id: null,
        participant_name: participantName,
        role: 'participant' as const,
        state: 'invited' as const,
      })),
  ]

  const { error: participantError } = await supabase.from('coordination_object_participants').insert(participantRows)
  if (participantError) throw participantError

  return data.id as string
}

export async function updateCoordinationObjectState(id: string, state: CoordinationObjectState) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase.from('coordination_objects').update({ state }).eq('id', id)
  if (error) throw error
}

export async function updateCoordinationObjectSchedule(input: {
  id: string
  startsAt?: string | null
  endsAt?: string | null
  dueAt?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('coordination_objects')
    .update({
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      due_at: input.dueAt ?? null,
    })
    .eq('id', input.id)

  if (error) throw error
}

export async function archiveCoordinationObjectBySource(sourceTable: string, sourceId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('coordination_objects')
    .update({ state: 'archived' })
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)

  if (error) throw error
}

export async function fetchCoordinationTemplates() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('coordination_templates')
    .select('id, owner_id, title, summary, display_kind, payload')
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data as CoordinationTemplateRow[]).map((template) => ({
    id: template.id,
    ownerId: template.owner_id,
    title: template.title,
    summary: template.summary,
    displayKind: template.display_kind,
    blocks: template.payload?.blocks ?? [],
  })) satisfies CoordinationTemplate[]
}

export async function createCoordinationTemplate(input: {
  ownerId: string
  title: string
  summary?: string | null
  displayKind: CoordinationDisplayKind
  blocks: CoordinationTemplateBlock[]
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase.from('coordination_templates').insert({
    owner_id: input.ownerId,
    title: input.title,
    summary: input.summary ?? null,
    display_kind: input.displayKind,
    payload: { blocks: input.blocks },
  })

  if (error) throw error
}

export async function seedStarterCoordinationTemplates(ownerId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const templates = starterTemplates.map((template) => ({
    owner_id: ownerId,
    title: template.title,
    summary: template.summary,
    display_kind: template.displayKind,
    payload: { blocks: template.blocks },
  }))

  const { error } = await supabase.from('coordination_templates').insert(templates)
  if (error) throw error
}

export async function instantiateCoordinationTemplate(input: {
  ownerId: string
  template: CoordinationTemplate
  anchorDate: string
  title?: string
  linkedProjectId?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const parentId = await createManualCoordinationObject({
    ownerId: input.ownerId,
    title: input.title || input.template.title,
    summary: input.template.summary,
    kind: input.template.displayKind === 'project' ? 'project' : 'workflow',
    displayKind: input.template.displayKind,
    intent: 'coordinate',
    state: 'active',
    startsAt: asStartOfDay(input.anchorDate),
    endsAt: asEndOfDay(lastTemplateDay(input.template.blocks, input.anchorDate)),
    isAllDay: true,
    flexibility: 'shiftable',
    linkedProjectId: input.linkedProjectId ?? null,
    metadata: { fromTemplateId: input.template.id },
  })

  const childRows = input.template.blocks.map((block) => {
    const startsOn = shiftDate(input.anchorDate, block.offsetDays ?? 0)
    const endsOn = shiftDate(startsOn, Math.max(0, (block.durationDays ?? 1) - 1))

    return {
      owner_id: input.ownerId,
      kind: block.kind,
      display_kind: block.displayKind,
      title: block.title,
      summary: block.metadata?.summary ? String(block.metadata.summary) : null,
      intent: block.intent,
      state: 'scheduled',
      starts_at: asStartOfDay(startsOn),
      ends_at: asEndOfDay(endsOn),
      due_at: block.durationDays && block.durationDays > 1 ? null : asDueTime(startsOn),
      is_all_day: true,
      flexibility: 'shiftable',
      parent_id: parentId,
      linked_project_id: input.linkedProjectId ?? null,
      metadata: {
        lane: block.lane ?? block.displayKind,
        templateTitle: input.template.title,
        ...(block.metadata ?? {}),
      },
    }
  })

  const { data, error } = await supabase.from('coordination_objects').insert(childRows).select('id')
  if (error) throw error

  const childObjects = data as Array<{ id: string }>
  if (childObjects.length) {
    const participantRows = childObjects.flatMap((child) => [
      {
        coordination_object_id: child.id,
        profile_id: input.ownerId,
        participant_name: 'Owner',
        role: 'owner',
        state: 'active',
      },
    ])

    const { error: participantError } = await supabase.from('coordination_object_participants').insert(participantRows)
    if (participantError) throw participantError

    const dependencies = childObjects.slice(1).map((child, index) => ({
      predecessor_id: childObjects[index].id,
      successor_id: child.id,
      dependency_kind: 'follows' satisfies CoordinationDependencyKind,
    }))

    if (dependencies.length) {
      const { error: dependencyError } = await supabase.from('coordination_object_dependencies').insert(dependencies)
      if (dependencyError) throw dependencyError
    }
  }

  return parentId
}

export async function syncProjectCoordinationObject(input: {
  ownerId: string
  projectId: string
  title: string
  category: string
  targetDate?: string | null
  status: 'active' | 'upcoming' | 'completed'
}) {
  return upsertCoordinationObject({
    ownerId: input.ownerId,
    sourceTable: 'projects',
    sourceId: input.projectId,
    kind: 'project',
    displayKind: 'project',
    title: input.title,
    summary: input.category,
    intent: 'coordinate',
    state: input.status === 'completed' ? 'completed' : input.status === 'upcoming' ? 'scheduled' : 'active',
    startsAt: input.targetDate ? asStartOfDay(input.targetDate) : null,
    endsAt: input.targetDate ? asEndOfDay(input.targetDate) : null,
    isAllDay: true,
    flexibility: 'shiftable',
    linkedProjectId: input.projectId,
    metadata: { category: input.category },
  })
}

export async function syncCalendarCoordinationObject(input: {
  ownerId: string
  eventId: string
  title: string
  startsAt: string
  endsAt: string
  projectId?: string | null
  notes?: string | null
}) {
  return upsertCoordinationObject({
    ownerId: input.ownerId,
    sourceTable: 'calendar_events',
    sourceId: input.eventId,
    kind: 'event',
    displayKind: 'event',
    title: input.title,
    summary: input.notes ?? null,
    intent: 'attend',
    state: 'scheduled',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    linkedProjectId: input.projectId ?? null,
    metadata: { notes: input.notes ?? null },
  })
}

export async function syncTaskCoordinationObject(input: {
  ownerId: string
  taskId: string
  projectId: string
  title: string
  dueOn?: string | null
  status: 'todo' | 'doing' | 'done'
  assigneeName?: string | null
}) {
  return upsertCoordinationObject({
    ownerId: input.ownerId,
    sourceTable: 'tasks',
    sourceId: input.taskId,
    kind: 'task',
    displayKind: 'task',
    title: input.title,
    summary: input.assigneeName ?? null,
    intent: 'deliver',
    state: input.status === 'done' ? 'completed' : input.status === 'doing' ? 'active' : 'pending',
    dueAt: input.dueOn ? asDueTime(input.dueOn) : null,
    linkedProjectId: input.projectId,
    flexibility: 'shiftable',
    metadata: { assigneeName: input.assigneeName ?? null },
  })
}

export async function syncPostCoordinationObject(input: {
  ownerId: string
  postId: string
  body: string
  linkedProjectId?: string | null
  replyToPostId?: string | null
  quotePostId?: string | null
}) {
  return upsertCoordinationObject({
    ownerId: input.ownerId,
    sourceTable: 'posts',
    sourceId: input.postId,
    kind: 'message',
    displayKind: 'chat',
    title: truncate(input.body, 64),
    summary: input.body,
    intent: input.replyToPostId ? 'notify' : 'coordinate',
    state: 'active',
    linkedProjectId: input.linkedProjectId ?? null,
    parentId: null,
    metadata: {
      replyToPostId: input.replyToPostId ?? null,
      quotePostId: input.quotePostId ?? null,
    },
  })
}

export async function syncDmThreadCoordinationObject(input: {
  ownerId: string
  threadId: string
  title: string
  linkedProjectId?: string | null
  threadKind: 'direct' | 'group'
}) {
  return upsertCoordinationObject({
    ownerId: input.ownerId,
    sourceTable: 'dm_threads',
    sourceId: input.threadId,
    kind: 'dm_thread',
    displayKind: 'chat',
    title: input.title || 'Direct message',
    intent: 'coordinate',
    state: 'active',
    linkedProjectId: input.linkedProjectId ?? null,
    flexibility: 'floating',
    metadata: { threadKind: input.threadKind },
  })
}

function mapCoordinationObject(row: CoordinationObjectRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    kind: row.kind,
    displayKind: row.display_kind,
    title: row.title,
    summary: row.summary,
    intent: row.intent,
    state: row.state,
    time: {
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      dueAt: row.due_at,
      isAllDay: row.is_all_day,
      flexibility: row.flexibility,
    },
    parentId: row.parent_id,
    linkedProjectId: row.linked_project_id,
    linkedListingId: row.linked_listing_id,
    linkedJobId: row.linked_job_id,
    metadata: {
      ...(row.metadata ?? {}),
      participants: (row.coordination_object_participants ?? []).map(mapParticipant),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies CoordinationObject
}

function mapParticipant(row: CoordinationParticipantRow) {
  return {
    id: row.id,
    coordinationObjectId: row.coordination_object_id,
    profileId: row.profile_id,
    participantName: row.participant_name,
    role: row.role,
    state: row.state,
  } satisfies CoordinationParticipant
}

function shiftDate(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function lastTemplateDay(blocks: CoordinationTemplateBlock[], anchorDate: string) {
  const latestOffset = blocks.reduce((max, block) => Math.max(max, (block.offsetDays ?? 0) + Math.max(0, (block.durationDays ?? 1) - 1)), 0)
  return shiftDate(anchorDate, latestOffset)
}

const starterTemplates: Array<{
  title: string
  summary: string
  displayKind: CoordinationDisplayKind
  blocks: CoordinationTemplateBlock[]
}> = [
  {
    title: 'Birthday rhythm',
    summary: 'A reusable birthday prep sequence with space for invites, gifts, and the day itself.',
    displayKind: 'plan',
    blocks: [
      { title: 'Gift ideas', kind: 'plan', displayKind: 'task', intent: 'celebrate', offsetDays: -21, durationDays: 1, lane: 'Support' },
      { title: 'Invite people', kind: 'message', displayKind: 'chat', intent: 'notify', offsetDays: -14, durationDays: 1, lane: 'People' },
      { title: 'Buy present', kind: 'purchase', displayKind: 'purchase', intent: 'buy', offsetDays: -7, durationDays: 1, lane: 'Support' },
      { title: 'Birthday day', kind: 'event', displayKind: 'event', intent: 'celebrate', offsetDays: 0, durationDays: 1, lane: 'Main event' },
    ],
  },
  {
    title: 'Doctor appointment flow',
    summary: 'Book, attend, collect what you need, and follow up without dropping the supporting steps.',
    displayKind: 'workflow',
    blocks: [
      { title: 'Request appointment', kind: 'request', displayKind: 'task', intent: 'health', offsetDays: 0, durationDays: 1, lane: 'Admin' },
      { title: 'Request leave', kind: 'request', displayKind: 'task', intent: 'work', offsetDays: 1, durationDays: 1, lane: 'Work' },
      { title: 'Appointment', kind: 'event', displayKind: 'event', intent: 'health', offsetDays: 7, durationDays: 1, lane: 'Main event' },
      { title: 'Collect certificate', kind: 'request', displayKind: 'task', intent: 'health', offsetDays: 7, durationDays: 1, lane: 'Support' },
      { title: 'Follow-up reminder', kind: 'reminder', displayKind: 'reminder', intent: 'remind', offsetDays: 10, durationDays: 1, lane: 'Support' },
    ],
  },
  {
    title: 'Weekend move mini-flow',
    summary: 'A lighter-weight moving sequence with the main event plus the support clips around it.',
    displayKind: 'project',
    blocks: [
      { title: 'Confirm van or transport', kind: 'booking', displayKind: 'booking', intent: 'book', offsetDays: -10, durationDays: 1, lane: 'Logistics' },
      { title: 'Ask helpers', kind: 'message', displayKind: 'chat', intent: 'ask', offsetDays: -7, durationDays: 1, lane: 'People' },
      { title: 'Pack essentials', kind: 'task', displayKind: 'task', intent: 'deliver', offsetDays: -3, durationDays: 2, lane: 'Prep' },
      { title: 'Move day', kind: 'event', displayKind: 'event', intent: 'coordinate', offsetDays: 0, durationDays: 1, lane: 'Main event' },
      { title: 'Return keys / tidy', kind: 'task', displayKind: 'task', intent: 'deliver', offsetDays: 1, durationDays: 1, lane: 'Wrap-up' },
    ],
  },
]

function truncate(value: string, length: number) {
  const trimmed = value.trim()
  if (trimmed.length <= length) return trimmed || 'Untitled'
  return `${trimmed.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

function asStartOfDay(day: string) {
  return `${day}T00:00:00.000Z`
}

function asEndOfDay(day: string) {
  return `${day}T23:59:59.000Z`
}

function asDueTime(day: string) {
  return `${day}T17:00:00.000Z`
}
