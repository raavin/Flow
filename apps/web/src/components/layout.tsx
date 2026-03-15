import { useEffect, useState } from 'react'
import { Link, Outlet, createRootRoute, createRoute, useNavigate } from '@tanstack/react-router'
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  CircleUserRound,
  LayoutGrid,
  MessageCircleMore,
  Palette,
  Search,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { AppButton, AppCard } from '@superapp/ui'
import { AppStoreProvider, useAppStore } from '@/hooks/useAppStore'

type Theme = 'quirky' | 'clean' | 'flow' | 'mono'

const THEMES: Theme[] = ['quirky', 'clean', 'flow', 'mono']
const THEME_LABELS: Record<Theme, string> = {
  quirky: 'Quirky',
  clean:  'Clean',
  flow:   'Flow',
  mono:   'Mono',
}

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('superapp-theme') as Theme) ?? 'mono'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('superapp-theme', theme)
  }, [theme])

  useEffect(() => {
    const saved = (localStorage.getItem('superapp-theme') as Theme) ?? 'mono'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function cycleTheme() {
    setThemeState((current) => {
      const idx = THEMES.indexOf(current)
      return THEMES[(idx + 1) % THEMES.length]
    })
  }

  return { theme, cycleTheme }
}

function RootComponent() {
  return (
    <AppStoreProvider>
      <div className="page-shell">
        <Outlet />
      </div>
    </AppStoreProvider>
  )
}

function AppLayout() {
  const { session, profile, businessProfile, signOut, setActiveMode, loading } = useAppStore()
  const navigate = useNavigate()
  const { theme, cycleTheme } = useTheme()

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: '/' })
    }
  }, [loading, navigate, session])

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/70">Loading...</div>
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <AppCard className="p-6">
          <p className="text-sm text-ink/70">Sign in or create an account to open the full app.</p>
          <Link to="/" className="mt-4 inline-flex rounded-full bg-ink px-4 py-3 text-sm font-bold text-white">
            Back to welcome
          </Link>
        </AppCard>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <AppCard className="p-6">
          <p className="text-sm text-ink/70">Your account is signed in, but setup is not complete yet.</p>
          <Link to="/onboarding" className="mt-4 inline-flex rounded-full bg-ink px-4 py-3 text-sm font-bold text-white">
            Finish onboarding
          </Link>
        </AppCard>
      </div>
    )
  }

  const coreNavItems =
    profile?.active_mode === 'business'
      ? [
          { to: '/app/messages', label: 'Messages', icon: MessageCircleMore },
          { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
          { to: '/app/jobs', label: 'Jobs', icon: BriefcaseBusiness },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/app/gantt', label: 'Timeline', icon: LayoutGrid },
        ]
      : [
          { to: '/app/messages', label: 'Messages', icon: MessageCircleMore },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/app/gantt', label: 'Timeline', icon: LayoutGrid },
          { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
        ]
  const commerceNavItems =
    profile?.active_mode === 'business'
      ? [
          { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/wallet', label: 'Wallet', icon: Wallet },
        ]
      : [
          { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/wallet', label: 'Wallet', icon: Wallet },
        ]
  const utilityNavItems = [
    { to: '/app/search', label: 'Search', icon: Search },
    { to: '/app/support', label: 'Support', icon: CircleHelp },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: profile?.active_mode === 'business' ? 'Profile & Admin' : 'Profile', icon: CircleUserRound },
    { to: '/app/ai', label: 'AI assistant', icon: Bot },
  ] as const

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-3 px-3 py-3 sm:px-4">
      <aside className="ui-shell-surface sticky top-3 flex h-[calc(100vh-1.5rem)] w-[76px] shrink-0 flex-col overflow-hidden sm:w-60">

        {/* Frozen header — stays put while nav scrolls underneath */}
        <div className="shrink-0 px-2.5 pt-1 pb-2 sm:px-3">
          <button type="button" className={`text-left ${theme === 'mono' ? 'hidden w-full sm:block' : 'flex items-center gap-3'}`} onClick={() => void navigate({ to: '/app/messages' })}>
            {theme === 'flow' ? (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold" style={{ background: '#C45A3B', color: '#F5F2ED', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>F</span>
                <span className="hidden text-base font-bold tracking-[0.18em] sm:block" style={{ color: '#F5F2ED', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>flow</span>
              </>
            ) : theme === 'mono' ? (
              <img src="/logo-flow.png" alt="flow" className="w-full px-2" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center bg-butter text-lg font-black text-ink shadow-sm" style={{ borderRadius: 'var(--radius-control)' }}>F</span>
            )}
          </button>
          {businessProfile?.business_name ? <p className="mt-1 hidden pl-3 text-sm font-bold text-ink/70 sm:block">{businessProfile.business_name}</p> : null}

          {profile?.account_mode === 'both' ? (
            <div className="mt-2 hidden rounded-full bg-white/80 p-1 sm:flex">
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${profile.active_mode === 'individual' ? 'bg-butter text-ink shadow-sm' : 'text-ink/60'}`}
                onClick={() => void setActiveMode('individual')}
              >
                Personal
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${profile.active_mode === 'business' ? 'bg-butter text-ink shadow-sm' : 'text-ink/60'}`}
                onClick={() => void setActiveMode('business')}
              >
                Business
              </button>
            </div>
          ) : null}
        </div>

        {/* Scrollable nav — slides under the frozen header */}
        <div className="ui-scrollbar-hidden flex flex-1 flex-col overflow-y-auto px-2.5 pb-4 sm:px-3">
          <nav className="grid gap-4">
            <div className="grid gap-2">
              <p className={`hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] sm:block ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}>Flow</p>
              {coreNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="ui-nav-link !flex-row !justify-start !gap-3 !text-sm"
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !flex-row !justify-start !gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>
            <div className="grid gap-2">
              <p className={`hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] sm:block ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}>Commerce</p>
              {commerceNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="ui-nav-link !flex-row !justify-start !gap-3 !text-sm"
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !flex-row !justify-start !gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>
          </nav>

          <div className="mt-auto pt-4 grid gap-4">
            <div className="grid gap-2">
              <p className={`hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] sm:block ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}>Profile & Support</p>
              {utilityNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="ui-nav-link !flex-row !justify-start !gap-3 !text-sm"
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !flex-row !justify-start !gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>

            {/* Theme cycle */}
            <button
              type="button"
              onClick={cycleTheme}
              className="ui-nav-link !flex-row !justify-start !gap-3 !text-sm w-full text-left"
              title={`Current: ${THEME_LABELS[theme]} — click to cycle`}
            >
              <Palette className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">{THEME_LABELS[theme]} theme</span>
            </button>

            <AppButton
              variant="ghost"
              className="justify-start"
              onClick={() => {
                void signOut().then(() => navigate({ to: '/' }))
              }}
            >
              Sign out
            </AppButton>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export const rootRoute = createRootRoute({
  component: RootComponent,
})

export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppLayout,
})
