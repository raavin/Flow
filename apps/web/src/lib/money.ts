import type { ReceiptTarget } from './supplier-requests'
import type { fetchWalletEntries } from './wallet'
import type { fetchExpenses } from './planning'

export type MoneyRecord = {
  id: string
  target: ReceiptTarget
  projectId: string | null
  title: string
  counterparty: string
  date: string
  amount: number
  currency: string
  direction: 'in' | 'out'
  status: string
  editable: boolean
  expenseId?: string | null
  hasPayments?: boolean
  paid?: number
  estimate?: number
  actual?: number
  category?: string
  allocationId?: string | null
  details?: {
    reference: string | null
    subtotal: number
    tax: number
    fee: number
    net: number
    source: string
  }
}
export function moneyRecords(
  costs: Awaited<ReturnType<typeof fetchExpenses>>,
  payments: Awaited<ReturnType<typeof fetchWalletEntries>>,
): MoneyRecord[] {
  return [
    ...costs.map((c) => ({
      id: `expense:${c.id}`,
      target: { kind: 'expense' as const, id: c.id },
      projectId: c.project_id,
      title: c.title,
      counterparty: c.counterparty_label ?? '',
      date: c.incurred_on ?? (c.created_at ? localDay(new Date(c.created_at)) : ''),
      amount: c.payment_status === 'paid' || c.actual_cents > 0 ? c.actual_cents : c.estimate_cents,
      hasPayments: !!c.linked_payment_count,
      currency: 'AUD',
      direction: 'out' as const,
      paid: c.paid_cents ?? (c.payment_status === 'paid' ? c.actual_cents : 0),
      status: c.linked_payment_count
        ? (c.paid_cents ?? 0) >= (c.actual_cents || c.estimate_cents)
          ? 'paid'
          : (c.paid_cents ?? 0) > 0
            ? 'part paid'
            : 'committed'
        : c.payment_status === 'unpaid'
          ? 'planned'
          : c.payment_status === 'pending'
            ? 'committed'
            : 'paid',
      editable: true,
      estimate: c.estimate_cents,
      actual: c.actual_cents,
      category: c.category,
      allocationId: c.allocation_id,
    })),
    ...payments.map((p) => ({
      id: `transaction:${p.id}`,
      target: { kind: 'transaction' as const, id: p.id },
      projectId: p.linkedProjectId,
      expenseId: p.expenseId,
      title: p.description,
      counterparty: p.counterpartyLabel,
      date: localDay(new Date(p.occurredAt)),
      amount: p.totalCents,
      currency: p.currencyCode,
      direction: p.direction,
      status: p.status === 'settled' ? 'paid' : p.status,
      editable: p.transactionRole === 'manual' && ['pending', 'settled'].includes(p.status),
      details: {
        reference: p.referenceNumber,
        subtotal: p.subtotalCents,
        tax: p.taxCents,
        fee: p.platformFeeCents,
        net: p.sellerNetCents,
        source: p.sourceKind,
      },
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
export function filterMoneyRecords(rows: MoneyRecord[], projects: string[], status: string, search: string) {
  const needle = search.trim().toLocaleLowerCase()
  return rows.filter(
    (r) =>
      (!projects.length || (!!r.projectId && projects.includes(r.projectId))) &&
      (status === 'all' ||
        (status === 'unpaid'
          ? ['planned', 'committed', 'pending', 'part paid'].includes(r.status)
          : r.status === status)) &&
      (!needle || `${r.title} ${r.counterparty}`.toLocaleLowerCase().includes(needle)),
  )
}
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
