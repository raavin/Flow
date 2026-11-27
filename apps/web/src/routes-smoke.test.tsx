import './test-setup'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'

vi.mock('@/hooks/useAppStore', () => import('../scripts/ui-audit/store'))
vi.mock('@/lib/supabase', () => import('../scripts/ui-audit/database'))

import { router as appRouter } from './router'
import * as projectApi from './lib/projects'

// jsdom has no layout engine or scrolling implementation.
HTMLElement.prototype.scrollTo = vi.fn()
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
}
const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

async function openPage(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(queryClient)
  const router = createRouter({
    routeTree: appRouter.routeTree,
    defaultErrorComponent: appRouter.options.defaultErrorComponent,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(router.state.status).toBe('idle'))
  const main = await screen.findByRole('main')
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  return { main, router, queryClient }
}

const routes = [
  '/app/home',
  '/app/messages',
  '/app/messages/post/sample-post',
  '/app/messages/profile/audit-owner',
  '/app/messages/topics/food',
  '/app/messages/dm',
  '/app/messages/dm/sample-chat',
  '/app/projects',
  '/app/projects/sample-party',
  ...[
    'conversation',
    'tasks',
    'calendar',
    'timeline',
    'notes',
    'store',
    'people',
    'participants',
    'availability',
    'budget',
    'updates',
  ].map((view) => `/app/projects/sample-party/${view}`),
  '/app/coordination',
  '/app/coordination/sample-plan',
  '/app/ai',
  '/app/template-editor',
  '/app/calendar',
  '/app/gantt',
  '/app/budgets',
  '/app/wallet',
  '/app/marketplace',
  '/app/marketplace/templates',
  '/app/marketplace/services',
  '/app/marketplace/category/Events',
  '/app/marketplace/listings/sample-listing',
  '/app/marketplace/seller/sample-seller',
  '/app/marketplace/manage',
  '/app/marketplace/cart',
  '/app/marketplace/requests',
  '/app/marketplace/requests/sample-request',
  '/app/business/sample-seller',
  '/app/business/listings',
  '/app/jobs',
  '/app/jobs/sample-job',
  '/app/notifications',
  '/app/search?q=dinner',
  '/app/settings',
  '/app/integrations',
  '/app/support',
]

it.each(routes)('renders %s with a signed-in account and no failed data queries', async (path) => {
  const { main, queryClient } = await openPage(path)
  const errors = queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.status === 'error')
    .map((query) => ({ key: query.queryKey, error: String(query.state.error) }))
  expect(errors).toEqual([])
  expect(within(main).queryByText('Something went wrong!')).not.toBeInTheDocument()
  expect(within(main).queryByText('This page could not be opened')).not.toBeInTheDocument()
  expect(main.textContent!.trim().length).toBeGreaterThan(10)
})

it('keeps the familiar sidebar and project sections visible while navigating between pages', async () => {
  const { router, queryClient } = await openPage('/app/messages')
  const menu = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const name of ['Messages', 'Calendar', 'Projects', 'Plans', 'Marketplace', 'Money'])
    expect(within(menu).getByRole('link', { name })).toBeVisible()
  expect(screen.getByRole('button', { name: /Change theme/ })).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  expect(await screen.findByText('Planning a birthday dinner. What should we cook?')).toBeVisible()
  await act(() =>
    router.navigate({ to: '/app/projects/$projectId/notes', params: { projectId: 'sample-party' } }),
  )
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  const projectMenu = await screen.findByRole('navigation', { name: 'Project navigation' })
  for (const name of [
    'Conversation',
    'Tasks',
    'Calendar',
    'Timeline',
    'Notes',
    'Budget',
    'Listings',
    'People',
  ])
    expect(within(projectMenu).getByRole('link', { name })).toBeVisible()
  expect(within(projectMenu).getByRole('link', { name: 'Notes' })).toHaveAttribute('aria-current', 'page')
  await act(() => router.navigate({ to: '/app/messages/dm' }))
  expect(await screen.findByText('Dinner planning')).toBeVisible()
  expect(within(menu).getByRole('link', { name: 'Messages' })).toHaveClass('ui-nav-link--active')
  await act(() => router.navigate({ to: '/app/coordination' }))
  expect(await screen.findByRole('heading', { name: 'Plans' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'New plan' })).toBeVisible()
})

it('opens the project form and closes it without leaving the page locked', async () => {
  await openPage('/app/projects')
  const trigger = screen.getByRole('button', { name: 'New project' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'New project' })
  expect(within(dialog).getByLabelText('Project name')).toBeVisible()
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
  expect(trigger).toHaveFocus()
})

it('opens the post composer with one heading and one close control', async () => {
  await openPage('/app/messages')
  fireEvent.click(screen.getByRole('button', { name: /Write a post/ }))
  const dialog = await screen.findByRole('dialog', { name: 'New post' })
  expect(within(dialog).getAllByRole('heading')).toHaveLength(1)
  expect(within(dialog).getAllByRole('button', { name: 'Close' })).toHaveLength(1)
  expect(within(dialog).queryByText('Share a note')).not.toBeInTheDocument()
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it.each(['/app/wallet', '/app/projects/sample-party/budget'])(
  'keeps receipt upload visible in %s',
  async (path) => {
    const { main } = await openPage(path)
    expect(within(main).getAllByRole('table').length).toBeGreaterThan(0)
    fireEvent.click(within(main).getByRole('button', { name: 'Add entry' }))
    expect(await screen.findByLabelText('Choose receipt')).toHaveAttribute(
      'accept',
      expect.stringContaining('image/jpeg'),
    )
    expect(screen.getByLabelText('Take receipt photo')).toHaveAttribute('capture', 'environment')
  },
)

it('keeps navigation available and supports retry when a page throws', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetch = vi.spyOn(projectApi, 'fetchProjects').mockResolvedValue([undefined] as never)
  const { queryClient } = await openPage('/app/projects')
  expect(await screen.findByRole('heading', { name: 'This page could not be opened' })).toBeVisible()
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  fetch.mockRestore()
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'Projects' })).toBeVisible()
})
