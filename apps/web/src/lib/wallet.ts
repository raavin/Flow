import { supabase } from './supabase'
import { createNotification } from './coordination'

export async function fetchWalletEntries() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('wallet_entries')
    .select('id, linked_project_id, entry_kind, direction, amount_cents, counterparty, reason, note, due_on, status, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createWalletEntry(input: {
  profileId: string
  linkedProjectId?: string | null
  entryKind: 'send' | 'request' | 'iou'
  direction: 'in' | 'out'
  amountCents: number
  counterparty: string
  reason: string
  note?: string
  dueOn?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('wallet_entries').insert({
    profile_id: input.profileId,
    linked_project_id: input.linkedProjectId ?? null,
    entry_kind: input.entryKind,
    direction: input.direction,
    amount_cents: input.amountCents,
    counterparty: input.counterparty,
    reason: input.reason,
    note: input.note ?? null,
    due_on: input.dueOn ?? null,
  })
  if (error) throw error
  await createNotification({
    profileId: input.profileId,
    title: input.entryKind === 'iou' ? 'IOU tracked' : 'Wallet updated',
    body: `${input.counterparty} · $${(input.amountCents / 100).toFixed(2)}`,
    kind: 'payments',
  })
}

export async function settleWalletEntry(entryId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('wallet_entries').update({ status: 'settled' }).eq('id', entryId)
  if (error) throw error
}
