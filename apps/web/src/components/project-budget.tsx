import { CostPayment } from './cost-payment'
import { BudgetAllocations } from './budget-allocations'
import { MoneyEntryForm } from './money-entry-form'
import { ReceiptPanel } from './money-activity'
import { moneyRecords, type MoneyRecord } from '@/lib/money'
import { featureError, fetchAllocations } from '@/lib/supplier-requests'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, FieldLabel, SectionHeading } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail, updateProject } from '@/lib/projects'
import { deleteExpense, fetchExpenses } from '@/lib/planning'
import { parseBudgetAmount, summarizeCosts } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import { ProjectShell } from './project-shell'

export function ProjectBudget({ projectId }: { projectId: string }) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const project = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const allocations = useQuery({
    queryKey: ['allocations', session?.user.id, projectId],
    queryFn: () => fetchAllocations(projectId),
    enabled: !!session,
  })
  const costs = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: () => fetchExpenses(projectId),
  })
  const [receiptsFor, setReceiptsFor] = useState<string | null>(null)
  const [editing, setEditing] = useState<MoneyRecord | 'new' | null>(null)
  const [formVersion, setFormVersion] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['expenses'] })
    void client.invalidateQueries({ queryKey: ['projects'] })
    void client.invalidateQueries({ queryKey: ['project-detail', projectId] })
  }
  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      setDeleting(null)
      refresh()
    },
  })
  const saveTarget = useMutation({
    mutationFn: () =>
      updateProject(projectId, {
        budgetCents: target?.trim() ? parseBudgetAmount(target) : null,
      }),
    onSuccess: () => {
      setTarget(null)
      refresh()
    },
  })
  const totals = summarizeCosts(costs.data ?? [])
  const budget = project.data?.project.budgetCents ?? null
  const error = remove.error || saveTarget.error || costs.error || project.error
  const loading = costs.isPending || project.isPending
  const records = moneyRecords(costs.data ?? [], [])
  const receipt = records.find((r) => r.target.id === receiptsFor)
  if (project.data && project.data.ownerId !== session?.user.id)
    return (
      <ProjectShell projectId={projectId} activeTab="budget">
        <AppCard>The project budget is private to its owner.</AppCard>
      </ProjectShell>
    )
  return (
    <div className="space-y-4 min-w-0">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/app/budgets" className="underline font-semibold">
          Money overview
        </Link>
        <span aria-hidden="true">/</span>
        <span>{project.data?.project.title ?? 'Project'} budget</span>
      </nav>
      <ProjectShell projectId={projectId} activeTab="budget">
        <div className="min-w-0 space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading
              eyebrow="AUD"
              title="Budget"
              action={
                <Link to="/app/wallet" search={{ projectId }} className="text-sm underline">
                  Project activity
                </Link>
              }
            />
            <p className="text-sm text-ink/70">
              Plan costs, track spending and keep receipts. Your financial records are private.
            </p>
            {loading ? (
              <p role="status">Loading budget…</p>
            ) : !costs.isError && !project.isError ? (
              <>
                <div
                  className="ui-ledger-shell relative"
                  role="region"
                  aria-label="Budget summary"
                  tabIndex={0}
                >
                  <table className="ui-budget-table min-w-[520px]">
                    <caption className="sr-only">Project budget summary in Australian dollars</caption>
                    <thead>
                      <tr>
                        {['Budget', 'Forecast', 'Paid', 'Budget left'].map((label) => (
                          <th key={label} scope="col" className="budget-money">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="budget-money">
                          {budget === null ? 'Not set' : formatCurrency(budget)}
                        </td>
                        <td className="budget-money">{formatCurrency(totals.forecast)}</td>
                        <td className="budget-money">{formatCurrency(totals.paid)}</td>
                        <td
                          className={`budget-money ${budget !== null && totals.forecast > budget ? 'text-berry font-semibold' : ''}`}
                        >
                          {budget === null ? (
                            <span aria-label="Budget not set">—</span>
                          ) : (
                            <>
                              {formatCurrency(budget - totals.forecast)}
                              {totals.forecast > budget ? (
                                <span className="block text-xs">Over budget</span>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink/65">
                  To pay: {formatCurrency(totals.remaining)}. Forecast uses actual costs where recorded,
                  otherwise estimates. Budget left is the limit minus the forecast.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <FieldLabel>
                    Budget limit (AUD)
                    <AppInput
                      aria-label="Budget limit (AUD)"
                      inputMode="decimal"
                      placeholder="No limit set"
                      value={target ?? (budget === null ? '' : String(budget / 100))}
                      onChange={(e) => setTarget(e.target.value)}
                    />
                  </FieldLabel>
                  <AppButton
                    variant="secondary"
                    disabled={target === null || saveTarget.isPending}
                    onClick={() => saveTarget.mutate()}
                  >
                    {saveTarget.isPending ? 'Saving…' : 'Save limit'}
                  </AppButton>
                  <span className="text-xs text-ink/70">Leave blank to remove the limit.</span>
                </div>
              </>
            ) : null}
          </AppCard>
          {error ? (
            <div role="alert" className="ui-panel">
              {featureError(error)}
            </div>
          ) : null}
          <AppCard className="min-w-0 space-y-4">
            <SectionHeading
              title="Costs"
              action={
                <div className="flex flex-wrap gap-2 items-center">
                  <Link
                    to="/app/marketplace/requests"
                    search={{ projectId }}
                    className="ui-button ui-button--secondary"
                  >
                    Request a quote
                  </Link>
                  <AppButton
                    onClick={() => {
                      setEditing('new')
                      setFormVersion((v) => v + 1)
                    }}
                  >
                    Add entry
                  </AppButton>
                </div>
              }
            />
            {editing ? (
              <section aria-label="Money entry" className="border-y border-border py-4 space-y-3">
                <SectionHeading title={editing === 'new' ? 'Add entry' : 'Edit entry'} />
                <MoneyEntryForm
                  key={editing === 'new' ? `new-${formVersion}` : editing.id}
                  projectId={projectId}
                  record={editing === 'new' ? undefined : editing}
                  onSaved={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </section>
            ) : null}
            {loading ? (
              <p role="status">Loading costs…</p>
            ) : !costs.isError && !costs.data?.length ? (
              <p className="text-sm text-ink/70">No costs yet. Add an entry to start planning.</p>
            ) : costs.data?.length ? (
              <div
                className="ui-ledger-shell relative"
                role="region"
                aria-label="Project costs table"
                tabIndex={0}
              >
                <table className="ui-budget-table min-w-[840px]">
                  <caption className="sr-only">Project costs in Australian dollars</caption>
                  <thead>
                    <tr>
                      <th scope="col">Cost</th>
                      <th scope="col">Allocation</th>
                      <th scope="col" className="budget-money">
                        Estimate
                      </th>
                      <th scope="col" className="budget-money">
                        Actual
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.data.map((cost) => (
                      <tr
                        key={cost.id}
                        className={
                          editing && editing !== 'new' && editing.target.id === cost.id ? 'bg-teal/10' : ''
                        }
                      >
                        <th scope="row" className="min-w-44 font-semibold">
                          {cost.title}
                          <p className="mt-1 text-xs font-normal text-ink/65">{cost.category}</p>
                        </th>
                        <td className="text-ink/70">
                          {cost.allocation_id
                            ? (allocations.data?.find((a) => a.id === cost.allocation_id)?.name ?? '—')
                            : 'Unallocated'}
                        </td>
                        <td className="budget-money">{formatCurrency(cost.estimate_cents)}</td>
                        <td className="budget-money">
                          {cost.payment_status === 'paid' || cost.actual_cents > 0 ? (
                            formatCurrency(cost.actual_cents)
                          ) : (
                            <span aria-label="Actual cost not recorded">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {cost.linked_payment_count
                            ? `${formatCurrency(cost.paid_cents ?? 0)} paid`
                            : cost.payment_status === 'paid'
                              ? 'Paid'
                              : cost.payment_status === 'pending'
                                ? 'Committed'
                                : 'Planned'}
                        </td>
                        <td className="budget-actions">
                          <CostPayment record={records.find((r) => r.target.id === cost.id)!} />
                          <AppButton
                            variant="ghost"
                            disabled={remove.isPending}
                            onClick={() => setEditing(records.find((r) => r.target.id === cost.id) ?? null)}
                          >
                            Edit
                          </AppButton>
                          {session ? (
                            <AppButton
                              variant="ghost"
                              aria-expanded={receiptsFor === cost.id}
                              onClick={() => setReceiptsFor(receiptsFor === cost.id ? null : cost.id)}
                            >
                              Receipts
                            </AppButton>
                          ) : null}
                          {deleting === cost.id ? (
                            <>
                              <AppButton
                                variant="secondary"
                                disabled={remove.isPending}
                                onClick={() => remove.mutate(cost.id)}
                              >
                                Confirm delete
                              </AppButton>
                              <AppButton variant="ghost" onClick={() => setDeleting(null)}>
                                Cancel
                              </AppButton>
                            </>
                          ) : (
                            <AppButton
                              variant="ghost"
                              disabled={remove.isPending || !!cost.linked_payment_count}
                              onClick={() => setDeleting(cost.id)}
                              title={
                                cost.linked_payment_count
                                  ? 'Remove the linked payments before deleting this cost'
                                  : undefined
                              }
                            >
                              Delete
                            </AppButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={2}>
                        Total
                      </th>
                      <td className="budget-money">{formatCurrency(totals.estimated)}</td>
                      <td className="budget-money">{formatCurrency(totals.actual)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </AppCard>
          {receipt ? <ReceiptPanel record={receipt} onClose={() => setReceiptsFor(null)} /> : null}
          {session ? (
            <BudgetAllocations
              projectId={projectId}
              ownerId={session.user.id}
              budget={budget}
              costs={costs.data ?? []}
            />
          ) : null}
        </div>
      </ProjectShell>
    </div>
  )
}
