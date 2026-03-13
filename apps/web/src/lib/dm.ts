import { supabase } from './supabase'
import { syncDmThreadCoordinationObject } from './coordination-objects'

export async function fetchDmThreads() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('dm_threads')
    .select('id, title, thread_kind, linked_project_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createDmThread(input: {
  ownerId: string
  title: string
  threadKind: 'direct' | 'group'
  linkedProjectId?: string | null
  memberIds: string[]
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const memberIds = [...new Set(input.memberIds)]
  const { data, error } = await supabase.rpc('create_dm_thread', {
    p_title: input.title,
    p_thread_kind: input.threadKind,
    p_linked_project_id: input.linkedProjectId ?? null,
    p_member_ids: memberIds,
  })
  if (error) throw error
  const thread = Array.isArray(data) ? data[0] : data
  if (!thread) {
    throw new Error('Direct message thread could not be created.')
  }
  await syncDmThreadCoordinationObject({
    ownerId: input.ownerId,
    threadId: thread.id,
    title: thread.title,
    linkedProjectId: thread.linked_project_id,
    threadKind: thread.thread_kind,
  })
  return thread
}

export async function fetchDmMessages(threadId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, author_id, body, metadata, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function sendDmMessage(input: {
  threadId: string
  authorId: string
  body: string
  imagePaths?: string[]
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('dm_messages').insert({
    thread_id: input.threadId,
    author_id: input.authorId,
    body: input.body,
    metadata: { imagePaths: input.imagePaths ?? [] },
  })
  if (error) throw error
}
