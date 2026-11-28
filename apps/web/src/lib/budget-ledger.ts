import { summarizeCosts, assertBudgetAmount } from './budget'
import { optimisticWrite, editRows, insertRow, removeRows, isObject, isPendingRecord } from './optimistic'
import { database, type Allocation } from './supplier-requests'
import { moneyRecords, type MoneyRecord } from './money'
import type { Expense } from './planning'
import type { fetchWalletEntries } from './wallet'

export type BudgetFund = { id: string; name: string; budget_cents: number | null }
export type BudgetPlan = {
  budget: number | null
  funds: BudgetFund[]
  memberships: { project_id: string; fund_id: string | null }[]
}
export type BudgetProject = { id: string; title: string; budgetCents: number | null; isOwner?: boolean }
export type BudgetNode = {
  id: string
  kind: 'overall' | 'fund' | 'project' | 'allocation' | 'cost' | 'payment'
  sourceId: string
  name: string
  pending?: boolean
  budget: number | null
  expected: number
  actual: number
  unpaid: number
  estimatedCount: number
  paid: number
  assigned: number
  children: BudgetNode[]
  projectId?: string
  record?: MoneyRecord
}

export async function fetchBudgetPlan(): Promise<BudgetPlan> {
  const db = database()
  const [settings, funds, memberships] = await Promise.all([
    db.from('money_budget_settings').select('budget_cents').maybeSingle(),
    db.from('budget_funds').select('id,name,budget_cents').order('name'),
    db.from('project_budget_limits').select('project_id,fund_id'),
  ])
  for (const result of [settings, funds, memberships]) if (result.error) throw result.error
  return {
    budget: settings.data?.budget_cents ?? null,
    funds: funds.data ?? [],
    memberships: memberships.data ?? [],
  }
}
export async function fetchBudgetAllocations(): Promise<Allocation[]> {
  const { data, error } = await database().from('project_budget_allocations').select('*').order('name')
  if (error) throw error
  return data ?? []
}
export async function saveOverallBudget(owner: string, amount: number | null) {
  if (amount !== null) assertBudgetAmount(amount)
  return optimisticWrite(
    `overall-budget:${owner}`,
    [{ keys: ['budget-plan'], apply: (data) => (isObject(data) ? { ...data, budget: amount } : data) }],
    async () => {
      const { error } = await database()
        .from('money_budget_settings')
        .upsert({ owner_id: owner, budget_cents: amount })
      if (error) throw error
    },
  )
}
export async function saveFund(owner: string, name: string, amount: number | null, id?: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('Enter a group name of 1–100 characters.')
  if (amount !== null) assertBudgetAmount(amount)
  const payload = { name: name.trim(), budget_cents: amount }
  const fundId = id ?? crypto.randomUUID()
  return optimisticWrite(
    `fund:${fundId}`,
    [
      {
        keys: ['budget-plan'],
        apply: (data) => {
          if (!isObject(data) || !Array.isArray(data.funds)) return data
          const funds = data.funds.some((f) => isObject(f) && f.id === fundId)
            ? data.funds.map((f) => (isObject(f) && f.id === fundId ? { ...f, ...payload } : f))
            : [...data.funds, { id: fundId, ...payload, _pending: true }]
          return { ...data, funds }
        },
      },
    ],
    async () => {
      const query = id
        ? database().from('budget_funds').update(payload).eq('id', id)
        : database()
            .from('budget_funds')
            .insert({ id: fundId, ...payload, owner_id: owner })
      const { error } = await query
      if (error) throw error
    },
  )
}
export async function saveAllocation(
  owner: string,
  project: string,
  name: string,
  amount: number,
  id?: string,
) {
  if (!name.trim() || name.trim().length > 100)
    throw new Error('Enter an allocation name of 1–100 characters.')
  assertBudgetAmount(amount)
  const payload = { name: name.trim(), limit_cents: amount }
  const allocationId = id ?? crypto.randomUUID()
  const change = id
    ? editRows(['allocations'], id, payload)
    : insertRow(
        ['allocations'],
        { id: allocationId, ...payload, project_id: project, owner_id: owner, _pending: true },
        (key) => key.includes(project) || key.includes('all'),
      )
  return optimisticWrite(`allocation:${allocationId}`, [change], async () => {
    const query = id
      ? database().from('project_budget_allocations').update(payload).eq('id', id)
      : database()
          .from('project_budget_allocations')
          .insert({ id: allocationId, ...payload, owner_id: owner, project_id: project })
    const { error } = await query
    if (error) throw error
  })
}
export async function moveProjectToFund(project: string, fund: string | null) {
  // Partial upsert deliberately preserves the existing budget amount.
  return optimisticWrite(
    `project:${project}`,
    [
      {
        keys: ['budget-plan'],
        apply: (data) => {
          if (!isObject(data) || !Array.isArray(data.memberships)) return data
          return {
            ...data,
            memberships: [
              ...data.memberships.filter((m) => !isObject(m) || m.project_id !== project),
              { project_id: project, fund_id: fund },
            ],
          }
        },
      },
    ],
    async () => {
      const { error } = await database()
        .from('project_budget_limits')
        .upsert({ project_id: project, fund_id: fund }, { onConflict: 'project_id' })
      if (error) throw error
    },
  )
}
export async function removeFund(id: string) {
  return optimisticWrite(`fund:${id}`, [removeRows(['budget-plan'], id)], async () => {
    const { error } = await database().from('budget_funds').delete().eq('id', id)
    if (error) throw error
  })
}
export async function removeAllocation(id: string) {
  return optimisticWrite(`allocation:${id}`, [removeRows(['allocations'], id)], async () => {
    const { error } = await database().from('project_budget_allocations').delete().eq('id', id)
    if (error) throw error
  })
}

// A parent reserves its children's budgets, not their budgets plus their costs.
// Pass through oversubscribed or unset intermediate budgets so commitments cannot
// disappear at higher levels and make the same funds look available twice.
export function reserved(node: BudgetNode): number {
  return Math.max(node.budget ?? 0, node.children.length ? node.assigned : node.expected)
}
function branch(
  node: Omit<BudgetNode, 'expected' | 'actual' | 'unpaid' | 'estimatedCount' | 'paid' | 'assigned'>,
): BudgetNode {
  return {
    ...node,
    expected: node.children.reduce((n, c) => n + c.expected, 0),
    actual: node.children.reduce((n, c) => n + c.actual, 0),
    unpaid: node.children.reduce((n, c) => n + c.unpaid, 0),
    estimatedCount: node.children.reduce((n, c) => n + c.estimatedCount, 0),
    paid: node.children.reduce((n, c) => n + c.paid, 0),
    assigned: node.children.reduce((n, c) => n + reserved(c), 0),
  }
}
export function buildBudgetTree(
  projects: BudgetProject[],
  costs: Expense[],
  payments: Awaited<ReturnType<typeof fetchWalletEntries>>,
  allocations: Allocation[],
  plan: BudgetPlan,
): BudgetNode {
  const owned = projects.filter((p) => p.isOwner)
  const ownedIds = new Set(owned.map((p) => p.id))
  const records = moneyRecords(costs, payments)
  const leaves: BudgetNode[] = costs
    .filter((c) => ownedIds.has(c.project_id))
    .map((c) => {
      const totals = summarizeCosts([c])
      return {
        id: `cost:${c.id}`,
        kind: 'cost',
        sourceId: c.id,
        name: c.title,
        pending: isPendingRecord(c),
        budget: c.estimate_cents,
        expected: totals.forecast,
        actual: c.actual_cents,
        unpaid: Math.max(0, c.actual_cents - totals.paid),
        estimatedCount: c.actual_cents === 0 && c.payment_status !== 'paid' ? 1 : 0,
        paid: totals.paid,
        assigned: 0,
        children: [],
        projectId: c.project_id,
        record: records.find((r) => r.id === `expense:${c.id}`),
      }
    })
  // Linked payments already contribute to their cost's paid total. Keep unlinked
  // outgoing payments visible, but never mix currencies or count cancelled entries.
  leaves.push(
    ...records
      .filter(
        (r) =>
          r.target.kind === 'transaction' &&
          !r.expenseId &&
          r.direction === 'out' &&
          r.currency === 'AUD' &&
          ['paid', 'pending'].includes(r.status) &&
          (!r.projectId || ownedIds.has(r.projectId)),
      )
      .map((r) => ({
        id: `payment:${r.target.id}`,
        kind: 'payment' as const,
        sourceId: r.target.id,
        name: r.title,
        pending: isPendingRecord(payments.find((p) => p.id === r.target.id)),
        budget: null,
        expected: r.amount,
        actual: r.amount,
        unpaid: r.status === 'paid' ? 0 : r.amount,
        estimatedCount: 0,
        paid: r.status === 'paid' ? r.amount : 0,
        assigned: 0,
        children: [],
        projectId: r.projectId ?? undefined,
        record: r,
      })),
  )
  const projectNodes = owned.map((p) => {
    const projectLeaves = leaves.filter((c) => c.projectId === p.id)
    const projectAllocations = allocations.filter((a) => a.project_id === p.id)
    const allocationIds = new Set(projectAllocations.map((a) => a.id))
    return branch({
      id: `project:${p.id}`,
      kind: 'project',
      sourceId: p.id,
      name: p.title,
      pending: isPendingRecord(p),
      budget: p.budgetCents,
      projectId: p.id,
      children: [
        ...projectAllocations.map((a) =>
          branch({
            id: `allocation:${a.id}`,
            kind: 'allocation',
            sourceId: a.id,
            name: a.name,
            pending: isPendingRecord(a),
            budget: a.limit_cents,
            projectId: p.id,
            children: projectLeaves.filter((c) => c.record?.allocationId === a.id),
          }),
        ),
        ...projectLeaves.filter((c) => !c.record?.allocationId || !allocationIds.has(c.record.allocationId)),
      ],
    })
  })
  const fundFor = new Map(plan.memberships.map((m) => [m.project_id, m.fund_id]))
  const fundIds = new Set(plan.funds.map((f) => f.id))
  return branch({
    id: 'overall',
    kind: 'overall',
    sourceId: 'overall',
    name: 'Overall budget',
    budget: plan.budget,
    children: [
      ...plan.funds.map((f) =>
        branch({
          id: `fund:${f.id}`,
          kind: 'fund',
          sourceId: f.id,
          name: f.name,
          pending: isPendingRecord(f),
          budget: f.budget_cents,
          children: projectNodes.filter((p) => fundFor.get(p.sourceId) === f.id),
        }),
      ),
      ...projectNodes.filter((p) => !fundIds.has(fundFor.get(p.sourceId) ?? '')),
      ...leaves.filter((c) => !c.projectId),
    ],
  })
}
export function budgetPath(root: BudgetNode, id: string): BudgetNode[] | null {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const path = budgetPath(child, id)
    if (path) return [root, ...path]
  }
  return null
}
