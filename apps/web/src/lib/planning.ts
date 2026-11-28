import { optimisticWrite, editRows, removeRows, insertRow } from './optimistic'
import { assertBudgetAmount } from './budget'
import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'

export type Expense = {
  id: string
  project_id: string
  category: string
  title: string
  estimate_cents: number
  actual_cents: number
  paid_cents?: number
  linked_payment_count?: number
  payment_status: 'unpaid' | 'pending' | 'paid'
  linked_listing_id: string | null
  allocation_id: string | null
  created_at?: string
  incurred_on?: string | null
  counterparty_label?: string
}
export async function fetchExpenses(projectId?: string): Promise<Expense[]> {
  if (!supabase) return []
  let query = supabase
    .from('project_expenses')
    .select(
      'id, project_id, category, title, estimate_cents, actual_cents, payment_status, linked_listing_id, allocation_id, created_at, incurred_on, counterparty_label',
    )
    .order('created_at', { ascending: true })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    let legacy = supabase
      .from('project_expenses')
      .select(
        'id, project_id, category, title, estimate_cents, actual_cents, payment_status, linked_listing_id',
      )
      .order('created_at', { ascending: true })
    if (projectId) legacy = legacy.eq('project_id', projectId)
    const result = await legacy
    if (result.error) throw result.error
    return (result.data ?? []).map((row) => ({
      ...row,
      allocation_id: null as string | null,
    }))
  }
  if (error) throw error
  if (!data?.length) return []
  const { data: payments, error: paymentError } = await supabase
    .from('financial_transactions')
    .select('expense_id,total_cents,status')
    .in(
      'expense_id',
      (data ?? []).map((row) => row.id),
    )
  if (paymentError) throw paymentError
  return (data ?? []).map((row) => {
    const linked = (payments ?? []).filter((p) => p.expense_id === row.id)
    return {
      ...row,
      linked_payment_count: linked.length,
      ...(linked.length
        ? {
            paid_cents: linked
              .filter((p) => ['settled', 'paid'].includes(p.status))
              .reduce((sum, p) => sum + p.total_cents, 0),
          }
        : {}),
    }
  })
}

export async function createExpense(input: {
  ownerId: string
  projectId: string
  category: string
  title: string
  estimateCents: number
  actualCents: number
  paymentStatus: 'unpaid' | 'pending' | 'paid'
  allocationId?: string | null
  linkedListingId?: string | null
  incurredOn?: string
  counterparty?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!input.title.trim()) throw new Error('Give this cost a name.')
  assertBudgetAmount(input.estimateCents)
  assertBudgetAmount(input.actualCents)
  const id = crypto.randomUUID()
  return optimisticWrite(
    `expense:${id}`,
    [
      insertRow(
        ['expenses'],
        {
          id,
          project_id: input.projectId,
          category: input.category,
          title: input.title,
          estimate_cents: input.estimateCents,
          actual_cents: input.actualCents,
          payment_status: input.paymentStatus,
          allocation_id: input.allocationId ?? null,
          linked_listing_id: input.linkedListingId ?? null,
          incurred_on: input.incurredOn ?? null,
          counterparty_label: input.counterparty ?? '',
          _pending: true,
        },
        (key) => key.includes(input.projectId) || key.includes('all'),
      ),
    ],
    async () => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.from('project_expenses').insert({
        id,
        incurred_on: input.incurredOn ?? null,
        counterparty_label: input.counterparty ?? '',
        owner_id: input.ownerId,
        project_id: input.projectId,
        category: input.category,
        title: input.title,
        estimate_cents: input.estimateCents,
        actual_cents: input.actualCents,
        payment_status: input.paymentStatus,
        linked_listing_id: input.linkedListingId ?? null,
        ...(input.allocationId ? { allocation_id: input.allocationId } : {}),
      })
      if (error) throw error
      await createActivity({
        ownerId: input.ownerId,
        projectId: input.projectId,
        activityType: 'expense_added',
        title: 'Expense added',
        detail: `${input.title} added under ${input.category}.`,
      }).catch(() => {})
      return id
    },
  )
}

export async function updateExpense(
  expenseId: string,
  input: {
    incurredOn?: string
    counterparty?: string
    allocationId?: string | null
    title?: string
    category?: string
    estimateCents?: number
    actualCents?: number
    paymentStatus?: 'unpaid' | 'pending' | 'paid'
  },
) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (input.incurredOn !== undefined) payload.incurred_on = input.incurredOn
  if (input.counterparty !== undefined) payload.counterparty_label = input.counterparty
  if (input.allocationId !== undefined) payload.allocation_id = input.allocationId
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.category !== undefined) payload.category = input.category.trim()
  if (input.estimateCents !== undefined) {
    assertBudgetAmount(input.estimateCents)
    payload.estimate_cents = input.estimateCents
  }
  if (input.actualCents !== undefined) {
    assertBudgetAmount(input.actualCents)
    payload.actual_cents = input.actualCents
  }
  if (input.paymentStatus !== undefined) payload.payment_status = input.paymentStatus

  return optimisticWrite('expense:' + expenseId, [editRows(['expenses'], expenseId, payload)], async () => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { error } = await supabase.from('project_expenses').update(payload).eq('id', expenseId)
    if (error) throw error
  })
}

export async function deleteExpense(expenseId: string) {
  return optimisticWrite('expense:' + expenseId, [removeRows(['expenses'], expenseId)], async () => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { error } = await supabase.from('project_expenses').delete().eq('id', expenseId)
    if (error) throw error
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

export async function deleteStructuredUpdate(updateId: string) {
  return optimisticWrite(
    'update:' + updateId,
    [removeRows(['structured-updates', 'job-structured-updates'], updateId)],
    async () => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.from('structured_updates').delete().eq('id', updateId)
      if (error) throw error
    },
  )
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
      affected: ['project activity'],
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
        : `Time change: ${deltaMinutes} minutes. A selected milestone moves by the nearest whole day.`,
    affected: ['selected milestone'],
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
    ['available Saturday', 'available Sunday afternoon', 'available Saturday morning'].includes(
      item.availability_status,
    ),
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
      saturday.length >= sunday.length
        ? 'Saturday morning looks strongest'
        : 'Sunday afternoon looks strongest',
    supportingPeople: (saturday.length >= sunday.length ? saturday : sunday).map((item) => item.name),
  }
}

function shiftDate(input: string, days: number) {
  const date = new Date(`${input}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
