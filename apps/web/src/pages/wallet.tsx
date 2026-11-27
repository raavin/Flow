import { useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppSelect, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { MoneyViews } from '@/components/section-views'
import { MoneyActivityTable } from '@/components/money-activity'
import { MoneyEntryForm } from '@/components/money-entry-form'
import { MoneyProjectFilter, useMoneyScope } from '@/components/money-scope'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchBudgetPlan } from '@/lib/budget-ledger'
import { QueryFeedback } from '@/components/request-feedback'
import { fetchProjects } from '@/lib/projects'
import { deleteExpense, fetchExpenses } from '@/lib/planning'
import { deleteWalletEntry, fetchWalletEntries } from '@/lib/wallet'
import { filterMoneyRecords, moneyRecords, type MoneyRecord } from '@/lib/money'

export function WalletPage() {
  const { projectId, fundId, scope, highlight, filter } = walletRoute.useSearch()
  const { session } = useAppStore()
  const navigate = walletRoute.useNavigate()
  const plan = useQuery({
    queryKey: ['budget-plan', session?.user.id],
    queryFn: fetchBudgetPlan,
    enabled: !!fundId && !!session,
  })
  const fund = plan.data?.funds.find((f) => f.id === fundId)
  const client = useQueryClient()
  const entries = useQuery({
    queryKey: ['wallet'],
    queryFn: fetchWalletEntries,
  })
  const costs = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => fetchExpenses(),
  })
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [savedSelection, saveSelection] = useMoneyScope()
  const selected = projectId
    ? [projectId]
    : fundId
      ? (plan.data?.memberships.filter((m) => m.fund_id === fundId).map((m) => m.project_id) ?? [])
      : scope === 'all'
        ? []
        : savedSelection
  function setSelected(ids: string[]) {
    saveSelection(ids)
    void navigate({ search: { highlight, filter } })
  }
  const budgetView = projectId ? `project:${projectId}` : fundId ? `fund:${fundId}` : undefined
  const [status, setStatus] = useState(filter ?? 'all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<MoneyRecord | 'new' | null>(null)
  const [formVersion, setFormVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const records = moneyRecords(costs.data ?? [], entries.data ?? [])
  const rows = fundId && !selected.length ? [] : filterMoneyRecords(records, selected, status, search)
  const remove = useMutation({
    mutationFn: async (row: MoneyRecord) => {
      if (row.target.kind === 'expense') await deleteExpense(row.target.id)
      else await deleteWalletEntry(row.target.id)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['expenses'] })
      void client.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
  const highlighted = highlight ? records.find((r) => r.target.id === highlight) : null
  return (
    <div className="min-w-0 space-y-4">
      <MoneyViews active="records" budgetView={budgetView} />
      <AppCard className="space-y-2">
        <SectionHeading
          title={fund ? `${fund.name} activity` : 'Activity'}
          action={
            budgetView ? (
              <Link to="/app/budgets" search={{ view: budgetView }} className="text-sm underline">
                View budget
              </Link>
            ) : undefined
          }
        />
        <p className="text-sm text-ink/65">
          Project costs, payments and income. Open Receipts on any entry to add a photo or PDF.
        </p>
      </AppCard>
      <AppCard className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <FieldLabel>
              Search
              <AppInput
                placeholder="Description or person"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel>
              Status
              <AppSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All entries</option>
                <option value="unpaid">Unpaid and planned</option>
                <option value="paid">Paid and received</option>
                <option value="refunded">Refunded</option>
              </AppSelect>
            </FieldLabel>
            <MoneyProjectFilter label={fundId ? (fund?.name ?? 'Group projects') : undefined} projects={projects.data ?? []} selected={selected} onChange={setSelected} />
          </div>
          <AppButton
            onClick={() => {
              setEditor('new')
              setFormVersion((v) => v + 1)
              setNotice('')
            }}
          >
            Add entry
          </AppButton>
        </div>
        {editor ? (
          <section aria-label="Money entry" className="border-y border-border py-4 space-y-3">
            <SectionHeading title={editor === 'new' ? 'Add entry' : 'Edit entry'} />
            <MoneyEntryForm
              key={editor === 'new' ? `new-${formVersion}` : editor.id}
              projectId={editor === 'new' && selected.length === 1 ? selected[0] : undefined}
              record={editor === 'new' ? undefined : editor}
              onSaved={() => {
                setEditor(null)
                setNotice('Entry saved.')
              }}
              onCancel={() => setEditor(null)}
            />
          </section>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        <QueryFeedback query={entries} />
        <QueryFeedback query={costs} />
        <QueryFeedback query={projects} />
        {fundId && <QueryFeedback query={plan} />}
        {fundId && plan.isSuccess && !fund && <p role="alert">This budget group is unavailable.</p>}
        {remove.error ? (
          <p role="alert">Could not delete this entry. Remove its receipts first, then try again.</p>
        ) : null}
        {highlighted ? <p className="text-sm">Linked record: {highlighted.title}</p> : null}
        {entries.isSuccess && costs.isSuccess && (!fundId || (plan.isSuccess && !!fund)) ? (
          <MoneyActivityTable
            rows={rows}
            projects={projects.data ?? []}
            onEdit={(row) => {
              setEditor(row)
              setNotice('')
            }}
            onDelete={(row) => remove.mutateAsync(row)}
            busy={remove.isPending}
          />
        ) : null}
        {rows.some(
          (r) => r.target.kind === 'transaction' && r.direction === 'out' && !r.expenseId && r.projectId,
        ) ? (
          <p className="text-xs text-ink/65">
            Separate AUD payments are included in budgets. Use Link to cost when a payment belongs to an
            existing cost.
          </p>
        ) : null}
      </AppCard>
    </div>
  )
}
export const walletRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'wallet',
  component: WalletPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { highlight?: string; projectId?: string; fundId?: string; scope?: 'all'; filter?: string } => ({
    fundId: typeof search.fundId === 'string' ? search.fundId : undefined,
    scope: search.scope === 'all' ? 'all' : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
    filter:
      typeof search.filter === 'string' && ['all', 'unpaid', 'paid', 'refunded'].includes(search.filter)
        ? search.filter
        : undefined,
  }),
})
