import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AccountMode, BusinessProfileRecord, ProfileRecord } from '@superapp/types'
import { getSession, signInWithEmail, signOutSession, signUpWithEmail } from '@/lib/auth'
import { fetchProfile, updateActiveMode, upsertOnboarding } from '@/lib/profile'
import { supabase } from '@/lib/supabase'

type AppStoreValue = {
  session: Session | null
  profile: ProfileRecord | null
  businessProfile: BusinessProfileRecord | null
  loading: boolean
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
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function syncSession(nextSession: Session | null) {
      if (!mounted) return
      setLoading(true)
      setSession(nextSession)

      try {
        if (nextSession?.user.id) {
          const result = await fetchProfile(nextSession.user.id)
          if (!mounted) return
          setProfile(result?.profile ?? null)
          setBusinessProfile(result?.businessProfile ?? null)
        } else {
          setProfile(null)
          setBusinessProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    async function bootstrap() {
      const currentSession = await getSession()
      await syncSession(currentSession)
    }

    void bootstrap()

    if (!supabase) return () => undefined

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AppStoreValue>(
    () => ({
      session,
      profile,
      businessProfile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmail(email, password)
      },
      signUp: async (email, password) => {
        const result = await signUpWithEmail(email, password)
        if (!result.session) {
          await signInWithEmail(email, password)
        }
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
        setProfile(result?.profile ?? null)
        setBusinessProfile(result?.businessProfile ?? null)
      },
      setActiveMode: async (mode) => {
        if (!session?.user.id) return
        await updateActiveMode(session.user.id, mode)
        setProfile((current) => (current ? { ...current, active_mode: mode } : current))
      },
    }),
    [businessProfile, loading, profile, session],
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
