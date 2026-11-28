import '../test-setup'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { signInWithEmail, signUpWithEmail } from '@/lib/auth'
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
      {state.accountError && <p role="alert">{state.accountError}</p>}
      <button onClick={state.retryAccount}>Retry</button>
      <button onClick={() => void state.signUp('test@example.com', 'test-password')}>Register</button>
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

it('recovers from a rejected initial session read', async () => {
  mocks.session.mockRejectedValueOnce(new Error('Offline'))
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent('session could not be restored')
  expect(screen.queryByText('Loading account')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Retry'))
  await screen.findByText('a: Alice')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('distinguishes failed profile loading from an account needing onboarding', async () => {
  mocks.profile.mockRejectedValueOnce(new Error('Network failure'))
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent('account could not be loaded')
  fireEvent.click(screen.getByText('Retry'))
  await screen.findByText('a: Alice')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('does not try signing in before signup email confirmation', async () => {
  vi.mocked(signUpWithEmail).mockResolvedValue({ session: null, user: null })
  setup()
  await screen.findByText('a: Alice')
  fireEvent.click(screen.getByText('Register'))
  await waitFor(() => expect(signUpWithEmail).toHaveBeenCalledOnce())
  expect(signInWithEmail).not.toHaveBeenCalled()
})

it('ignores a late bootstrap error after a newer successful sign-in', async () => {
  let fail!: (error: Error) => void
  mocks.session.mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject
      }),
  )
  setup()
  await act(async () => {
    mocks.listener?.('SIGNED_IN', session('a'))
  })
  await screen.findByText('a: Alice')
  await act(async () => {
    fail(new Error('Old request failed'))
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('a: Alice')).toBeInTheDocument()
})
