import { supabase } from './supabase'

export async function createNotification(input: {
  profileId: string
  title: string
  body: string
  kind: string
  linkUrl?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('notifications').insert({
    profile_id: input.profileId,
    title: input.title,
    body: input.body,
    kind: input.kind,
    link_url: input.linkUrl ?? null,
  })
  if (error) throw error
}

export async function fetchNotifications() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, kind, is_read, link_url, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function markNotificationRead(notificationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
  if (error) throw error
}

export async function createActivity(input: {
  ownerId: string
  projectId: string
  activityType: string
  title: string
  detail: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('project_activity').insert({
    owner_id: input.ownerId,
    project_id: input.projectId,
    activity_type: input.activityType,
    title: input.title,
    detail: input.detail,
  })
  if (error) throw error
}

export async function fetchProjectActivity(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_activity')
    .select('id, activity_type, title, detail, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
