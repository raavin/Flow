import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'

export async function fetchExpenses(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_expenses')
    .select('id, category, title, estimate_cents, actual_cents, payment_status, linked_listing_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createExpense(input: {
  ownerId: string
  projectId: string
  category: string
  title: string
  estimateCents: number
  actualCents: number
  paymentStatus: 'unpaid' | 'pending' | 'paid'
  linkedListingId?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('project_expenses').insert({
    owner_id: input.ownerId,
    project_id: input.projectId,
    category: input.category,
    title: input.title,
    estimate_cents: input.estimateCents,
    actual_cents: input.actualCents,
    payment_status: input.paymentStatus,
    linked_listing_id: input.linkedListingId ?? null,
  })
  if (error) throw error
  await createActivity({
    ownerId: input.ownerId,
    projectId: input.projectId,
    activityType: 'expense_added',
    title: 'Expense added',
    detail: `${input.title} added under ${input.category}.`,
  })
}

export async function fetchStructuredUpdates(projectId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('structured_updates')
    .select('id, update_type, affected_milestone_id, previous_time, next_time, note, ai_replan, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function previewStructuredImpact(input: {
  updateType: string
  previousTime?: string
  nextTime?: string
  note?: string
}) {
  if (!input.previousTime || !input.nextTime) {
    return {
      deltaMinutes: 0,
      message: input.note || 'This update will be recorded in the project activity feed.',
      affected: ['participants', 'calendar', 'linked bookings'],
    }
  }

  const previous = new Date(input.previousTime).getTime()
  const next = new Date(input.nextTime).getTime()
  const deltaMinutes = Math.round((next - previous) / 60000)

  return {
    deltaMinutes,
    message:
      deltaMinutes === 0
        ? 'No timing shift detected.'
        : `Expected schedule shift of ${deltaMinutes} minutes across related milestones.`,
    affected: ['helper arrival', 'van pickup timing', 'cleaner access window'],
  }
}

export async function createStructuredUpdate(input: {
  ownerId: string
  projectId: string
  updateType: string
  affectedMilestoneId?: string | null
  previousTime?: string
  nextTime?: string
  note?: string
  aiReplan: boolean
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('structured_updates').insert({
    owner_id: input.ownerId,
    project_id: input.projectId,
    update_type: input.updateType,
    affected_milestone_id: input.affectedMilestoneId ?? null,
    previous_time: input.previousTime ?? null,
    next_time: input.nextTime ?? null,
    note: input.note ?? null,
    ai_replan: input.aiReplan,
  })
  if (error) throw error

  if (input.affectedMilestoneId && input.previousTime && input.nextTime) {
    const deltaDays = Math.round(
      (new Date(input.nextTime).getTime() - new Date(input.previousTime).getTime()) / 86400000,
    )
    if (deltaDays !== 0) {
      const { data: milestone, error: milestoneError } = await supabase
        .from('milestones')
        .select('starts_on, ends_on, title')
        .eq('id', input.affectedMilestoneId)
        .single()
      if (milestoneError) throw milestoneError
      const startsOn = shiftDate(milestone.starts_on, deltaDays)
      const endsOn = shiftDate(milestone.ends_on, deltaDays)
      const { error: updateError } = await supabase
        .from('milestones')
        .update({ starts_on: startsOn, ends_on: endsOn })
        .eq('id', input.affectedMilestoneId)
      if (updateError) throw updateError
    }
  }

  await createActivity({
    ownerId: input.ownerId,
    projectId: input.projectId,
    activityType: 'structured_update',
    title: 'Structured update posted',
    detail: input.note || input.updateType,
  })
  await createNotification({
    profileId: input.ownerId,
    title: 'Project update posted',
    body: input.note || input.updateType,
    kind: 'projects',
    linkUrl: `/app/projects/${input.projectId}/conversation`,
  })
}

export async function computeAvailabilitySuggestion(projectId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('project_participants')
    .select('name, availability_status, role')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const active = (data ?? []).filter((item) =>
    ['available Saturday', 'available Sunday afternoon', 'available Saturday morning'].includes(item.availability_status),
  )

  if (!active.length) {
    return {
      recommendation: 'No clear shared slot yet',
      supportingPeople: [],
    }
  }

  const saturday = active.filter((item) => item.availability_status.includes('Saturday'))
  const sunday = active.filter((item) => item.availability_status.includes('Sunday'))

  return {
    recommendation:
      saturday.length >= sunday.length ? 'Saturday morning looks strongest' : 'Sunday afternoon looks strongest',
    supportingPeople: (saturday.length >= sunday.length ? saturday : sunday).map((item) => item.name),
  }
}

function shiftDate(input: string, days: number) {
  const date = new Date(`${input}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
