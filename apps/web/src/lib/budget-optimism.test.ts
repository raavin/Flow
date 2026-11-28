import { afterEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { queryClient } from './query-client'
import { optimisticWrites } from './optimistic'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), eq: vi.fn() }))
vi.mock('./supplier-requests', () => ({
  database: () => ({ from: () => ({ insert: mocks.insert, update: mocks.update }) }),
}))
import { saveAllocation, buildBudgetTree } from './budget-ledger'

afterEach(() => {
  optimisticWrites.reset()
  queryClient.clear()
  vi.clearAllMocks()
})

it('updates allocation totals immediately and restores them after a rejected save', async () => {
  const key = ['allocations', 'owner', 'all']
  queryClient.setQueryData(key, [{ id: 'a', project_id: 'p', name: 'Food', limit_cents: 10000 }])
  let finish!: (result: { error: Error | null }) => void
  mocks.update.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const work = saveAllocation('owner', 'p', 'Food', 25000, 'a')
  const rejected = expect(work).rejects.toThrow('Denied')
  const tree = () =>
    buildBudgetTree(
      [{ id: 'p', title: 'Party', isOwner: true, budgetCents: 50000 }],
      [],
      [],
      queryClient.getQueryData(key)!,
      { budget: 100000, funds: [], memberships: [] },
    )
  await waitFor(() => expect(tree().children[0].assigned).toBe(25000))
  finish({ error: new Error('Denied') })
  await rejected
  expect(tree().children[0].assigned).toBe(10000)
})

it('adds the same client ID only to the relevant project and releases pending state on success', async () => {
  queryClient.setQueryData(['allocations', 'owner', 'all'], [])
  queryClient.setQueryData(['allocations', 'owner', 'p'], [])
  queryClient.setQueryData(['allocations', 'owner', 'other'], [])
  let finish!: (result: { error: null }) => void
  mocks.insert.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const work = saveAllocation('owner', 'p', 'Food', 25000)
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
  const row = {
    id: mocks.insert.mock.calls[0][0].id,
    project_id: 'p',
    owner_id: 'owner',
    name: 'Food',
    limit_cents: 25000,
    _pending: true,
  }
  expect(queryClient.getQueryData(['allocations', 'owner', 'all'])).toEqual([row])
  expect(queryClient.getQueryData(['allocations', 'owner', 'p'])).toEqual([row])
  expect(queryClient.getQueryData(['allocations', 'owner', 'other'])).toEqual([])
  finish({ error: null })
  await work
  expect(queryClient.getQueryData(['allocations', 'owner', 'p'])).toEqual([{ ...row, _pending: false }])
})
