import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppSelect, FieldLabel } from '@superapp/ui'
import { ChevronRight, Pencil } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects, updateProject } from '@/lib/projects'
import { fetchExpenses, deleteExpense } from '@/lib/planning'
import { fetchWalletEntries } from '@/lib/wallet'
import { parseBudgetAmount } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import { featureError } from '@/lib/supplier-requests'
import {
  buildBudgetTree,
  budgetPath,
  fetchBudgetPlan,
  fetchBudgetAllocations,
  saveOverallBudget,
  saveFund,
  saveAllocation,
  moveProjectToFund,
  removeFund,
  removeAllocation,
  type BudgetNode,
} from '@/lib/budget-ledger'
import type { MoneyRecord } from '@/lib/money'
import { MoneyEntryForm } from './money-entry-form'
import { ReceiptPanel } from './money-activity'
import { CostPayment } from './cost-payment'

function BudgetAmount({
  node,
  onSave,
}: {
  node: BudgetNode
  onSave: (value: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const button = useRef<HTMLButtonElement>(null)
  const save = useMutation({
    mutationFn: () => onSave(value.trim() ? parseBudgetAmount(value) : node.kind === 'allocation' ? 0 : null),
    onSuccess: () => {
      setEditing(false)
      requestAnimationFrame(() => button.current?.focus())
    },
  })
  if (node.record) return <span aria-label="Individual costs do not have a separate budget">—</span>
  return editing ? (
    <form
      className="grid min-w-36 gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !save.isPending) {
          setEditing(false)
          requestAnimationFrame(() => button.current?.focus())
        }
      }}
    >
      <AppInput
        autoFocus
        aria-label={`Budget for ${node.name} (AUD)`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="!w-36 text-right"
      />
      <div className="flex gap-1 justify-end">
        <AppButton disabled={save.isPending} className="!px-2 !py-1">
          Save
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => {
            setEditing(false)
            requestAnimationFrame(() => button.current?.focus())
          }}
        >
          Cancel
        </AppButton>
      </div>
      {save.error && (
        <p role="alert" className="max-w-48 whitespace-normal text-xs text-berry">
          {featureError(save.error)}
        </p>
      )}
    </form>
  ) : (
    <button
      ref={button}
      type="button"
      className="budget-edit"
      aria-label={`Edit budget for ${node.name}`}
      onClick={() => {
        setValue(node.budget === null ? '' : String(node.budget / 100))
        save.reset()
        setEditing(true)
      }}
    >
      {node.budget === null ? 'Set budget' : formatCurrency(node.budget)}
      <Pencil size={12} aria-hidden="true" />
    </button>
  )
}

export function BudgetLedger({
  focus = 'overall',
  onFocus,
  projectContextId,
}: {
  focus?: string
  onFocus: (id: string) => void
  projectContextId?: string
}) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const owner = session?.user.id ?? ''
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const costs = useQuery({ queryKey: ['expenses', 'all'], queryFn: () => fetchExpenses() })
  const payments = useQuery({ queryKey: ['wallet'], queryFn: fetchWalletEntries })
  const plan = useQuery({ queryKey: ['budget-plan', owner], queryFn: fetchBudgetPlan, enabled: !!owner })
  const allocations = useQuery({
    queryKey: ['allocations', owner, 'all'],
    queryFn: fetchBudgetAllocations,
    enabled: !!owner,
  })
  const [form, setForm] = useState<'fund' | 'allocation' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState<MoneyRecord | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [details, setDetails] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<MoneyRecord | null>(null)
  const [remove, setRemove] = useState<BudgetNode | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousFocus = useRef(focus)
  const refresh = async () => {
    await Promise.all(
      ['budget-plan', 'allocations', 'projects', 'project-detail', 'expenses', 'wallet'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    )
  }
  const root = buildBudgetTree(
    projects.data ?? [],
    costs.data ?? [],
    payments.data ?? [],
    allocations.data ?? [],
    plan.data ?? { budget: null, funds: [], memberships: [] },
  )
  const path = budgetPath(root, focus)
  const node = path?.at(-1)
  const mutation = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => {
      await fn()
      await refresh()
    },
  })
  useEffect(() => {
    if (previousFocus.current !== focus) {
      setForm(null)
      setEditing(null)
      setDetails(null)
      setReceipt(null)
      setRemove(null)
      heading.current?.focus()
      previousFocus.current = focus
    }
  }, [focus])
  const queries = [projects, costs, payments, plan, allocations]
  const error = queries.find((q) => q.error)?.error
  if (error)
    return (
      <AppCard>
        <p role="alert">{featureError(error)}</p>
        <AppButton
          onClick={() => {
            queries.forEach((q) => void q.refetch())
          }}
        >
          Try again
        </AppButton>
      </AppCard>
    )
  if (queries.some((q) => q.isPending))
    return (
      <AppCard>
        <p role="status">Loading budget…</p>
      </AppCard>
    )
  if (!node)
    return (
      <AppCard>
        <p>This budget is unavailable.</p>
        <Link to="/app/budgets" search={{ view: undefined }} className="underline">
          All budgets
        </Link>
      </AppCard>
    )
  async function saveBudget(row: BudgetNode, value: number | null) {
    if (row.kind === 'overall') await saveOverallBudget(owner, value)
    if (row.kind === 'fund') await saveFund(owner, row.name, value, row.sourceId)
    if (row.kind === 'project') await updateProject(row.sourceId, { budgetCents: value })
    if (row.kind === 'allocation')
      await saveAllocation(owner, row.projectId!, row.name, value ?? 0, row.sourceId)
    await refresh()
  }
  function startForm(kind: 'fund' | 'allocation' | 'rename') {
    setName(kind === 'rename' ? node!.name : '')
    setAmount(kind === 'rename' && node!.budget !== null ? String(node!.budget / 100) : '')
    setForm(kind)
    mutation.reset()
  }
  const projectId = node.projectId
  const parentFund = path?.find((n) => n.kind === 'fund')
  const activeProject = path?.find((n) => n.kind === 'project')
  const leftToAssign = node.budget === null ? null : node.budget - node.assigned
  const scopedPayments =
    payments.data?.filter(
      (p) =>
        node.kind === 'overall' ||
        (p.linkedProjectId &&
          (node.kind === 'fund'
            ? node.children.some((c) => c.projectId === p.linkedProjectId)
            : p.linkedProjectId === projectId)),
    ) ?? []
  const otherCurrencies = [
    ...new Set(scopedPayments.filter((p) => p.currencyCode !== 'AUD').map((p) => p.currencyCode)),
  ]
  const income = scopedPayments.filter(
    (p) => p.direction === 'in' && ['settled', 'paid', 'pending'].includes(p.status),
  )
  const matches = (row: BudgetNode): boolean =>
    row.name.toLowerCase().includes(search.trim().toLowerCase()) || row.children.some(matches)
  const visibleRows = node.children.filter(matches)
  const go = (id: string) => {
    mutation.reset()
    onFocus(id)
  }
  function rowCells(row: BudgetNode, total = false) {
    const balance = row.budget === null ? null : row.budget - row.expected
    return (
      <>
        <th scope="row" className="budget-name-cell">
          {!total && !row.record ? (
            <button
              className="budget-drill"
              onClick={() => go(row.id)}
              aria-label={`Open ${row.name} budget`}
            >
              {row.name}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <span className="font-semibold">{total ? node!.name : row.name}</span>
          )}
          <span className="block text-xs font-normal text-ink/60 mt-1">
            {row.kind === 'overall'
              ? 'All projects · AUD'
              : row.kind === 'fund'
                ? `${row.children.length} projects`
                : row.kind === 'project'
                  ? 'Project'
                  : row.kind === 'allocation'
                    ? 'Allocation'
                    : row.kind === 'payment'
                      ? 'Separate payment'
                      : row.record?.status === 'paid'
                        ? 'Paid'
                        : row.record?.status === 'committed'
                          ? 'Committed'
                          : row.record?.status === 'part paid'
                            ? 'Part paid'
                            : 'Planned cost'}
          </span>
        </th>
        <td className="budget-money">
          <BudgetAmount key={row.id} node={row} onSave={(value) => saveBudget(row, value)} />
          {!row.record && row.budget !== null && (
            <span
              className={`block mt-1 text-xs font-normal ${row.assigned > row.budget ? 'text-berry' : 'text-ink/60'}`}
            >
              {formatCurrency(Math.abs(row.budget - row.assigned))}{' '}
              {row.assigned > row.budget ? 'overallocated' : 'unallocated'}
            </span>
          )}
        </td>
        <td className="budget-money">{formatCurrency(row.expected)}</td>
        <td className="budget-money">{formatCurrency(row.paid)}</td>
        <td className={`budget-money ${balance !== null && balance < 0 ? 'text-berry font-semibold' : ''}`}>
          {balance === null ? '—' : formatCurrency(balance)}
          {balance !== null && balance < 0 && <span className="block text-xs">Over budget</span>}
        </td>
        <td className="budget-actions">
          {row.record && (
            <AppButton
              variant="ghost"
              aria-label={`Details for ${row.name}`}
              aria-expanded={details === row.id}
              onClick={() => {
                setDetails(details === row.id ? null : row.id)
                setEditing(null)
                setReceipt(null)
                setRemove(null)
              }}
            >
              Details
            </AppButton>
          )}
        </td>
      </>
    )
  }
  return (
    <AppCard className="min-w-0 space-y-4">
      <nav aria-label="Budget location" className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
        {path?.map((part, i) => (
          <Fragment key={part.id}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {part.id === node.id ? (
              <span aria-current="page">{part.name}</span>
            ) : projectContextId && (part.kind === 'overall' || part.kind === 'fund') ? (
              <Link
                to="/app/budgets"
                search={{ view: part.kind === 'overall' ? undefined : part.id }}
                className="underline underline-offset-4"
              >
                {part.kind === 'overall' ? 'All budgets' : part.name}
              </Link>
            ) : (
              <button className="underline underline-offset-4" onClick={() => go(part.id)}>
                {part.name === 'Overall budget' ? 'All budgets' : part.name}
              </button>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
            {node.name}
          </h2>
          <p className="mt-1 text-xs text-ink/60">AUD · All-time · Private to you</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {node.kind === 'overall' && (
            <AppButton variant="secondary" onClick={() => startForm('fund')}>
              Add group
            </AppButton>
          )}
          {(node.kind === 'fund' || node.kind === 'allocation') && (
            <AppButton variant="secondary" onClick={() => startForm('rename')}>
              Edit {node.kind === 'fund' ? 'group' : 'allocation'}
            </AppButton>
          )}
          {node.kind === 'project' && (
            <AppButton variant="secondary" onClick={() => startForm('allocation')}>
              Add allocation
            </AppButton>
          )}
          {projectId && (
            <Link
              to="/app/marketplace/requests"
              search={{ projectId }}
              className="ui-button ui-button--secondary"
            >
              Request a quote
            </Link>
          )}
          {(projectId || node.kind === 'overall') && (
            <AppButton
              onClick={() => {
                setEditing('new')
                setDetails(null)
                setReceipt(null)
              }}
            >
              Add entry
            </AppButton>
          )}
        </div>
      </div>
      {node.kind === 'overall' && (
        <p className="text-sm text-ink/70">
          Set your overall budget, then assign money to groups or projects. Open a row to see its breakdown.
        </p>
      )}
      {node.kind === 'fund' && (
        <label className="flex flex-wrap gap-2 items-center text-sm">
          Add project to group
          <AppSelect
            aria-label="Add project to group"
            className="!w-auto max-w-full"
            value=""
            disabled={mutation.isPending}
            onChange={(e) => {
              const id = e.target.value
              if (id) mutation.mutate(() => moveProjectToFund(id, node.sourceId))
            }}
          >
            <option value="">Choose a project</option>
            {(projects.data ?? [])
              .filter((p) => p.isOwner && !node.children.some((c) => c.sourceId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {plan.data?.memberships.find((m) => m.project_id === p.id)?.fund_id
                    ? ' (move from another group)'
                    : ''}
                </option>
              ))}
          </AppSelect>
        </label>
      )}
      {node.kind === 'project' && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            Group
            <AppSelect
              aria-label="Project budget group"
              className="!w-auto max-w-full"
              value={parentFund?.sourceId ?? ''}
              disabled={mutation.isPending}
              onChange={(e) => {
                const id = e.target.value || null
                mutation.mutate(() => moveProjectToFund(node.sourceId, id))
              }}
            >
              <option value="">No group</option>
              {plan.data?.funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </AppSelect>
          </label>
          <Link to="/app/projects/$projectId" params={{ projectId: node.sourceId }} className="underline">
            Open project
          </Link>
        </div>
      )}
      {form && (
        <form
          className="flex flex-wrap items-end gap-3 border-y border-border py-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate(async () => {
              const value = amount.trim() ? parseBudgetAmount(amount) : null
              if (form === 'fund' || (form === 'rename' && node.kind === 'fund'))
                await saveFund(owner, name, value, form === 'rename' ? node.sourceId : undefined)
              else
                await saveAllocation(
                  owner,
                  projectId!,
                  name,
                  value ?? 0,
                  form === 'rename' ? node.sourceId : undefined,
                )
              setForm(null)
            })
          }}
        >
          <FieldLabel>
            Name
            <AppInput
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FieldLabel>
          <FieldLabel>
            Budget (AUD)
            <AppInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FieldLabel>
          <AppButton disabled={mutation.isPending}>
            Save {form === 'fund' || node.kind === 'fund' ? 'group' : 'allocation'}
          </AppButton>
          <AppButton
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => setForm(null)}
          >
            Cancel
          </AppButton>
          {form === 'rename' && (
            <AppButton
              type="button"
              variant="ghost"
              disabled={mutation.isPending || (node.kind === 'allocation' && node.children.length > 0)}
              title={
                node.kind === 'allocation' && node.children.length
                  ? 'Move the costs to another allocation before removing this one.'
                  : undefined
              }
              onClick={() => setRemove(node)}
            >
              Remove {node.kind === 'fund' ? 'group' : 'allocation'}
            </AppButton>
          )}
        </form>
      )}
      {mutation.error && (
        <p role="alert" className="text-sm text-berry">
          {featureError(mutation.error)}
        </p>
      )}
      {remove && !remove.record && (
        <div className="border border-border p-3 space-y-2 text-sm">
          <p>
            {remove.kind === 'fund'
              ? 'Remove this group? Its projects and their budgets will stay in All budgets.'
              : 'Remove this empty allocation? Allocations linked to supplier requests must be kept.'}
          </p>
          <AppButton
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(async () => {
                if (remove.kind === 'fund') await removeFund(remove.sourceId)
                else await removeAllocation(remove.sourceId)
                setRemove(null)
                setForm(null)
                onFocus(remove.kind === 'fund' ? 'overall' : `project:${remove.projectId}`)
              })
            }
          >
            Confirm removal
          </AppButton>
          <AppButton variant="ghost" disabled={mutation.isPending} onClick={() => setRemove(null)}>
            Cancel
          </AppButton>
        </div>
      )}
      {editing === 'new' && (
        <section aria-label="Add money entry" className="border-y border-border py-4">
          <MoneyEntryForm
            projectId={projectId}
            defaultAllocationId={node.kind === 'allocation' ? node.sourceId : undefined}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </section>
      )}
      {(node.children.length > 5 || search) && (
        <FieldLabel>
          Find a project or cost
          <AppInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this budget"
          />
        </FieldLabel>
      )}
      {search && (
        <p className="text-xs text-ink/65">Showing matching rows. Totals include the whole budget.</p>
      )}
      <p className="text-xs text-ink/60 sm:hidden">Swipe the table to see all amounts.</p>
      <div
        role="region"
        aria-label="Budget breakdown"
        tabIndex={0}
        className="ui-ledger-shell budget-workspace"
      >
        <table className="ui-budget-table min-w-[720px]">
          <caption className="sr-only">
            {node.name}: budget, expected costs, paid and left after costs in Australian dollars
          </caption>
          <thead>
            <tr>
              <th scope="col" className="budget-name-cell">
                {node.kind === 'overall'
                  ? 'Groups & projects'
                  : node.kind === 'fund'
                    ? 'Projects'
                    : node.kind === 'project'
                      ? 'Allocations & costs'
                      : 'Costs'}
              </th>
              {['Budget', 'Expected', 'Paid', 'Left after costs'].map((label) => (
                <th scope="col" className="budget-money" key={label}>
                  {label}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="budget-total">{rowCells(node, true)}</tr>
            {visibleRows.map((row) => (
              <Fragment key={row.id}>
                <tr>{rowCells(row)}</tr>
                {details === row.id && row.record && (
                  <tr>
                    <td colSpan={6} className="!p-0">
                      <div className="budget-inline-panel space-y-3 p-4">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{row.name}</h3>
                            <p className="text-sm text-ink/70">
                              {formatCurrency(Math.max(0, row.expected - row.paid))} to pay
                              {row.record.counterparty ? ` · ${row.record.counterparty}` : ''}
                            </p>
                          </div>
                          <AppButton
                            variant="ghost"
                            onClick={() => {
                              setDetails(null)
                              setEditing(null)
                              setReceipt(null)
                            }}
                          >
                            Close details
                          </AppButton>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <CostPayment record={row.record} />
                          {row.record.editable && (
                            <AppButton
                              variant="secondary"
                              onClick={() => {
                                setEditing(row.record!)
                                setReceipt(null)
                              }}
                            >
                              Edit
                            </AppButton>
                          )}
                          <AppButton
                            variant="secondary"
                            onClick={() => {
                              setReceipt(row.record!)
                              setEditing(null)
                            }}
                          >
                            Receipts
                          </AppButton>
                          {row.kind === 'cost' && (
                            <AppButton
                              variant="ghost"
                              disabled={!!row.record.hasPayments || mutation.isPending}
                              onClick={() => setRemove(row)}
                            >
                              Delete cost
                            </AppButton>
                          )}
                        </div>
                        {row.record.hasPayments && (
                          <p className="text-xs text-ink/60">
                            Payments and their receipts are listed in Activity.
                          </p>
                        )}
                        {remove?.id === row.id && (
                          <div className="space-y-2">
                            <p>Delete this cost? Attached receipts or quotes may prevent deletion.</p>
                            <AppButton
                              disabled={mutation.isPending}
                              onClick={() =>
                                mutation.mutate(async () => {
                                  await deleteExpense(row.sourceId)
                                  setRemove(null)
                                  setDetails(null)
                                })
                              }
                            >
                              Confirm delete
                            </AppButton>
                            <AppButton variant="ghost" onClick={() => setRemove(null)}>
                              Cancel
                            </AppButton>
                          </div>
                        )}
                        {editing && editing !== 'new' && editing.id === row.record.id && (
                          <MoneyEntryForm
                            record={editing}
                            projectId={projectId}
                            onSaved={() => setEditing(null)}
                            onCancel={() => setEditing(null)}
                          />
                        )}
                        {receipt?.id === row.record.id && (
                          <ReceiptPanel record={receipt} onClose={() => setReceipt(null)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {node.children.length > 0 && !visibleRows.length && (
        <p className="text-sm">
          No matching rows.{' '}
          <button className="underline" onClick={() => setSearch('')}>
            Clear search
          </button>
        </p>
      )}
      {!node.children.length && (
        <p className="text-sm text-ink/70">
          {node.kind === 'overall'
            ? 'No projects yet. Create a project to start allocating your budget.'
            : node.kind === 'fund'
              ? 'Choose a project above to include it in this group.'
              : 'No costs yet. Add an entry, or set aside money in an allocation.'}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p className={leftToAssign !== null && leftToAssign < 0 ? 'text-berry' : 'text-ink/70'}>
          {formatCurrency(node.assigned)} assigned
          {leftToAssign !== null
            ? ` · ${formatCurrency(Math.abs(leftToAssign))} ${leftToAssign < 0 ? 'overallocated' : 'left to allocate'}`
            : ' · Set a budget to see what is left to allocate'}
        </p>
        <Link
          to="/app/wallet"
          search={{
            projectId: activeProject?.sourceId,
            fundId: node.kind === 'fund' ? node.sourceId : undefined,
            scope: node.kind === 'overall' ? 'all' : undefined,
          }}
          className="underline"
        >
          {activeProject
            ? 'Project activity & receipts'
            : node.kind === 'fund'
              ? 'Group activity & receipts'
              : 'All activity & receipts'}
        </Link>
      </div>
      <details className="text-xs text-ink/65">
        <summary className="cursor-pointer min-h-8 py-2">How these totals work</summary>
        <p className="max-w-3xl leading-relaxed">
          Budget is the money you set aside. Unallocated is what remains after budgets below this level and
          costs outside those budgets. If a lower level goes over its allocation, the extra is also reserved
          here. Expected uses actual costs when recorded, otherwise estimates, and includes unpaid costs. Paid
          counts linked payments once. Left after costs is budget minus expected costs; it is not your bank
          balance. Income does not automatically increase your budget.
        </p>
      </details>
      {otherCurrencies.length > 0 && (
        <p className="text-sm">
          {otherCurrencies.join(', ')} records are kept separately in Activity and excluded from these AUD
          totals.
        </p>
      )}
      {node.kind !== 'allocation' && income.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer min-h-10 py-2 font-semibold">Income</summary>
          <div className="ui-ledger-shell">
            <table className="ui-budget-table">
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col" className="budget-money">
                    Received
                  </th>
                  <th scope="col" className="budget-money">
                    Expected
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...new Set(income.map((p) => p.currencyCode))].map((currency) => (
                  <tr key={currency}>
                    <th scope="row">{currency}</th>
                    <td className="budget-money">
                      {formatCurrency(
                        income
                          .filter(
                            (p) => p.currencyCode === currency && ['paid', 'settled'].includes(p.status),
                          )
                          .reduce((n, p) => n + p.totalCents, 0),
                        currency,
                      )}
                    </td>
                    <td className="budget-money">
                      {formatCurrency(
                        income
                          .filter((p) => p.currencyCode === currency && p.status === 'pending')
                          .reduce((n, p) => n + p.totalCents, 0),
                        currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </AppCard>
  )
}
