import '../test-setup'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  listener: null as null | ((event: string, session: Session | null) => void),
}))
vi.mock('@/lib/auth', () => ({
  getSession: mocks.session,
  signInWithEmail: vi.fn(),
  signOutSession: vi.fn(),
  signUpWithEmail: vi.fn(),
}))
vi.mock('@/lib/profile', () => ({
  fetchProfile: mocks.profile,
  updateActiveMode: vi.fn(),
  upsertOnboarding: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))
import { AppStoreProvider, useAppStore } from './useAppStore'

const clients: QueryClient[] = []
const session = (id: string) => ({ user: { id }, access_token: id }) as Session
const profile = (name: string) => ({
  profile: { first_name: name, active_mode: 'individual' },
  businessProfile: null,
})
function Consumer() {
  const state = useAppStore()
  return (
    <div>
      {state.loading
        ? 'Loading account'
        : `${state.session?.user.id ?? 'signed out'}: ${state.profile?.first_name ?? 'no profile'}`}
    </div>
  )
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <AppStoreProvider>
        <Consumer />
      </AppStoreProvider>
    </QueryClientProvider>,
  )
  return client
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listener = null
  mocks.session.mockResolvedValue(session('a'))
  mocks.profile.mockResolvedValue(profile('Alice'))
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((c) => c.clear())
})

it('keeps the profile and private cache on same-account token refresh', async () => {
  const client = setup()
  await screen.findByText('a: Alice')
  client.setQueryData(['projects'], [{ id: 'private-project' }])
  await act(async () => {
    mocks.listener?.('TOKEN_REFRESHED', session('a'))
  })
  expect(screen.getByText('a: Alice')).toBeInTheDocument()
  expect(mocks.profile).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(['projects'])).toEqual([{ id: 'private-project' }])
})

it('clears the previous account cache and ignores its late profile response', async () => {
  let finishA!: (value: ReturnType<typeof profile>) => void
  mocks.profile.mockImplementation((id: string) =>
    id === 'a'
      ? new Promise((resolve) => {
          finishA = resolve
        })
      : Promise.resolve(profile('Bob')),
  )
  const client = setup()
  await waitFor(() => expect(mocks.profile).toHaveBeenCalledWith('a'))
  client.setQueryData(['projects'], [{ id: 'private-a' }])
  await act(async () => {
    mocks.listener?.('SIGNED_IN', session('b'))
  })
  await screen.findByText('b: Bob')
  expect(client.getQueryData(['projects'])).toBeUndefined()
  await act(async () => {
    finishA(profile('Alice'))
  })
  expect(screen.getByText('b: Bob')).toBeInTheDocument()
})

it('does not replace a newer auth event with a late initial session read', async () => {
  let finish!: (value: Session) => void
  mocks.session.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  mocks.profile.mockResolvedValue(profile('Bob'))
  setup()
  await act(async () => {
    mocks.listener?.('SIGNED_IN', session('b'))
  })
  await screen.findByText('b: Bob')
  await act(async () => {
    finish(session('a'))
  })
  expect(screen.getByText('b: Bob')).toBeInTheDocument()
  expect(mocks.profile).toHaveBeenCalledTimes(1)
})
