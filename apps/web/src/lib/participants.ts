import { supabase } from './supabase'

export async function fetchParticipants(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_participants')
    .select(
      'id, name, participant_kind, role, status, availability_status, visibility_scope, contact_hint, note',
    )
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

  if (!input.contactHint?.startsWith('@')) throw new Error('Choose a Flow account to invite.')
  const { error } = await supabase.rpc('invite_project_person', {
    p_project: input.projectId,
    p_handle: input.contactHint,
    p_role: input.role,
  })
  if (error) throw error
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
