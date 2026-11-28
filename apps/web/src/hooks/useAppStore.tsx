import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AccountMode, BusinessProfileRecord, ProfileRecord } from '@superapp/types'
import { getSession, signInWithEmail, signOutSession, signUpWithEmail } from '@/lib/auth'
import { fetchProfile, updateActiveMode, upsertOnboarding } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { optimisticWrites } from '@/lib/optimistic'

type AppStoreValue = {
  session: Session | null
  profile: ProfileRecord | null
  businessProfile: BusinessProfileRecord | null
  loading: boolean
  accountError: string | null
  retryAccount: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  saveOnboarding: (payload: {
    accountMode: AccountMode
    firstName: string
    lastName?: string
    location: string
    timeZone: string
    useCases: string[]
    integrations: string[]
    handle?: string
    businessName?: string
    category?: string
    serviceArea?: string
    offerings?: string[]
    bookingModel?: string
    availabilityNotes?: string
    visibilityMode?: string
  }) => Promise<void>
  setActiveMode: (mode: 'individual' | 'business') => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const modeVersion = useRef(0)
  const confirmedMode = useRef<'individual' | 'business'>('individual')
  const account = useRef<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let mounted = true
    let currentUser: string | null | undefined
    let generation = 0

    async function syncSession(nextSession: Session | null) {
      if (!mounted) return
      const userId = nextSession?.user.id ?? null
      setSession(nextSession)
      // Token refresh is not an account change: don't blank every page or
      // reload the profile when Supabase renews the same user's session.
      if (currentUser === userId) return
      currentUser = userId
      account.current = userId
      const version = ++generation
      ++modeVersion.current
      setLoading(true)
      setAccountError(null)
      setProfile(null)
      setBusinessProfile(null)
      try {
        await queryClient.cancelQueries()
        if (!mounted || version !== generation) return
        optimisticWrites.reset()
        queryClient.clear()

        if (nextSession?.user.id) {
          const result = await fetchProfile(nextSession.user.id)
          if (!mounted || version !== generation) return
          setProfile(result?.profile ?? null)
          confirmedMode.current = result?.profile?.active_mode ?? 'individual'
          setBusinessProfile(result?.businessProfile ?? null)
        } else {
          setProfile(null)
          setBusinessProfile(null)
        }
      } catch {
        if (mounted && version === generation) {
          currentUser = undefined
          setAccountError('Your account could not be loaded. Check your connection and try again.')
        }
      } finally {
        if (mounted && version === generation) setLoading(false)
      }
    }

    async function bootstrap() {
      setLoading(true)
      setAccountError(null)
      try {
        const currentSession = await getSession()
        if (generation === 0) await syncSession(currentSession)
      } catch {
        if (mounted && generation === 0) {
          setAccountError('Your session could not be restored. Check your connection and try again.')
          setLoading(false)
        }
      }
    }

    void bootstrap()

    if (!supabase)
      return () => {
        mounted = false
      }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [queryClient, retryCount])

  const value = useMemo<AppStoreValue>(
    () => ({
      session,
      profile,
      businessProfile,
      loading,
      accountError,
      retryAccount: () => setRetryCount((count) => count + 1),
      signIn: async (email, password) => {
        await signInWithEmail(email, password)
      },
      signUp: async (email, password) => {
        // A null session is expected when email confirmation is required.
        await signUpWithEmail(email, password)
      },
      signOut: async () => {
        await signOutSession()
      },
      saveOnboarding: async (payload) => {
        const currentSession = session ?? (await getSession())
        if (!currentSession?.user.id) {
          throw new Error('You need to be signed in first.')
        }

        const activeMode = payload.accountMode === 'business' ? 'business' : 'individual'

        await upsertOnboarding({
          userId: currentSession.user.id,
          activeMode,
          ...payload,
        })

        const result = await fetchProfile(currentSession.user.id)
        if (account.current !== currentSession.user.id) return
        setProfile(result?.profile ?? null)
        confirmedMode.current = result?.profile?.active_mode ?? 'individual'
        setBusinessProfile(result?.businessProfile ?? null)
      },
      setActiveMode: async (mode) => {
        if (!session?.user.id) return
        const userId = session.user.id
        const version = ++modeVersion.current
        setProfile((current) => (current ? { ...current, active_mode: mode } : current))
        try {
          await updateActiveMode(userId, mode)
          if (account.current === userId) confirmedMode.current = mode
        } catch (error) {
          if (version === modeVersion.current)
            setProfile((current) => (current ? { ...current, active_mode: confirmedMode.current } : current))
          throw error
        }
      },
    }),
    [accountError, businessProfile, loading, profile, session],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error('useAppStore must be used inside AppStoreProvider')
  }
  return context
}
