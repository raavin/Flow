import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'

export async function fetchParticipants(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_participants')
    .select('id, name, participant_kind, role, status, availability_status, visibility_scope, contact_hint, note')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function inviteParticipant(input: {
  ownerId: string
  projectId: string
  name: string
  participantKind: 'person' | 'business'
  role: 'owner' | 'collaborator' | 'helper' | 'guest' | 'provider' | 'viewer'
  contactHint?: string
  note?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const existing = await fetchParticipants(input.projectId)
  const duplicate = existing.find(
    (p) => p.name.trim().toLowerCase() === input.name.trim().toLowerCase() && p.status !== 'removed',
  )
  if (duplicate) throw new Error(`${input.name} is already a participant in this project.`)

  const { error } = await supabase.from('project_participants').insert({
    project_id: input.projectId,
    owner_id: input.ownerId,
    name: input.name,
    participant_kind: input.participantKind,
    role: input.role,
    contact_hint: input.contactHint ?? null,
    note: input.note ?? null,
  })
  if (error) throw error
  await createActivity({
    ownerId: input.ownerId,
    projectId: input.projectId,
    activityType: 'participant_invited',
    title: 'Participant invited',
    detail: `${input.name} invited as ${input.role}.`,
  })
  await createNotification({
    profileId: input.ownerId,
    title: 'Participant added',
    body: `${input.name} is now part of the project flow.`,
    kind: 'projects',
    linkUrl: `/app/projects/${input.projectId}/people`,
  })
}

export async function updateParticipant(input: {
  participantId: string
  name?: string
  role?: 'owner' | 'collaborator' | 'helper' | 'guest' | 'provider' | 'viewer'
  status?: 'invited' | 'active' | 'declined'
  availabilityStatus?: string
  visibilityScope?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name.trim() || 'Unknown'
  if (input.role) payload.role = input.role
  if (input.status) payload.status = input.status
  if (input.availabilityStatus) payload.availability_status = input.availabilityStatus
  if (input.visibilityScope) payload.visibility_scope = input.visibilityScope

  const { error } = await supabase.from('project_participants').update(payload).eq('id', input.participantId)
  if (error) throw error
}

export async function removeParticipant(participantId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('project_participants').delete().eq('id', participantId)
  if (error) throw error
}
