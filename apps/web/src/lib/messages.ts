import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'

export async function fetchThreads() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('conversation_threads')
    .select('id, title, thread_kind, linked_project_id, pending_action, archived, created_at')
    .eq('archived', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchConversationFeed(userId: string) {
  if (!supabase) return []

  const threads = await fetchThreads()
  if (!threads.length) return []

  const threadIds = threads.map((thread) => thread.id)
  const [{ data: messages, error: messagesError }, { data: engagements, error: engagementsError }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('id, thread_id, author_id, body, message_type, structured_type, metadata, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversation_engagements')
        .select('thread_id, user_id, liked, reposted, bookmarked')
        .in('thread_id', threadIds),
    ])

  if (messagesError) throw messagesError
  if (engagementsError) throw engagementsError

  return threads.map((thread) => {
    const threadMessages = (messages ?? []).filter((message) => message.thread_id === thread.id)
    const openingMessage = threadMessages[0] ?? null
    const replies = threadMessages.slice(1)
    const threadEngagements = (engagements ?? []).filter((engagement) => engagement.thread_id === thread.id)
    const currentUserEngagement = threadEngagements.find((engagement) => engagement.user_id === userId)

    return {
      ...thread,
      openingMessage,
      replyCount: replies.length,
      likeCount: threadEngagements.filter((engagement) => engagement.liked).length,
      repostCount: threadEngagements.filter((engagement) => engagement.reposted).length,
      bookmarkCount: threadEngagements.filter((engagement) => engagement.bookmarked).length,
      viewerLiked: currentUserEngagement?.liked ?? false,
      viewerReposted: currentUserEngagement?.reposted ?? false,
      viewerBookmarked: currentUserEngagement?.bookmarked ?? false,
    }
  })
}

export async function createThread(input: {
  ownerId: string
  title: string
  threadKind: 'project' | 'direct' | 'business' | 'request'
  linkedProjectId?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('conversation_threads')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      thread_kind: input.threadKind,
      linked_project_id: input.linkedProjectId ?? null,
    })
    .select('id, title, thread_kind, linked_project_id, pending_action, archived, created_at')
    .single()
  if (error) throw error
  return data
}

export async function createThreadWithOpeningPost(input: {
  ownerId: string
  title: string
  body: string
  threadKind: 'project' | 'direct' | 'business' | 'request'
  linkedProjectId?: string | null
  metadata?: Record<string, unknown>
}) {
  const thread = await createThread(input)
  await sendMessage({
    threadId: thread.id,
    authorId: input.ownerId,
    body: input.body,
    messageType: 'text',
    metadata: input.metadata,
    linkedProjectId: input.linkedProjectId ?? null,
  })
  return thread
}

export async function fetchMessages(threadId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, author_id, body, message_type, structured_type, metadata, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function sendMessage(input: {
  threadId: string
  authorId: string
  body: string
  messageType?: 'text' | 'structured_update' | 'payment_request' | 'task_request'
  structuredType?: string | null
  metadata?: Record<string, unknown>
  linkedProjectId?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('messages').insert({
    thread_id: input.threadId,
    author_id: input.authorId,
    body: input.body,
    message_type: input.messageType ?? 'text',
    structured_type: input.structuredType ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) throw error

  if (input.linkedProjectId) {
    await createActivity({
      ownerId: input.authorId,
      projectId: input.linkedProjectId,
      activityType: input.messageType ?? 'text',
      title: 'New thread activity',
      detail: input.body,
    })
    await createNotification({
      profileId: input.authorId,
      title: 'Message sent',
      body: input.body,
      kind: 'messages',
    })
  }
}

export async function toggleThreadEngagement(input: {
  threadId: string
  userId: string
  field: 'liked' | 'reposted' | 'bookmarked'
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: existing, error: existingError } = await supabase
    .from('conversation_engagements')
    .select('id, liked, reposted, bookmarked')
    .eq('thread_id', input.threadId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    liked: existing?.liked ?? false,
    reposted: existing?.reposted ?? false,
    bookmarked: existing?.bookmarked ?? false,
    [input.field]: !(existing?.[input.field] ?? false),
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('conversation_engagements')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('conversation_engagements').insert({
    thread_id: input.threadId,
    user_id: input.userId,
    ...payload,
  })
  if (error) throw error
}
