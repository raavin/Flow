import '../test-setup'
import { it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(async () => 'request'),
  user: 'owner',
  request: {
    id: 'request',
    owner_id: 'owner',
    title: 'Dinner',
    description: 'Food for 12',
    context_note: 'Vegan menu',
    location_label: 'Melbourne',
    due_on: null,
    budget_cents: 10000,
    project_id: 'project',
    allocation_id: null,
    status: 'open',
  },
  quotes: [] as unknown[],
}))
vi.mock('@/components/layout', () => ({ appRoute: {} }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  createRoute: () => ({
    useSearch: () => ({ projectId: 'project' }),
    useParams: () => ({ requestId: 'request' }),
  }),
}))
vi.mock('@/hooks/useAppStore', () => ({
  useAppStore: () => ({ session: { user: { id: mocks.user } } }),
}))
vi.mock('@/lib/projects', () => ({
  fetchProjects: async () => [{ id: 'project', title: 'Private party' }],
}))
vi.mock('@/lib/supplier-requests', () => ({
  rpc: mocks.rpc,
  featureError: (e: Error) => e.message,
  fetchRequests: async () => [],
  fetchQuotes: async () => mocks.quotes,
  fetchAllocations: async () => [],
  database: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: mocks.request, error: null }),
        }),
      }),
    }),
  }),
}))
import { RequestsPage, RequestDetail } from './supplier-requests'
function open(node: ReactNode) {
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
      {node}
    </QueryClientProvider>,
  )
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = 'owner'
  mocks.quotes = []
})
it('previews only the explicitly written brief before publishing', async () => {
  open(<RequestsPage />)
  await screen.findByText('Private party')
  fireEvent.change(screen.getByLabelText('Request title'), {
    target: { value: 'Catering' },
  })
  fireEvent.change(screen.getByLabelText('Requirements'), {
    target: { value: 'Dinner for 12' },
  })
  fireEvent.change(
    screen.getByLabelText('Project context to share (optional)'),
    { target: { value: 'Vegan food' } },
  )
  fireEvent.change(screen.getByLabelText('Budget (AUD, optional)'), {
    target: { value: '120.50' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Preview request' }))
  expect(screen.getByText('Review your request')).toBeInTheDocument()
  expect(screen.queryByText('Private party')).not.toBeInTheDocument()
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Publish request' }))
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenCalledWith(
      'publish_supplier_request',
      expect.objectContaining({
        p_title: 'Catering',
        p_context: 'Vegan food',
        p_project: 'project',
        p_budget: 12050,
      }),
    ),
  )
})
it('requires explicit selection confirmation and warns about the budget impact', async () => {
  mocks.quotes = [
    {
      id: 'quote',
      request_id: 'request',
      supplier_id: 'supplier',
      requester_id: 'owner',
      supplier_label: 'Food Co',
      amount_cents: 12500,
      details: 'Includes delivery',
      available_on: null,
      valid_until: null,
      status: 'pending',
      expense_id: null,
    },
  ]
  open(<RequestDetail />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Choose this quote' }),
  )
  expect(screen.getByText(/This adds a committed cost/)).toBeInTheDocument()
  expect(screen.getByText(/above the request budget/)).toBeInTheDocument()
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm supplier' }))
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenCalledWith('choose_supplier_quote', {
      p_quote: 'quote',
    }),
  )
})
it('does not offer owner selection controls to the supplier', async () => {
  mocks.user = 'supplier'
  mocks.quotes = [
    {
      id: 'quote',
      request_id: 'request',
      supplier_id: 'supplier',
      requester_id: 'owner',
      supplier_label: 'Food Co',
      amount_cents: 12500,
      details: 'Delivery',
      available_on: null,
      valid_until: null,
      status: 'pending',
      expense_id: null,
    },
  ]
  open(<RequestDetail />)
  await screen.findByText('Food Co')
  expect(
    screen.queryByRole('button', { name: 'Choose this quote' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Withdraw quote' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Save revised quote' }),
  ).toBeInTheDocument()
})
