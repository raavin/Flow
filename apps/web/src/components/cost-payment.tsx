import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppSelect } from '@superapp/ui'
import { AppDialog } from './app-dialog'
import { MoneyEntryForm } from './money-entry-form'
import type { MoneyRecord } from '@/lib/money'
import { fetchExpenses } from '@/lib/planning'
import { supabase } from '@/lib/supabase'
export function CostPayment({ record }: { record: MoneyRecord }) {
  const [open, setOpen] = useState(false)
  const [cost, setCost] = useState('')
  const client = useQueryClient()
  const costs = useQuery({
    queryKey: ['expenses', record.projectId],
    queryFn: () => fetchExpenses(record.projectId!),
    enabled: open && record.target.kind === 'transaction' && !!record.projectId,
  })
  const link = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc('link_payment_to_cost', {
        p_transaction: record.target.id,
        p_expense: cost || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setOpen(false)
      void client.invalidateQueries({ queryKey: ['expenses'] })
      void client.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
  if (record.direction !== 'out' || !record.projectId || record.currency !== 'AUD') return null
  if (record.target.kind === 'transaction' && record.expenseId)
    return <span className="text-xs text-ink/60">Linked to cost</span>
  if (record.target.kind === 'expense' && record.status === 'paid') return null
  return (
    <>
      <AppButton variant="ghost" onClick={() => setOpen(true)}>
        {record.target.kind === 'expense' ? 'Record payment' : 'Link to cost'}
      </AppButton>
      {open && (
        <AppDialog
          title={record.target.kind === 'expense' ? 'Record payment' : 'Link payment to cost'}
          onClose={() => setOpen(false)}
        >
          {record.target.kind === 'expense' ? (
            <MoneyEntryForm
              expenseId={record.target.id}
              projectId={record.projectId}
              defaultTitle={record.title}
              defaultCounterparty={record.counterparty}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                link.mutate()
              }}
            >
              <p className="text-sm">
                Include this payment in the project budget. It stays in Activity with its receipts.
              </p>
              <label className="grid gap-1">
                Cost
                <AppSelect value={cost} onChange={(e) => setCost(e.target.value)}>
                  <option value="">Create a cost for this payment</option>
                  {costs.data
                    ?.filter((c) => c.payment_status !== 'paid' || c.linked_payment_count)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </AppSelect>
              </label>
              {link.isError && <p role="alert">{link.error.message}</p>}
              <AppButton type="submit" disabled={link.isPending || costs.isPending}>
                Link payment
              </AppButton>
            </form>
          )}
        </AppDialog>
      )}
    </>
  )
}
