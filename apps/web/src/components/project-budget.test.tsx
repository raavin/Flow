import '../test-setup'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ProjectBudget } from './project-budget'
import { createExpense, updateExpense, fetchExpenses } from '@/lib/planning'
import { updateProject } from '@/lib/projects'

vi.mock('./project-shell', () => ({
  ProjectShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/hooks/useAppStore', () => ({
  useAppStore: () => ({ session: { user: { id: 'owner' } } }),
}))
vi.mock('./budget-allocations', () => ({ BudgetAllocations: () => null }))
vi.mock('./expense-receipts', () => ({ ExpenseReceipts: () => null }))
vi.mock('@/lib/supplier-requests', () => ({
  fetchAllocations: async () => [],
  featureError: (e: Error) => e.message,
}))
vi.mock('@/lib/projects', () => ({
  fetchProjects: async () => [{ id: 'party', title: 'Party' }],
  fetchProjectDetail: vi.fn(async () => ({
    ownerId: 'owner',
    project: { budgetCents: 10000 },
  })),
  updateProject: vi.fn(async () => {}),
}))
vi.mock('@/lib/planning', () => ({
  fetchExpenses: vi.fn(async () => []),
  createExpense: vi.fn(async () => 'new-cost'),
  updateExpense: vi.fn(async () => {}),
  deleteExpense: vi.fn(async () => {}),
}))

function open() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ProjectBudget projectId="party" />
    </QueryClientProvider>,
  )
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchExpenses).mockResolvedValue([])
})
describe('project budget editing', () => {
  it('saves a planned cost as unpaid with exact cents', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    await screen.findByRole('option', { name: 'Party' })
    fireEvent.change(screen.getByLabelText('Cost name'), {
      target: { value: 'Present' },
    })
    fireEvent.change(screen.getByLabelText('Estimate (AUD)'), {
      target: { value: '45.29' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    await waitFor(() =>
      expect(createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'party',
          title: 'Present',
          estimateCents: 4529,
          actualCents: 0,
          paymentStatus: 'unpaid',
        }),
      ),
    )
  })
  it('requires an actual amount when marking a cost paid', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    await screen.findByRole('option', { name: 'Party' })
    fireEvent.change(screen.getByLabelText('Cost name'), {
      target: { value: 'Present' },
    })
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'paid' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the actual amount paid')
    expect(createExpense).not.toHaveBeenCalled()
  })
  it('supports an explicit zero budget and clearing the limit', async () => {
    open()
    await screen.findByLabelText('Budget limit (AUD)')
    fireEvent.change(screen.getByLabelText('Budget limit (AUD)'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('party', { budgetCents: 0 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save limit' })).toBeDisabled())
    fireEvent.change(screen.getByLabelText('Budget limit (AUD)'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }))
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith('party', {
        budgetCents: null,
      }),
    )
  })
  it('edits the estimate, actual cost and status of an existing item', async () => {
    vi.mocked(fetchExpenses).mockResolvedValue([
      {
        id: 'cost-1',
        project_id: 'party',
        category: 'Food',
        title: 'Drinks',
        estimate_cents: 5000,
        actual_cents: 0,
        payment_status: 'unpaid',
        allocation_id: null,
        linked_listing_id: null,
      },
    ])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Actual cost (AUD)'), {
      target: { value: '47.50' },
    })
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'paid' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(updateExpense).toHaveBeenCalledWith(
        'cost-1',
        expect.objectContaining({ actualCents: 4750, paymentStatus: 'paid' }),
      ),
    )
  })
})
