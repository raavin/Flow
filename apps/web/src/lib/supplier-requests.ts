import { supabase } from './supabase'
export function database() {
  if (!supabase) throw new Error('Sign in to use this feature.')
  return supabase
}
export function featureError(error: unknown): string {
  const e = error as { message?: string; code?: string }
  if (e?.code === '23503')
    return 'This record is linked to a quote, receipt or cost. Keep it for the project history, or remove its attachments first.'
  return ['42P01', '42703', 'PGRST202', 'PGRST205'].includes(e?.code ?? '')
    ? 'This feature needs the latest database update. Your existing planning records are unchanged.'
    : e?.message || 'Could not complete this action. Please try again.'
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await database().rpc(name, args)
  if (error) throw error
  return data
}
export interface SupplierRequest {
  id: string
  owner_id: string
  project_id: string | null
  allocation_id: string | null
  title: string
  description: string
  context_note: string
  location_label: string
  due_on: string | null
  budget_cents: number | null
  status: string
}
export interface SupplierQuote {
  id: string
  request_id: string
  supplier_id: string
  requester_id: string
  supplier_label: string
  amount_cents: number
  details: string
  available_on: string | null
  valid_until: string | null
  status: string
  expense_id: string | null
}
export async function fetchRequests() {
  const { data, error } = await database()
    .from('marketplace_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as SupplierRequest[]
}
export async function fetchQuotes(requestId?: string) {
  let q = database().from('supplier_quotes').select('*').order('created_at')
  if (requestId) q = q.eq('request_id', requestId)
  const { data, error } = await q
  if (error) throw error
  return data as SupplierQuote[]
}
export interface Allocation {
  id: string
  name: string
  limit_cents: number
  project_id: string
}
export async function fetchAllocations(projectId: string) {
  const { data, error } = await database()
    .from('project_budget_allocations')
    .select('*')
    .eq('project_id', projectId)
    .order('name')
  if (error) throw error
  return data as Allocation[]
}
export const receiptTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]
export function validateReceipt(file: Pick<File, 'size' | 'type'>) {
  if (!receiptTypes.includes(file.type))
    throw new Error('Choose a JPEG, PNG, WebP image or PDF.')
  if (file.size <= 0 || file.size > 10485760)
    throw new Error('Receipts must be between 1 byte and 10 MB.')
}
export type ReceiptTarget = { kind: 'expense' | 'transaction'; id: string }
export async function uploadReceipt(
  file: File,
  expenseId: string | ReceiptTarget,
  ownerId: string,
) {
  validateReceipt(file)
  const db = database()
  const target =
    typeof expenseId === 'string'
      ? { kind: 'expense', id: expenseId }
      : expenseId
  const folder =
    target.kind === 'expense' ? target.id : `transactions/${target.id}`
  const path = `${ownerId}/${folder}/${crypto.randomUUID()}.${file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]}`
  const { error } = await db.storage
    .from('expense-receipts')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  const { error: insertError } = await db.from('expense_receipts').insert({
    owner_id: ownerId,
    ...(target.kind === 'expense'
      ? { expense_id: target.id }
      : { transaction_id: target.id }),
    storage_path: path,
    file_name: file.name.slice(0, 255),
    mime_type: file.type,
    size_bytes: file.size,
  })
  if (insertError) {
    await db.storage.from('expense-receipts').remove([path])
    throw insertError
  }
}
