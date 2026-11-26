import { BudgetAllocations } from './budget-allocations'
import { ExpenseReceipts } from './expense-receipts'
import { featureError, fetchAllocations } from '@/lib/supplier-requests'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, FieldLabel, SectionHeading } from '@superapp/ui'
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
      <div className="space-y-4">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="AUD" title="Project budget" action={<Link to="/app/budgets" className="text-sm underline">All project budgets</Link>} />
          <p className="text-sm text-ink/70">Track estimates and spending. Add receipts to saved costs. These records are private.</p>
          {loading ? <p role="status">Loading budget…</p> : !costs.isError && !project.isError ? <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Budget limit', budget === null ? 'Not set' : formatCurrency(budget)],
                ['Forecast total', formatCurrency(totals.forecast)],
                ['Paid', formatCurrency(totals.paid)],
                [budget !== null && totals.forecast > budget ? 'Over budget' : 'Remaining', budget === null ? 'Set a limit below' : formatCurrency(Math.abs(budget - totals.forecast))],
              ].map(([label, value]) => <AppPanel key={label}><p className="text-sm text-ink/70">{label}</p><p className="text-xl font-bold">{value}</p></AppPanel>)}
            </div>
            <p className="text-sm text-ink/70">Estimated {formatCurrency(totals.estimated)} · Actual costs {formatCurrency(totals.actual)} · Still to cover {formatCurrency(totals.remaining)}. Forecast uses the actual amount when recorded, otherwise the estimate; paid items use their actual amount.</p>
            <div className="flex flex-wrap items-end gap-3">
              <FieldLabel>Budget limit (AUD)<AppInput aria-label="Budget limit (AUD)" inputMode="decimal" placeholder="No limit set" value={target ?? (budget === null ? '' : String(budget / 100))} onChange={e => setTarget(e.target.value)} /></FieldLabel>
              <AppButton variant="secondary" disabled={target === null || saveTarget.isPending} onClick={() => saveTarget.mutate()}>{saveTarget.isPending ? 'Saving…' : 'Save limit'}</AppButton>
              <span className="text-xs text-ink/70">Leave blank to remove the limit.</span>
            </div>
          </> : null}
        </AppCard>
        {error ? <div role="alert" className="ui-panel">{featureError(error)}</div> : null}
        {session ? <BudgetAllocations projectId={projectId} ownerId={session.user.id} budget={budget} costs={costs.data ?? []}/> : null}
        <Link to="/app/marketplace/requests" search={{projectId}} className="inline-block underline">Get quotes</Link>
        <div className="grid gap-4 lg:grid-cols-2">
          <AppCard className="space-y-4">
            <SectionHeading title={editing ? 'Update cost' : 'Add cost'} />
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate() }}>
              <FieldLabel>Cost name<AppInput required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Gift, venue, supplies…" /></FieldLabel>
              {allocations.data ? <FieldLabel>Budget allocation<AppSelect value={draft.allocationId} onChange={e=>setDraft({...draft,allocationId:e.target.value})}><option value="">Unallocated</option>{allocations.data.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</AppSelect></FieldLabel> : null}
              <FieldLabel>Category<AppInput value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel>Estimate (AUD)<AppInput inputMode="decimal" value={draft.estimate} onChange={e => setDraft({ ...draft, estimate: e.target.value })} placeholder="0.00" /></FieldLabel>
                <FieldLabel>Actual cost (AUD)<AppInput inputMode="decimal" value={draft.actual} onChange={e => setDraft({ ...draft, actual: e.target.value })} placeholder="Not recorded yet" /></FieldLabel>
              </div>
              <FieldLabel>Status<AppSelect value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}><option value="unpaid">Planned / unpaid</option><option value="pending">Committed / awaiting payment</option><option value="paid">Paid</option></AppSelect></FieldLabel>
              {draft.status === 'paid' ? <p className="text-sm text-ink/70">Enter the full amount paid in Actual cost, including any fees.</p> : null}
              <div className="flex gap-2"><AppButton type="submit" disabled={!session || !draft.title.trim() || save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add cost'}</AppButton>{editing ? <AppButton type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(emptyDraft); save.reset() }}>Cancel</AppButton> : null}</div>
            </form>
          </AppCard>
          <AppCard className="space-y-4">
            <SectionHeading title="Costs" />
            {!loading && !costs.isError && !costs.data?.length ? <p className="text-sm text-ink/70">No costs yet. Add an estimate to get started.</p> : null}
            {(costs.data ?? []).map(cost => <AppPanel key={cost.id}>
              <p className="font-bold">{cost.title}</p><p className="text-sm text-ink/70">{cost.category} · {cost.payment_status === 'paid' ? 'Paid' : cost.payment_status === 'pending' ? 'Committed' : 'Planned'}</p>
              <p className="mt-2 text-sm">Estimate {formatCurrency(cost.estimate_cents)} · Actual {formatCurrency(cost.actual_cents)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AppButton variant="ghost" disabled={save.isPending || remove.isPending} onClick={() => { setEditing(cost.id); setDraft({ allocationId: cost.allocation_id ?? '', title: cost.title, category: cost.category, estimate: String(cost.estimate_cents / 100), actual: String(cost.actual_cents / 100), status: cost.payment_status }); save.reset() }}>Edit cost</AppButton>
                {deleting === cost.id ? <><AppButton variant="secondary" disabled={remove.isPending || editing === cost.id} onClick={() => remove.mutate(cost.id)}>Confirm delete</AppButton><AppButton variant="ghost" onClick={() => setDeleting(null)}>Keep cost</AppButton></> : <AppButton variant="ghost" disabled={editing === cost.id || save.isPending} onClick={() => setDeleting(cost.id)}>Delete</AppButton>}
              </div>
              {session ? <ExpenseReceipts expenseId={cost.id} ownerId={session.user.id}/> : null}
            </AppPanel>)}
          </AppCard>
        </div>
      </div>
    </ProjectShell>
  )
}
