import { BudgetAllocations } from './budget-allocations'
import { ExpenseReceipts } from './expense-receipts'
import { featureError, fetchAllocations } from '@/lib/supplier-requests'
import { Fragment, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppSelect, FieldLabel, SectionHeading } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail, updateProject } from '@/lib/projects'
import { createExpense, updateExpense, deleteExpense, fetchExpenses } from '@/lib/planning'
import { parseBudgetAmount, summarizeCosts } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import { ProjectShell } from './project-shell'

const emptyDraft = { allocationId: '', title: '', category: 'General', estimate: '', actual: '', status: 'unpaid' as 'unpaid' | 'pending' | 'paid' }

export function ProjectBudget({ projectId }: { projectId: string }) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const project = useQuery({ queryKey: ['project-detail', projectId], queryFn: () => fetchProjectDetail(projectId) })
  const allocations = useQuery({ queryKey: ['allocations', session?.user.id, projectId], queryFn: () => fetchAllocations(projectId), enabled: !!session })
  const costs = useQuery({ queryKey: ['expenses', projectId], queryFn: () => fetchExpenses(projectId) })
  const costNameRef = useRef<HTMLInputElement>(null)
  const [receiptsFor, setReceiptsFor] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['expenses'] })
    void client.invalidateQueries({ queryKey: ['projects'] })
    void client.invalidateQueries({ queryKey: ['project-detail', projectId] })
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!session || !draft.title.trim()) throw new Error('Give this cost a name.')
      if (draft.status === 'paid' && !draft.actual.trim()) throw new Error('Enter the actual amount paid, including zero if there was no cost.')
      const input = { ...(allocations.data ? {allocationId: draft.allocationId || null} : {}), title: draft.title.trim(), category: draft.category.trim() || 'General', estimateCents: parseBudgetAmount(draft.estimate), actualCents: parseBudgetAmount(draft.actual), paymentStatus: draft.status }
      if (editing) await updateExpense(editing, input)
      else await createExpense({ ...input, ownerId: session.user.id, projectId })
    },
    onSuccess: () => { setDraft(emptyDraft); setEditing(null); refresh() },
  })
  const remove = useMutation({ mutationFn: deleteExpense, onSuccess: () => { setDeleting(null); refresh() } })
  const saveTarget = useMutation({
    mutationFn: () => updateProject(projectId, { budgetCents: target?.trim() ? parseBudgetAmount(target) : null }),
    onSuccess: () => { setTarget(null); refresh() },
  })
  const totals = summarizeCosts(costs.data ?? [])
  const budget = project.data?.project.budgetCents ?? null
  const error = save.error || remove.error || saveTarget.error || costs.error || project.error
  const loading = costs.isPending || project.isPending
  return (
    <ProjectShell projectId={projectId} activeTab="budget">
      <div className="min-w-0 space-y-4">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="AUD" title="Project budget" action={<Link to="/app/budgets" className="text-sm underline">All project budgets</Link>} />
          <p className="text-sm text-ink/70">Track estimates and spending. Add receipts to saved costs. These records are private.</p>
          {loading ? <p role="status">Loading budget…</p> : !costs.isError && !project.isError ? <>
            <div className="ui-ledger-shell relative" role="region" aria-label="Budget summary" tabIndex={0}>
              <table className="ui-budget-table min-w-[520px]">
                <caption className="sr-only">Project budget summary in Australian dollars</caption>
                <thead><tr>{['Budget', 'Forecast', 'Paid', 'Budget left'].map(label => <th key={label} scope="col" className="budget-money">{label}</th>)}</tr></thead>
                <tbody><tr>
                  <td className="budget-money">{budget === null ? 'Not set' : formatCurrency(budget)}</td>
                  <td className="budget-money">{formatCurrency(totals.forecast)}</td>
                  <td className="budget-money">{formatCurrency(totals.paid)}</td>
                  <td className={`budget-money ${budget !== null && totals.forecast > budget ? 'text-berry font-semibold' : ''}`}>{budget === null ? <span aria-label="Budget not set">—</span> : <>{formatCurrency(budget - totals.forecast)}{totals.forecast > budget ? <span className="block text-xs">Over budget</span> : null}</>}</td>
                </tr></tbody>
              </table>
            </div>
            <p className="text-xs text-ink/65">To pay: {formatCurrency(totals.remaining)}. Forecast uses actual costs where recorded, otherwise estimates. Budget left is the limit minus the forecast.</p>
            <div className="flex flex-wrap items-end gap-3">
              <FieldLabel>Budget limit (AUD)<AppInput aria-label="Budget limit (AUD)" inputMode="decimal" placeholder="No limit set" value={target ?? (budget === null ? '' : String(budget / 100))} onChange={e => setTarget(e.target.value)} /></FieldLabel>
              <AppButton variant="secondary" disabled={target === null || saveTarget.isPending} onClick={() => saveTarget.mutate()}>{saveTarget.isPending ? 'Saving…' : 'Save limit'}</AppButton>
              <span className="text-xs text-ink/70">Leave blank to remove the limit.</span>
            </div>
          </> : null}
        </AppCard>
        {error ? <div role="alert" className="ui-panel">{featureError(error)}</div> : null}
        <AppCard className="min-w-0 space-y-4">
          <SectionHeading title="Costs" action={<AppButton variant="secondary" onClick={() => { setEditing(null); setDraft(emptyDraft); save.reset(); costNameRef.current?.focus() }}>New cost</AppButton>} />
          {loading ? <p role="status">Loading costs…</p> : !costs.isError && !costs.data?.length ? <p className="text-sm text-ink/70">No costs yet. Add an estimate below.</p> : costs.data?.length ? <div className="ui-ledger-shell relative" role="region" aria-label="Project costs table" tabIndex={0}>
            <table className="ui-budget-table min-w-[840px]">
              <caption className="sr-only">Project costs in Australian dollars</caption>
              <thead><tr>
                <th scope="col">Cost</th><th scope="col">Allocation</th>
                <th scope="col" className="budget-money">Estimate</th><th scope="col" className="budget-money">Actual</th>
                <th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{costs.data.map(cost => <Fragment key={cost.id}>
                <tr className={editing === cost.id ? 'bg-teal/10' : ''}>
                  <th scope="row" className="min-w-44 font-semibold">{cost.title}<p className="mt-1 text-xs font-normal text-ink/65">{cost.category}</p></th>
                  <td className="text-ink/70">{cost.allocation_id ? allocations.data?.find(a => a.id === cost.allocation_id)?.name ?? '—' : 'Unallocated'}</td>
                  <td className="budget-money">{formatCurrency(cost.estimate_cents)}</td>
                  <td className="budget-money">{formatCurrency(cost.actual_cents)}</td>
                  <td className="whitespace-nowrap">{cost.payment_status === 'paid' ? 'Paid' : cost.payment_status === 'pending' ? 'Committed' : 'Planned'}</td>
                  <td className="budget-actions">
                    <AppButton variant="ghost" disabled={save.isPending || remove.isPending} onClick={() => {
                      setEditing(cost.id)
                      setDraft({ allocationId: cost.allocation_id ?? '', title: cost.title, category: cost.category, estimate: String(cost.estimate_cents / 100), actual: String(cost.actual_cents / 100), status: cost.payment_status })
                      save.reset()
                      costNameRef.current?.focus()
                    }}>Edit cost</AppButton>
                    {session ? <AppButton variant="ghost" aria-expanded={receiptsFor === cost.id} aria-controls={`receipts-${cost.id}`} onClick={() => setReceiptsFor(receiptsFor === cost.id ? null : cost.id)}>{receiptsFor === cost.id ? 'Hide receipts' : 'Receipts'}</AppButton> : null}
                    {deleting === cost.id ? <><AppButton variant="secondary" disabled={remove.isPending || editing === cost.id} onClick={() => remove.mutate(cost.id)}>Confirm delete</AppButton><AppButton variant="ghost" onClick={() => setDeleting(null)}>Keep cost</AppButton></> : <AppButton variant="ghost" disabled={editing === cost.id || save.isPending} onClick={() => setDeleting(cost.id)}>Delete</AppButton>}
                  </td>
                </tr>
                {session && receiptsFor === cost.id ? <tr><td colSpan={6} id={`receipts-${cost.id}`}>
                  <p className="mb-2 font-semibold">Receipts for {cost.title}</p>
                  <ExpenseReceipts expenseId={cost.id} ownerId={session.user.id} />
                </td></tr> : null}
              </Fragment>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className="budget-money">{formatCurrency(totals.estimated)}</td><td className="budget-money">{formatCurrency(totals.actual)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div> : null}
          <Link to="/app/marketplace/requests" search={{ projectId }} className="inline-block text-sm underline">Get quotes</Link>
        </AppCard>
          <AppCard className="space-y-4">
            <SectionHeading title={editing ? 'Update cost' : 'Add cost'} />
            <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" onSubmit={e => { e.preventDefault(); save.mutate() }}>
              <FieldLabel>Cost name<AppInput ref={costNameRef} required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Gift, venue, supplies…" /></FieldLabel>
              {allocations.data ? <FieldLabel>Budget allocation<AppSelect value={draft.allocationId} onChange={e=>setDraft({...draft,allocationId:e.target.value})}><option value="">Unallocated</option>{allocations.data.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</AppSelect></FieldLabel> : null}
              <FieldLabel>Category<AppInput value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></FieldLabel>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-1">
                <FieldLabel>Estimate (AUD)<AppInput inputMode="decimal" value={draft.estimate} onChange={e => setDraft({ ...draft, estimate: e.target.value })} placeholder="0.00" /></FieldLabel>
                <FieldLabel>Actual cost (AUD)<AppInput inputMode="decimal" value={draft.actual} onChange={e => setDraft({ ...draft, actual: e.target.value })} placeholder="Not recorded yet" /></FieldLabel>
              </div>
              <FieldLabel>Status<AppSelect value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}><option value="unpaid">Planned / unpaid</option><option value="pending">Committed / awaiting payment</option><option value="paid">Paid</option></AppSelect></FieldLabel>
              {draft.status === 'paid' ? <p className="text-sm text-ink/70">Enter the full amount paid in Actual cost, including any fees.</p> : null}
              <div className="flex items-end gap-2"><AppButton type="submit" disabled={!session || !draft.title.trim() || save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add cost'}</AppButton>{editing ? <AppButton type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(emptyDraft); save.reset() }}>Cancel</AppButton> : null}</div>
            </form>
          </AppCard>
        {session ? <BudgetAllocations projectId={projectId} ownerId={session.user.id} budget={budget} costs={costs.data ?? []} /> : null}
      </div>
    </ProjectShell>
  )
}
