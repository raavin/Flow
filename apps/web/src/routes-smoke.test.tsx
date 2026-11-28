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
  vi.unstubAllGlobals()
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
  await waitFor(() => expect(router.state.status).toBe('idle'), { timeout: 5000 })
  const main = await screen.findByRole('main')
  await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 })
  return { main, router, queryClient }
}

const routes = [
  '/app/home',
  '/app/messages',
  '/app/messages/post/sample-post',
  '/app/messages/project/sample-party',
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

it('covers every registered app page', () => {
  const pagePaths = Object.values(appRouter.routesById)
    .map((route) => route.fullPath)
    .filter((path) => path.startsWith('/app/'))
  for (const path of pagePaths) {
    const pattern = new RegExp(`^${path.replace(/\$[^/]+/g, '[^/]+')}$`)
    expect(
      routes.some((url) => pattern.test(url.split('?')[0])),
      path,
    ).toBe(true)
  }
})

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

it('opens the compact app menu, navigates and restores the page after closing', async () => {
  const { router } = await openPage('/app/projects/sample-party/tasks')
  const trigger = screen.getByRole('button', { name: 'Menu' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Menu' })
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(document.body.style.overflow).toBe('hidden')
  const navigation = within(dialog).getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Messages', 'Projects', 'Plans', 'Calendar', 'Money', 'Marketplace',
  ])
  expect(within(navigation).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page')
  for (const name of ['Profile', 'Integrations', 'Support'])
    expect(within(dialog).getByRole('link', { name })).toBeVisible()
  expect(within(dialog).getByRole('button', { name: 'Personal' })).toBeVisible()
  expect(within(dialog).getByRole('button', { name: /Change theme/ })).toBeVisible()
  fireEvent.click(within(navigation).getByRole('link', { name: 'Money' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/app/budgets'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(document.body.style.overflow).toBe('')
  expect(trigger).toHaveFocus()
})

it('dismisses the app menu with Escape and on navigation outside the menu', async () => {
  const { router } = await openPage('/app/projects')
  const trigger = screen.getByRole('button', { name: 'Menu' })
  trigger.focus()
  fireEvent.click(trigger)
  fireEvent(await screen.findByRole('dialog', { name: 'Menu' }), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  fireEvent.click(trigger)
  await act(() => router.navigate({ to: '/app/messages' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
})

it('unlocks the page when an open app menu changes to the desktop layout', async () => {
  const breakpoint = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', vi.fn(() => breakpoint))
  await openPage('/app/projects')
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  await act(() => {
    breakpoint.matches = true
    breakpoint.dispatchEvent(new Event('change'))
  })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
})

it('lets the compact project chooser reach every section without leaving the project', async () => {
  const { router } = await openPage('/app/projects/sample-party/tasks')
  const summary = screen.getByLabelText('Project page: Tasks')
  const chooser = summary.closest('details')!
  expect(chooser).not.toHaveAttribute('open')
  fireEvent.click(summary)
  expect(chooser).toHaveAttribute('open')
  const links = within(chooser).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'Conversation', 'People', 'Availability', 'Updates', 'Notes', 'Tasks',
    'Calendar', 'Timeline', 'Budget', 'Listings',
  ])
  for (const link of links) expect(link.getAttribute('href')).toMatch(/^\/app\/projects\/sample-party\//)
  fireEvent.click(within(chooser).getByRole('link', { name: 'Availability' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/app/projects/sample-party/availability'))
  const currentSummary = await screen.findByLabelText('Project page: Availability')
  expect(currentSummary.closest('details')).not.toHaveAttribute('open')
  const desktop = screen.getByRole('navigation', { name: 'Project navigation' })
  expect(within(desktop).getByRole('link', { name: 'People' })).toHaveClass('flow-page-link--active')
  fireEvent.click(currentSummary)
  const currentChooser = currentSummary.closest('details')!
  expect(within(currentChooser).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'))
    .toEqual([within(currentChooser).getByRole('link', { name: 'Availability' })])
  fireEvent.click(within(currentChooser).getByRole('link', { name: 'Budget' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/app/projects/sample-party/budget'))
  expect(await screen.findByLabelText('Project page: Budget')).toBeInTheDocument()
})

it('closes the project chooser on Escape or an outside click', async () => {
  const { main } = await openPage('/app/projects/sample-party/notes')
  const summary = screen.getByLabelText('Project page: Notes')
  const chooser = summary.closest('details')!
  fireEvent.click(summary)
  const taskLink = within(chooser).getByRole('link', { name: 'Tasks' })
  taskLink.focus()
  fireEvent.keyDown(taskLink, { key: 'Escape' })
  expect(chooser).not.toHaveAttribute('open')
  expect(summary).toHaveFocus()
  fireEvent.click(summary)
  fireEvent.pointerDown(within(main).getByRole('heading', { name: 'Birthday dinner' }))
  expect(chooser).not.toHaveAttribute('open')
})

it('keeps owner-only budgets out of both project navigation layouts for collaborators', async () => {
  const detail = await projectApi.fetchProjectDetail('sample-party')
  if (!detail) throw new Error('Project fixture is missing')
  vi.spyOn(projectApi, 'fetchProjectDetail').mockResolvedValue({ ...detail, ownerId: 'another-owner' })
  await openPage('/app/projects/sample-party/notes')
  const desktop = screen.getByRole('navigation', { name: 'Project navigation' })
  expect(within(desktop).queryByRole('link', { name: 'Budget' })).not.toBeInTheDocument()
  const summary = screen.getByLabelText('Project page: Notes')
  fireEvent.click(summary)
  expect(within(summary.closest('details')!).queryByRole('link', { name: 'Budget' })).not.toBeInTheDocument()
})

it('combines project budgets, allocations and costs in one navigable table', async () => {
  const { main } = await openPage('/app/projects/sample-party/budget')
  const table = within(main).getByRole('region', { name: 'Budget breakdown' })
  expect(within(table).getByRole('button', { name: 'Edit budget for Birthday dinner' })).toBeInTheDocument()
  fireEvent.click(within(table).getByRole('button', { name: 'Open Food budget' }))
  expect(await within(main).findByRole('heading', { name: 'Food' })).toBeInTheDocument()
  expect(within(main).getByRole('button', { name: 'Edit budget for Food' })).toBeInTheDocument()
  fireEvent.click(within(main).getByRole('button', { name: 'Birthday dinner' }))
  expect(await within(main).findByRole('heading', { name: 'Budget', level: 2 })).toBeInTheDocument()
})

it('drills from overall funds to groups and projects and supports browser back', async () => {
  const { main, router } = await openPage('/app/budgets')
  fireEvent.click(within(main).getByRole('button', { name: 'Open Personal budget' }))
  await waitFor(() => expect(router.state.location.search).toMatchObject({ view: 'fund:sample-personal' }))
  fireEvent.click(await within(main).findByRole('button', { name: 'Open Birthday dinner budget' }))
  await waitFor(() => expect(router.state.location.search).toMatchObject({ view: 'project:sample-party' }))
  router.history.back()
  expect(await within(main).findByRole('heading', { name: 'Personal' })).toBeInTheDocument()
})

it('keeps group activity scoped and links back to the same budget', async () => {
  const { main, router } = await openPage('/app/budgets?view=fund:sample-personal')
  fireEvent.click(within(main).getByRole('link', { name: 'Group activity & receipts' }))
  await waitFor(() => expect(router.state.location.search).toMatchObject({ fundId: 'sample-personal' }))
  expect(await within(main).findByRole('heading', { name: 'Personal activity' })).toBeInTheDocument()
  const activity = within(main).getByRole('region', { name: 'Money activity table' })
  expect(activity).toHaveTextContent('Guest contributions')
  expect(activity).not.toHaveTextContent('Equipment')
  fireEvent.click(within(main).getByRole('link', { name: 'View budget' }))
  await waitFor(() => expect(router.state.location.search).toMatchObject({ view: 'fund:sample-personal' }))
})

it('does not replace an unavailable group with all financial records', async () => {
  const { main } = await openPage('/app/wallet?fundId=missing-group')
  expect(await within(main).findByRole('alert')).toHaveTextContent('This budget group is unavailable')
  expect(within(main).queryByRole('region', { name: 'Money activity table' })).not.toBeInTheDocument()
})

it('keeps marketplace sections connected with one current page in each navigation layout', async () => {
  const { router } = await openPage('/app/marketplace')
  for (const [current, next, path] of [
    ['Browse', 'Requests & quotes', '/app/marketplace/requests'],
    ['Requests & quotes', 'Saved items', '/app/marketplace/cart'],
    ['Saved items', 'My listings', '/app/marketplace/manage'],
    ['My listings', 'Browse', '/app/marketplace'],
  ]) {
    const desktop = screen.getByRole('navigation', { name: 'Marketplace navigation' })
    expect(within(desktop).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'))
      .toEqual([within(desktop).getByRole('link', { name: current })])
    const summary = screen.getByLabelText(`Marketplace page: ${current}`)
    fireEvent.click(summary)
    fireEvent.click(within(summary.closest('details')!).getByRole('link', { name: next }))
    await waitFor(() => expect(router.state.location.pathname).toBe(path))
    await screen.findByLabelText(`Marketplace page: ${next}`)
  }
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
    fireEvent.click(within(main).getByRole('button', { name: path === '/app/wallet' ? 'Add entry' : 'Add cost' }))
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

it('opens project pages when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError')
  })
  const { main } = await openPage('/app/projects/sample-party/notes')
  expect(within(main).getByRole('heading', { name: 'Birthday dinner' })).toBeVisible()
  expect(within(main).getByRole('navigation', { name: 'Project navigation' })).toBeVisible()
  expect(within(main).queryByRole('alert')).not.toBeInTheDocument()
})
