import { supabase } from './supabase'
import { createNotification } from './coordination'
import { createWalletEntry } from './wallet'

export async function fetchJobs() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, linked_project_id, linked_listing_id, booking_at, status, payment_state, notes, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchJobDetail(jobId: string) {
  if (!supabase) return null
  const [{ data: job, error: jobError }, { data: steps, error: stepsError }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, customer_name, linked_project_id, linked_listing_id, booking_at, status, payment_state, notes, created_at')
      .eq('id', jobId)
      .single(),
    supabase
      .from('job_workflow_steps')
      .select('id, title, status, customer_visible')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ])
  if (jobError) throw jobError
  if (stepsError) throw stepsError
  return { job, steps: steps ?? [] }
}

export async function createJob(input: {
  ownerId: string
  title: string
  customerName: string
  linkedProjectId?: string | null
  linkedListingId?: string | null
  bookingAt?: string | null
  status: 'today' | 'upcoming' | 'waiting' | 'delayed' | 'completed'
  paymentState: 'unpaid' | 'deposit due' | 'paid'
  notes?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('jobs').insert({
    owner_id: input.ownerId,
    title: input.title,
    customer_name: input.customerName,
    linked_project_id: input.linkedProjectId ?? null,
    linked_listing_id: input.linkedListingId ?? null,
    booking_at: input.bookingAt ?? null,
    status: input.status,
    payment_state: input.paymentState,
    notes: input.notes ?? null,
  })
  if (error) throw error
  const { data: createdJob } = await supabase
    .from('jobs')
    .select('id')
    .eq('owner_id', input.ownerId)
    .eq('title', input.title)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (createdJob?.id) {
    const { error: stepsError } = await supabase.from('job_workflow_steps').insert([
      { job_id: createdJob.id, owner_id: input.ownerId, title: 'Confirm appointment', status: 'todo', customer_visible: true },
      { job_id: createdJob.id, owner_id: input.ownerId, title: 'Prepare materials', status: 'todo', customer_visible: false },
      { job_id: createdJob.id, owner_id: input.ownerId, title: 'Complete service', status: 'todo', customer_visible: true },
    ])
    if (stepsError) throw stepsError
  }
  await createNotification({
    profileId: input.ownerId,
    title: 'Job created',
    body: `${input.customerName} · ${input.title}`,
    kind: 'bookings',
    linkUrl: createdJob?.id ? `/app/jobs/${createdJob.id}` : '/app/jobs',
  })
}

export async function updateJobStatus(jobId: string, status: 'today' | 'upcoming' | 'waiting' | 'delayed' | 'completed') {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId)
  if (error) throw error
}

export async function updateJobPaymentState(jobId: string, paymentState: 'unpaid' | 'deposit due' | 'paid') {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('jobs').update({ payment_state: paymentState }).eq('id', jobId)
  if (error) throw error
}

export async function updateJobBooking(jobId: string, bookingAt: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('jobs').update({ booking_at: bookingAt }).eq('id', jobId)
  if (error) throw error
}

export async function updateJobNotes(jobId: string, notes: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('jobs').update({ notes }).eq('id', jobId)
  if (error) throw error
}

export async function updateWorkflowStep(input: {
  stepId: string
  status?: 'todo' | 'doing' | 'done'
  customerVisible?: boolean
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (input.status) payload.status = input.status
  if (typeof input.customerVisible === 'boolean') payload.customer_visible = input.customerVisible
  const { error } = await supabase.from('job_workflow_steps').update(payload).eq('id', input.stepId)
  if (error) throw error
}

export async function requestJobPayment(input: {
  ownerId: string
  jobId: string
  customerName: string
  linkedProjectId?: string | null
  amountCents: number
  reason: string
}) {
  await createWalletEntry({
    profileId: input.ownerId,
    linkedProjectId: input.linkedProjectId ?? null,
    entryKind: 'request',
    direction: 'in',
    amountCents: input.amountCents,
    counterparty: input.customerName,
    reason: input.reason,
  })
  await createNotification({
    profileId: input.ownerId,
    title: 'Payment requested',
    body: `${input.customerName} · ${input.reason}`,
    kind: 'wallet',
    linkUrl: '/app/wallet',
  })
}
