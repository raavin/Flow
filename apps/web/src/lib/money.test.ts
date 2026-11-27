import { expect, it } from 'vitest'
import { moneyRecords, filterMoneyRecords, type MoneyRecord } from './money'
import type { Expense } from './planning'
const base: Expense = {
  id: 'cost',
  project_id: 'party',
  title: 'Cake',
  category: 'Food',
  estimate_cents: 5000,
  actual_cents: 0,
  payment_status: 'paid',
  allocation_id: null,
  linked_listing_id: null,
  incurred_on: '2026-11-27',
}
it('retains a paid zero cost rather than substituting its estimate', () => {
  expect(moneyRecords([base], [])[0]).toMatchObject({
    amount: 0,
    status: 'paid',
    target: { kind: 'expense', id: 'cost' },
  })
  expect(
    moneyRecords([{ ...base, payment_status: 'pending' }], [])[0],
  ).toMatchObject({ amount: 5000, status: 'committed' })
})
it('filters a selected group of projects, unpaid states and descriptions together', () => {
  const rows = moneyRecords(
    [
      base,
      {
        ...base,
        id: 'launch',
        project_id: 'business',
        title: 'Equipment',
        payment_status: 'pending',
      },
      {
        ...base,
        id: 'gifts',
        project_id: 'gifts',
        title: 'Equipment',
        payment_status: 'unpaid',
      },
    ],
    [],
  )
  expect(
    filterMoneyRecords(rows, ['party', 'business'], 'unpaid', 'equip').map(
      (r) => r.target.id,
    ),
  ).toEqual(['launch'])
  expect(
    filterMoneyRecords(rows, [], 'paid', '').map((r) => r.target.id),
  ).toEqual(['cost'])
})
it('keeps distinct financial records and currencies instead of silently treating them as one expense', () => {
  const payment = {
    id: 'cost',
    linkedProjectId: 'party',
    description: 'Cake',
    counterpartyLabel: 'Shop',
    occurredAt: '2026-11-27T12:00:00Z',
    totalCents: 5000,
    currencyCode: 'USD',
    direction: 'out',
    status: 'settled',
    transactionRole: 'manual',
  } as Parameters<typeof moneyRecords>[1][number]
  const rows: MoneyRecord[] = moneyRecords([base], [payment])
  expect(rows).toHaveLength(2)
  expect(new Set(rows.map((r) => r.id)).size).toBe(2)
  expect(rows.find((r) => r.target.kind === 'transaction')).toMatchObject({
    currency: 'USD',
    status: 'paid',
  })
})
