import '../test-setup'
import { useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BudgetLedger } from './budget-ledger'
import { moveProjectToFund, saveAllocation, saveFund, saveOverallBudget } from '@/lib/budget-ledger'
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/hooks/useAppStore', () => ({ useAppStore: () => ({ session: { user: { id: 'owner' } } }) }))
vi.mock('@/lib/projects', () => ({
  fetchProjects: async () => [{ id: 'party', title: 'Party', isOwner: true, budgetCents: 30000 }],
  updateProject: vi.fn(async () => {}),
}))
vi.mock('@/lib/planning', () => ({ fetchExpenses: async () => [], deleteExpense: vi.fn() }))
vi.mock('@/lib/wallet', () => ({ fetchWalletEntries: async () => [] }))
vi.mock('@/lib/supplier-requests', () => ({
  fetchAllocations: async () => [{ id: 'food', project_id: 'party', name: 'Food', limit_cents: 10000 }],
  featureError: (e: Error) => e.message,
}))
vi.mock('@/lib/budget-ledger', async (original) => ({
  ...(await original<typeof import('@/lib/budget-ledger')>()),
  fetchBudgetPlan: async () => ({
    budget: 100000,
    funds: [{ id: 'personal', name: 'Personal', budget_cents: 50000 }],
    memberships: [],
  }),
  fetchBudgetAllocations: async () => [{ id: 'food', project_id: 'party', name: 'Food', limit_cents: 10000 }],
  saveOverallBudget: vi.fn(async () => {}),
  saveFund: vi.fn(async () => {}),
  saveAllocation: vi.fn(async () => {}),
  moveProjectToFund: vi.fn(async () => {}),
}))
function Harness({ initial = 'overall' }: { initial?: string }) {
  const [focus, setFocus] = useState(initial)
  return <BudgetLedger focus={focus} onFocus={setFocus} />
}
function open(initial?: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <Harness initial={initial} />
    </QueryClientProvider>,
  )
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveOverallBudget).mockResolvedValue(undefined)
})
it('edits the overall budget directly in its row, validates cents and keeps failed saves editable', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit budget for Overall budget' }))
  fireEvent.change(screen.getByLabelText('Budget for Overall budget (AUD)'), { target: { value: '1.234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(saveOverallBudget).not.toHaveBeenCalled()
  vi.mocked(saveOverallBudget).mockRejectedValueOnce(new Error('Connection lost. Try again.'))
  fireEvent.change(screen.getByLabelText('Budget for Overall budget (AUD)'), { target: { value: '123.45' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Connection lost. Try again.')).toBeInTheDocument()
  expect(screen.getByLabelText('Budget for Overall budget (AUD)')).toHaveValue('123.45')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(screen.queryByLabelText('Budget for Overall budget (AUD)')).not.toBeInTheDocument(),
  )
  expect(saveOverallBudget).toHaveBeenLastCalledWith('owner', 12345)
})
it('creates a funded group as a table line and moves an existing project into it', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: 'Add group' }))
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Business' } })
  fireEvent.change(screen.getByLabelText('Budget (AUD)'), { target: { value: '2000.50' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }))
  await waitFor(() => expect(saveFund).toHaveBeenCalledWith('owner', 'Business', 200050, undefined))
  fireEvent.click(screen.getByRole('button', { name: 'Open Personal budget' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
  fireEvent.change(screen.getByLabelText('Project to add'), { target: { value: 'party' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
  await waitFor(() => expect(moveProjectToFund).toHaveBeenCalledWith('party', 'personal'))
})
it('creates an allocation in the project and starts new costs in the selected allocation with receipt upload', async () => {
  open('project:party')
  const add = await screen.findByRole('button', { name: 'Add allocation' })
  const table = add.closest('table')!
  expect(add.closest('tr')).toBe(table.tBodies[0].lastElementChild)
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual(['Description', 'Budget', 'Actual', 'Forecast', 'Remaining', 'Actions'])
  fireEvent.click(add)
  const draft = screen.getByRole('row', { name: 'New allocation' }) as HTMLTableRowElement
  const name = screen.getByLabelText('Allocation name') as HTMLInputElement
  const budget = screen.getByLabelText('Budget (AUD)') as HTMLInputElement
  expect(draft.cells[0]).toContainElement(name)
  expect(draft.cells[1]).toContainElement(budget)
  expect(name.form).toBe(draft.querySelector('form'))
  expect(budget.form).toBe(name.form)
  fireEvent.change(screen.getByLabelText('Allocation name'), { target: { value: 'Venue' } })
  fireEvent.change(screen.getByLabelText('Budget (AUD)'), { target: { value: '75.29' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save allocation' }))
  await waitFor(() => expect(saveAllocation).toHaveBeenCalledWith('owner', 'party', 'Venue', 7529, undefined))
  await waitFor(() => expect(name).toHaveValue(''))
  expect(budget).toHaveValue('')
  await waitFor(() => expect(name).toHaveFocus())
  fireEvent.keyDown(budget, { key: 'Escape' })
  expect(screen.queryByRole('row', { name: 'New allocation' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add allocation' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open Food budget' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add cost' }))
  await waitFor(() => expect(screen.getByLabelText('Budget allocation')).toHaveValue('food'))
  expect(screen.getByLabelText('Choose receipt')).toHaveAttribute(
    'accept',
    expect.stringContaining('image/jpeg'),
  )
  expect(screen.getByLabelText('Take receipt photo')).toHaveAttribute('capture', 'environment')
})
it('keeps a failed allocation in its table row and retries without losing the draft', async () => {
  open('project:party')
  fireEvent.click(await screen.findByRole('button', { name: 'Add allocation' }))
  const name = screen.getByLabelText('Allocation name')
  const budget = screen.getByLabelText('Budget (AUD)')
  fireEvent.change(name, { target: { value: 'Venue' } })
  fireEvent.change(budget, { target: { value: '-50' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save allocation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a positive amount')
  expect(saveAllocation).not.toHaveBeenCalled()
  vi.mocked(saveAllocation).mockRejectedValueOnce(new Error('Connection lost. Try again.'))
  fireEvent.change(budget, { target: { value: '50.29' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save allocation' }))
  expect(await screen.findByText('Connection lost. Try again.')).toBeInTheDocument()
  expect(name).toHaveValue('Venue')
  expect(budget).toHaveValue('50.29')
  fireEvent.click(screen.getByRole('button', { name: 'Save allocation' }))
  await waitFor(() => expect(name).toHaveValue(''))
  expect(saveAllocation).toHaveBeenCalledTimes(2)
  expect(saveAllocation).toHaveBeenLastCalledWith('owner', 'party', 'Venue', 5029, undefined)
})
it('shows parent budgets and breadcrumbs without adding another set of tables', async () => {
  open('project:party')
  const region = await screen.findByRole('region', { name: 'Budget breakdown' })
  expect(within(region).getAllByRole('table')).toHaveLength(1)
  expect(within(region).getByRole('button', { name: 'Edit budget for Party' })).toBeInTheDocument()
  fireEvent.click(within(region).getByRole('button', { name: 'Open Food budget' }))
  expect(screen.getByRole('navigation', { name: 'Budget location' })).toHaveTextContent(
    'All budgets/Party/Food',
  )
  expect(screen.getByRole('heading', { name: 'Food' })).toHaveFocus()
})
