import { useRef, useState } from 'react'
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
  const nameRef = useRef<HTMLInputElement>(null)
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
    <AppCard className="min-w-0 space-y-3">
      <SectionHeading

        title="Allocations"
      />
      <p className="text-sm">
        Set aside amounts for food, venue or other parts of the project.
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
          {query.data.length ? <div className="ui-ledger-shell relative" role="region" aria-label="Allocations table" tabIndex={0}>
            <table className="ui-budget-table min-w-[640px]">
              <caption className="sr-only">Budget allocations in Australian dollars</caption>
              <thead><tr><th scope="col">Allocation</th><th scope="col" className="budget-money">Limit</th><th scope="col" className="budget-money">Forecast</th><th scope="col" className="budget-money">Paid</th><th scope="col" className="budget-money">Left</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{query.data.map((a) => {
                const total = summarizeCosts(costs.filter((c) => c.allocation_id === a.id))
                const balance = a.limit_cents - total.forecast
                return <tr key={a.id}>
                  <th scope="row" className="font-semibold">{a.name}</th>
                  <td className="budget-money">{formatCurrency(a.limit_cents)}</td>
                  <td className="budget-money">{formatCurrency(total.forecast)}</td>
                  <td className="budget-money">{formatCurrency(total.paid)}</td>
                  <td className={`budget-money ${balance < 0 ? 'text-berry font-semibold' : ''}`}>{formatCurrency(balance)}{balance < 0 ? <span className="block text-xs">Over allocation</span> : null}</td>
                  <td className="budget-actions"><AppButton variant="ghost" aria-label={`Edit ${a.name} allocation`} onClick={() => {
                    setEditing(a.id)
                    setName(a.name)
                    setAmount(String(a.limit_cents / 100))
                    nameRef.current?.focus()
                  }}>Edit</AppButton></td>
                </tr>
              })}</tbody>
            </table>
          </div> : <p className="text-sm text-ink/65">No allocations yet.</p>}
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
            <FieldLabel className="min-w-0 max-w-full">
              Name
              <AppInput
                ref={nameRef}
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel className="min-w-0 max-w-full">
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
