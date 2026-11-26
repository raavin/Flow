import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppCard,
  AppButton,
  AppInput,
  FieldLabel,
  SectionHeading,
} from '@superapp/ui'
import {
  database,
  featureError,
  fetchAllocations,
} from '@/lib/supplier-requests'
import { parseBudgetAmount, summarizeCosts } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import { fetchExpenses } from '@/lib/planning'
export function BudgetAllocations({
  projectId,
  ownerId,
  budget,
  costs,
}: {
  projectId: string
  ownerId: string
  budget: number | null
  costs: Awaited<ReturnType<typeof fetchExpenses>>
}) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['allocations', ownerId, projectId],
    queryFn: () => fetchAllocations(projectId),
  })
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        limit_cents: parseBudgetAmount(amount),
      }
      if (!payload.name) throw new Error('Name the allocation.')
      const q = editing
        ? database()
            .from('project_budget_allocations')
            .update(payload)
            .eq('id', editing)
        : database()
            .from('project_budget_allocations')
            .insert({ ...payload, owner_id: ownerId, project_id: projectId })
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => {
      setName('')
      setAmount('')
      setEditing(null)
      void client.invalidateQueries({ queryKey: ['allocations'] })
    },
  })
  const allocated = (query.data ?? []).reduce(
    (sum, a) => sum + a.limit_cents,
    0,
  )
  return (
    <AppCard className="space-y-3">
      <SectionHeading

        title="Allocations"
      />
      <p className="text-sm">
        Divide the project budget between things such as venue, food and
        supplies. Allocations reserve room in your plan; they are not extra
        costs.
      </p>
      {query.isPending ? (
        <p>Loading allocations…</p>
      ) : query.data ? (
        <>
          <p>
            Allocated {formatCurrency(allocated)}
            {budget !== null
              ? ` · ${allocated > budget ? 'Overallocated' : 'Unallocated'} ${formatCurrency(Math.abs(budget - allocated))}`
              : ''}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {query.data.map((a) => {
              const total = summarizeCosts(
                costs.filter((c) => c.allocation_id === a.id),
              )
              return (
                <div key={a.id} className="ui-panel">
                  <strong>{a.name}</strong>
                  <p>
                    Limit {formatCurrency(a.limit_cents)} · Forecast{' '}
                    {formatCurrency(total.forecast)} · Paid{' '}
                    {formatCurrency(total.paid)}
                  </p>
                  <p>
                    {total.forecast > a.limit_cents
                      ? 'Over allocation'
                      : 'Remaining'}{' '}
                    {formatCurrency(Math.abs(a.limit_cents - total.forecast))}
                  </p>
                  <AppButton
                    variant="ghost"
                    onClick={() => {
                      setEditing(a.id)
                      setName(a.name)
                      setAmount(String(a.limit_cents / 100))
                    }}
                  >
                    Edit allocation
                  </AppButton>
                </div>
              )
            })}
          </div>
          <p className="text-sm">
            Costs without an allocation:{' '}
            {formatCurrency(
              summarizeCosts(costs.filter((c) => !c.allocation_id)).forecast,
            )}
          </p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <FieldLabel>
              Name
              <AppInput
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel>
              Allocation (AUD)
              <AppInput
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FieldLabel>
            <AppButton disabled={save.isPending}>
              {editing ? 'Save allocation' : 'Add allocation'}
            </AppButton>
            {editing ? (
              <AppButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null)
                  setName('')
                  setAmount('')
                }}
              >
                Cancel
              </AppButton>
            ) : null}
          </form>
        </>
      ) : null}
      {query.error || save.error ? (
        <p role="alert">{featureError(query.error || save.error)}</p>
      ) : null}
    </AppCard>
  )
}
