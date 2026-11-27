import '../test-setup'
import { vi, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  notifications: vi.fn(),
}))
vi.mock('@/components/layout', () => ({ appRoute: {} }))
vi.mock('@tanstack/react-router', () => ({
  createRoute: () => ({ useParams: () => ({ projectId: 'project' }) }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/hooks/useAppStore', () => ({
  useAppStore: () => ({ session: { user: { id: 'owner' } } }),
}))
vi.mock('@/lib/jobs', () => ({
  fetchJobs: async () => [],
  createJob: mocks.create,
  updateJobStatus: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
}))
vi.mock('@/lib/projects', () => ({
  fetchProjects: async () => [],
  fetchProjectDetail: async () => ({
    project: { title: 'Party' },
    milestones: [],
  }),
}))
vi.mock('@/lib/coordination', () => ({
  fetchNotifications: mocks.notifications,
  markNotificationRead: vi.fn(),
}))
vi.mock('@/lib/planning', async (original) => ({
  ...(await original<typeof import('@/lib/planning')>()),
  fetchStructuredUpdates: async () => [],
  createStructuredUpdate: mocks.update,
}))
import { JobsPage } from './jobs'
import { UpdatesPage } from './planning'
import { NotificationsPage } from './notifications'
function show(children: ReactNode) {
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
      {children}
    </QueryClientProvider>,
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('requires job details, retains a failed draft and resets after a successful save', async () => {
  mocks.create.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined)
  show(<JobsPage />)
  expect(screen.getByRole('button', { name: 'Create job' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Job title'), {
    target: { value: 'Catering' },
  })
  fireEvent.change(screen.getByLabelText('Customer'), {
    target: { value: 'Sam' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create job' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
  expect(screen.getByLabelText('Job title')).toHaveValue('Catering')
  fireEvent.click(screen.getByRole('button', { name: 'Create job' }))
  await waitFor(() => expect(screen.getByLabelText('Job title')).toHaveValue(''))
  expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ paymentState: 'unpaid' }))
})
it('saves an update with optional dates blank instead of throwing Invalid time value', async () => {
  mocks.update.mockResolvedValue(undefined)
  show(<UpdatesPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Apply update' }))
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        previousTime: undefined,
        nextTime: undefined,
        aiReplan: false,
      }),
    ),
  )
  expect(await screen.findByText('Update saved.')).toBeInTheDocument()
})
it('shows a failed notification request separately from an empty inbox and allows retry', async () => {
  mocks.notifications.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  show(<NotificationsPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  expect(screen.queryByText('No notifications here.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('No notifications here.')).toBeInTheDocument()
})
