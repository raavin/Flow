import { expect, it } from 'vitest'
import { buildBudgetTree, budgetPath, type BudgetPlan } from './budget-ledger'
import type { Expense } from './planning'
import type { fetchWalletEntries } from './wallet'
const projects = [{ id: 'p1', title: 'Party', isOwner: true, budgetCents: 50000 }]
const allocations = [{ id: 'a1', project_id: 'p1', name: 'Food', limit_cents: 30000 }]
const plan: BudgetPlan = {
  budget: 100000,
  funds: [{ id: 'f1', name: 'Personal', budget_cents: 60000 }],
  memberships: [{ project_id: 'p1', fund_id: 'f1' }],
}
const cost: Expense = {
  id: 'c1',
  project_id: 'p1',
  title: 'Catering',
  category: 'Food',
  estimate_cents: 25000,
  actual_cents: 20000,
  paid_cents: 10000,
  linked_payment_count: 1,
  payment_status: 'pending',
  allocation_id: 'a1',
  linked_listing_id: null,
}
function payment(
  changes: Record<string, unknown> = {},
): Awaited<ReturnType<typeof fetchWalletEntries>>[number] {
  return {
    id: 't1',
    expenseId: null,
    linkedProjectId: 'p1',
    description: 'Supplies',
    direction: 'out',
    currencyCode: 'AUD',
    status: 'settled',
    totalCents: 2000,
    sourceKind: 'manual',
    occurredAt: '2026-11-28',
    ...changes,
  } as Awaited<ReturnType<typeof fetchWalletEntries>>[number]
}
it('rolls up the same expected and paid totals at every level without adding child budgets to parent budgets', () => {
  const root = buildBudgetTree(
    projects,
    [cost],
    [payment({ expenseId: 'c1', totalCents: 10000 })],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ budget: 100000, assigned: 60000, expected: 20000, paid: 10000 })
  expect(budgetPath(root, 'cost:c1')?.map((n) => n.name)).toEqual([
    'Overall budget',
    'Personal',
    'Party',
    'Food',
    'Catering',
  ])
  for (const id of ['fund:f1', 'project:p1', 'allocation:a1'])
    expect(budgetPath(root, id)?.at(-1)).toMatchObject({ expected: 20000, paid: 10000 })
})
it('includes unlinked outgoing payments once and excludes other currencies, income and cancelled records', () => {
  const root = buildBudgetTree(
    projects,
    [cost],
    [
      payment(),
      payment({ id: 'usd', currencyCode: 'USD' }),
      payment({ id: 'income', direction: 'in' }),
      payment({ id: 'cancelled', status: 'cancelled' }),
      payment({ id: 'refund', status: 'refunded' }),
    ],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ expected: 22000, paid: 12000 })
  expect(budgetPath(root, 'project:p1')?.at(-1)?.assigned).toBe(32000)
  expect(budgetPath(root, 'payment:t1')).toHaveLength(4)
})
it('keeps overall spending outside projects visible and does not include other owners projects', () => {
  const root = buildBudgetTree(
    [...projects, { id: 'p2', title: 'Shared', isOwner: false, budgetCents: 99999 }],
    [cost, { ...cost, id: 'foreign', project_id: 'p2' }],
    [payment({ linkedProjectId: null })],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ expected: 22000, paid: 12000, assigned: 62000 })
  expect(budgetPath(root, 'project:p2')).toBeNull()
})
it('preserves explicit zero, carries child reservations through unset budgets and exposes overallocations', () => {
  const root = buildBudgetTree(projects, [cost], [], allocations, {
    ...plan,
    budget: 0,
    funds: [{ ...plan.funds[0], budget_cents: null }],
  })
  expect(root).toMatchObject({ budget: 0, assigned: 50000 })
  expect(root.budget! - root.assigned).toBe(-50000)
})
it('does not lose costs outside allocations or projects whose group was removed', () => {
  const root = buildBudgetTree(projects, [{ ...cost, allocation_id: 'removed' }], [], [], {
    ...plan,
    funds: [],
  })
  expect(budgetPath(root, 'cost:c1')?.map((n) => n.id)).toEqual(['overall', 'project:p1', 'cost:c1'])
  expect(root).toMatchObject({ expected: 20000, paid: 10000, assigned: 50000 })
})
it('counts pending payments as expected but not paid', () => {
  const root = buildBudgetTree(projects, [], [payment({ status: 'pending' })], [], plan)
  expect(root).toMatchObject({ expected: 2000, paid: 0 })
})
it('does not hide overallocated projects inside an underfunded group', () => {
  const root = buildBudgetTree(projects, [], [], allocations, {
    ...plan,
    funds: [{ ...plan.funds[0], budget_cents: 10000 }],
  })
  expect(root.assigned).toBe(50000)
  expect(budgetPath(root, 'fund:f1')?.at(-1)).toMatchObject({ budget: 10000, assigned: 50000 })
})
