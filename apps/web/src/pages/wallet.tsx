import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  FieldLabel,
  SectionHeading,
} from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { MoneyViews } from '@/components/section-views'
import { MoneyActivityTable } from '@/components/money-activity'
import { MoneyEntryForm } from '@/components/money-entry-form'
import { MoneyProjectFilter, useMoneyScope } from '@/components/money-scope'
import { QueryFeedback } from '@/components/request-feedback'
import { fetchProjects } from '@/lib/projects'
import { deleteExpense, fetchExpenses } from '@/lib/planning'
import { deleteWalletEntry, fetchWalletEntries } from '@/lib/wallet'
import { filterMoneyRecords, moneyRecords, type MoneyRecord } from '@/lib/money'

export function WalletPage() {
  const { projectId, highlight, filter } = walletRoute.useSearch()
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
  const [selected, setSelected] = useMoneyScope(projectId)
  const [status, setStatus] = useState(filter ?? 'all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<MoneyRecord | 'new' | null>(null)
  const [formVersion, setFormVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const records = moneyRecords(costs.data ?? [], entries.data ?? [])
  const rows = filterMoneyRecords(records, selected, status, search)
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
  const highlighted = highlight
    ? records.find((r) => r.target.id === highlight)
    : null
  return (
    <div className="min-w-0 space-y-4">
      <MoneyViews active="records" />
      <AppCard className="space-y-2">
        <SectionHeading title="Activity" />
        <p className="text-sm text-ink/65">
          Project costs, payments and income. Open Receipts on any entry to add
          a photo or PDF.
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
              <AppSelect
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All entries</option>
                <option value="unpaid">Unpaid and planned</option>
                <option value="paid">Paid and received</option>
                <option value="refunded">Refunded</option>
              </AppSelect>
            </FieldLabel>
            <MoneyProjectFilter
              projects={projects.data ?? []}
              selected={selected}
              onChange={setSelected}
            />
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
          <section
            aria-label="Money entry"
            className="border-y border-border py-4 space-y-3"
          >
            <SectionHeading
              title={editor === 'new' ? 'Add entry' : 'Edit entry'}
            />
            <MoneyEntryForm
              key={editor === 'new' ? `new-${formVersion}` : editor.id}
              projectId={
                editor === 'new' && selected.length === 1
                  ? selected[0]
                  : undefined
              }
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
        {remove.error ? (
          <p role="alert">
            Could not delete this entry. Remove its receipts first, then try
            again.
          </p>
        ) : null}
        {highlighted ? (
          <p className="text-sm">Linked record: {highlighted.title}</p>
        ) : null}
        {entries.isSuccess && costs.isSuccess ? (
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
          (r) =>
            r.target.kind === 'transaction' &&
            r.direction === 'out' &&
            r.projectId,
        ) ? (
          <p className="text-xs text-ink/65">
            Older project payments remain separate from budget costs. Avoid
            recording them twice.
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
  ): { highlight?: string; projectId?: string; filter?: string } => ({
    highlight:
      typeof search.highlight === 'string' ? search.highlight : undefined,
    projectId:
      typeof search.projectId === 'string' ? search.projectId : undefined,
    filter:
      typeof search.filter === 'string' &&
      ['all', 'unpaid', 'paid', 'refunded'].includes(search.filter)
        ? search.filter
        : undefined,
  }),
})
