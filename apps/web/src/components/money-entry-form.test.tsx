import '../test-setup'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MoneyEntryForm } from './money-entry-form'
import { createExpense } from '@/lib/planning'
import { createWalletEntry } from '@/lib/wallet'
import { uploadReceipt } from '@/lib/supplier-requests'

vi.mock('@/hooks/useAppStore', () => ({
  useAppStore: () => ({ session: { user: { id: 'owner' } } }),
}))
vi.mock('@/lib/projects', () => ({
  fetchProjects: async () => [{ id: 'party', title: 'Birthday dinner' }],
}))
vi.mock('@/lib/planning', () => ({
  createExpense: vi.fn(async () => 'cost'),
  updateExpense: vi.fn(),
}))
vi.mock('@/lib/wallet', () => ({
  createWalletEntry: vi.fn(async () => 'payment'),
  updateWalletEntry: vi.fn(),
}))
vi.mock('@/lib/supplier-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supplier-requests')>()),
  fetchAllocations: async () => [],
  uploadReceipt: vi.fn(async () => {}),
}))
const saved = vi.fn()
async function open(projectId?: string, defaultDirection?: 'in' | 'out') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MoneyEntryForm
        projectId={projectId}
        defaultDirection={defaultDirection}
        onSaved={saved}
      />
    </QueryClientProvider>,
  )
  await screen.findByRole('option', { name: 'Birthday dinner' })
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(uploadReceipt).mockResolvedValue(undefined)
})
it('records project spending once in the budget and attaches its receipt to that cost', async () => {
  await open('party')
  fireEvent.change(screen.getByLabelText('Cost name'), {
    target: { value: 'Cake' },
  })
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'paid' },
  })
  fireEvent.change(screen.getByLabelText('Actual cost (AUD)'), {
    target: { value: '42.50' },
  })
  const file = new File(['photo'], 'receipt.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: { files: [file] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
  await waitFor(() =>
    expect(saved).toHaveBeenCalledWith({ kind: 'expense', id: 'cost' }),
  )
  expect(createExpense).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: 'party',
      actualCents: 4250,
      paymentStatus: 'paid',
    }),
  )
  expect(createWalletEntry).not.toHaveBeenCalled()
  expect(uploadReceipt).toHaveBeenCalledWith(
    file,
    { kind: 'expense', id: 'cost' },
    'owner',
  )
})
it('retries a failed receipt without creating a second financial record', async () => {
  vi.mocked(uploadReceipt).mockRejectedValueOnce(
    new Error('Upload unavailable'),
  )
  await open()
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Supplies' },
  })
  fireEvent.change(screen.getByLabelText('Amount (AUD)'), {
    target: { value: '12' },
  })
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: { files: [new File(['r'], 'r.pdf', { type: 'application/pdf' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Record saved. Receipt upload failed.',
  )
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Description')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry receipt upload' }))
  await waitFor(() =>
    expect(saved).toHaveBeenCalledWith({ kind: 'transaction', id: 'payment' }),
  )
  expect(createWalletEntry).toHaveBeenCalledTimes(1)
  expect(uploadReceipt).toHaveBeenCalledTimes(2)
})
it('records expected project income without inflating its cost budget', async () => {
  await open('party', 'in')
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Guest contributions' },
  })
  fireEvent.change(screen.getByLabelText('Amount (AUD)'), {
    target: { value: '90' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
  await waitFor(() =>
    expect(createWalletEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedProjectId: 'party',
        direction: 'in',
        entryKind: 'request',
        amountCents: 9000,
      }),
    ),
  )
  expect(createExpense).not.toHaveBeenCalled()
})
it('rejects an unsupported attachment before saving any money record', async () => {
  await open()
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: {
      files: [new File(['<script/>'], 'r.svg', { type: 'image/svg+xml' })],
    },
  })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose a JPEG, PNG, WebP image or PDF.',
  )
  expect(createExpense).not.toHaveBeenCalled()
  expect(createWalletEntry).not.toHaveBeenCalled()
})
