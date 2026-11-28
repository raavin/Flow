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
  expect(root).toMatchObject({ expected: 2000, actual: 2000, unpaid: 2000, paid: 0 })
})

it('separates the original budget, recorded costs, forecast and unpaid bills at every level', () => {
  const root = buildBudgetTree(
    [{ ...projects[0], budgetCents: 100000 }],
    [
      { ...cost, estimate_cents: 60000, actual_cents: 50000, paid_cents: 20000 },
      {
        ...cost,
        id: 'flowers',
        estimate_cents: 30000,
        actual_cents: 0,
        paid_cents: undefined,
        linked_payment_count: 0,
        payment_status: 'unpaid',
      },
    ],
    [payment({ expenseId: 'c1', totalCents: 20000 })],
    [{ ...allocations[0], limit_cents: 100000 }],
    plan,
  )
  for (const id of ['overall', 'fund:f1', 'project:p1', 'allocation:a1']) {
    expect(budgetPath(root, id)?.at(-1)).toMatchObject({
      actual: 50000,
      expected: 80000,
      paid: 20000,
      unpaid: 30000,
      estimatedCount: 1,
    })
  }
  const allocation = budgetPath(root, 'allocation:a1')!.at(-1)!
  expect(allocation.budget! - allocation.expected).toBe(20000)
  expect(allocation.budget! - allocation.assigned).toBe(10000)
  expect(budgetPath(root, 'cost:c1')?.at(-1)?.budget).toBe(60000)
})

it('does not treat an unfinished estimate as an unpaid bill even when part has been paid', () => {
  const root = buildBudgetTree(
    projects,
    [{ ...cost, actual_cents: 0, estimate_cents: 60000, paid_cents: 20000 }],
    [],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ actual: 0, expected: 60000, paid: 20000, unpaid: 0, estimatedCount: 1 })
})

it('does not let an overpayment on one cost hide another unpaid bill', () => {
  const root = buildBudgetTree(
    projects,
    [
      { ...cost, id: 'overpaid', actual_cents: 10000, paid_cents: 15000 },
      { ...cost, id: 'unpaid', actual_cents: 20000, paid_cents: 0 },
    ],
    [],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ actual: 30000, expected: 35000, paid: 15000, unpaid: 20000 })
})

it('keeps a completed zero-cost item distinct from an unknown actual cost', () => {
  const root = buildBudgetTree(
    projects,
    [{ ...cost, actual_cents: 0, paid_cents: undefined, linked_payment_count: 0, payment_status: 'paid' }],
    [],
    allocations,
    plan,
  )
  expect(root).toMatchObject({ actual: 0, expected: 0, paid: 0, unpaid: 0, estimatedCount: 0 })
})
it('does not hide overallocated projects inside an underfunded group', () => {
  const root = buildBudgetTree(projects, [], [], allocations, {
    ...plan,
    funds: [{ ...plan.funds[0], budget_cents: 10000 }],
  })
  expect(root.assigned).toBe(50000)
  expect(budgetPath(root, 'fund:f1')?.at(-1)).toMatchObject({ budget: 10000, assigned: 50000 })
})
