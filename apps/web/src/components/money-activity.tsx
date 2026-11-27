import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AppButton, AppCard, SectionHeading } from '@superapp/ui'
import { formatCurrency } from '@/lib/commerce'
import type { MoneyRecord } from '@/lib/money'
import { ExpenseReceipts } from './expense-receipts'
import { useAppStore } from '@/hooks/useAppStore'

export function ReceiptPanel({
  record,
  onClose,
}: {
  record: MoneyRecord
  onClose: () => void
}) {
  const { session } = useAppStore()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [record.id])
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <AppCard className="space-y-3">
        <SectionHeading
          title={`Receipts: ${record.title}`}
          action={
            <AppButton variant="ghost" onClick={onClose}>
              Close receipts
            </AppButton>
          }
        />
        {record.details ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">
              Payment details
            </summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['Reference', record.details.reference || '—'],
                ['Source', record.details.source],
                [
                  'Subtotal',
                  formatCurrency(record.details.subtotal, record.currency),
                ],
                ['Tax', formatCurrency(record.details.tax, record.currency)],
                ['Fees', formatCurrency(record.details.fee, record.currency)],
                ['Net', formatCurrency(record.details.net, record.currency)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 border-b border-border py-1"
                >
                  <dt className="text-ink/65">{label}</dt>
                  <dd className="min-w-0 break-all tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        {session ? (
          <ExpenseReceipts
            key={record.id}
            target={record.target}
            ownerId={session.user.id}
          />
        ) : null}
      </AppCard>
    </div>
  )
}
export function MoneyActivityTable({
  rows,
  projects,
  onEdit,
  onDelete,
  busy = false,
}: {
  rows: MoneyRecord[]
  projects: { id: string; title: string }[]
  onEdit?: (record: MoneyRecord) => void
  onDelete?: (record: MoneyRecord) => Promise<void>
  busy?: boolean
}) {
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const receipt = rows.find((r) => r.id === receiptId)
  return (
    <div className="space-y-3 min-w-0">
      <div
        role="region"
        aria-label="Money activity table"
        tabIndex={0}
        className="ui-ledger-shell relative"
      >
        <table className="ui-budget-table min-w-[840px]">
          <caption className="sr-only">Expenses and income</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Project</th>
              <th scope="col" className="budget-money">
                Amount
              </th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap">
                  {row.date
                    ? new Date(`${row.date}T12:00:00`).toLocaleDateString(
                        'en-AU',
                      )
                    : '—'}
                </td>
                <th scope="row" className="text-left font-normal">
                  <span className="font-semibold">
                    {row.title || 'Untitled record'}
                  </span>
                  <p className="text-xs text-ink/65">
                    {row.counterparty ||
                      (row.direction === 'in'
                        ? 'Income'
                        : row.target.kind === 'expense'
                          ? 'Project cost'
                          : 'Payment record')}
                  </p>
                </th>
                <td>
                  {row.projectId ? (
                    <Link
                      to="/app/projects/$projectId/budget"
                      params={{ projectId: row.projectId }}
                      className="underline"
                    >
                      {projects.find((p) => p.id === row.projectId)?.title ??
                        'Open project'}
                    </Link>
                  ) : (
                    <span className="text-ink/60">No project</span>
                  )}
                </td>
                <td className="budget-money">
                  {row.direction === 'in' ? '+' : '−'}
                  {formatCurrency(row.amount, row.currency)}
                </td>
                <td className="whitespace-nowrap">
                  {row.status === 'pending'
                    ? row.direction === 'in'
                      ? 'Expected'
                      : 'Unpaid'
                    : row.status === 'paid' && row.direction === 'in'
                      ? 'Received'
                      : row.status.charAt(0).toUpperCase() +
                        row.status.slice(1)}
                </td>
                <td className="budget-actions">
                  <AppButton
                    variant="ghost"
                    aria-expanded={receiptId === row.id}
                    onClick={() =>
                      setReceiptId(receiptId === row.id ? null : row.id)
                    }
                  >
                    Receipts
                  </AppButton>
                  {row.editable && onEdit ? (
                    <AppButton
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </AppButton>
                  ) : null}
                  {row.editable && onDelete ? (
                    deleting === row.id ? (
                      <>
                        <AppButton
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            void onDelete(row)
                              .then(() => setDeleting(null))
                              .catch(() => {})
                          }}
                        >
                          Confirm delete
                        </AppButton>
                        <AppButton
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                        >
                          Cancel
                        </AppButton>
                      </>
                    ) : (
                      <AppButton
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setDeleting(row.id)}
                      >
                        Delete
                      </AppButton>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-4 text-sm text-ink/65">
            No entries match these filters.
          </p>
        ) : null}
      </div>
      {receipt ? (
        <ReceiptPanel record={receipt} onClose={() => setReceiptId(null)} />
      ) : null}
    </div>
  )
}
