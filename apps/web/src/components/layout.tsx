import { AccountError } from './account-error'
import { appDestination } from '@/lib/navigation'
import { navSection } from './section-views'
import { WriteStatus } from './write-status'
import { useEffect, useState } from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  CircleUserRound,
  LayoutGrid,
  MessageCircleMore,
  Menu,
  Palette,
  Plug,
  Search,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { AppButton, AppCard } from '@superapp/ui'
import { AppDialog } from './app-dialog'
import { AppStoreProvider, useAppStore } from '@/hooks/useAppStore'

import { THEME_LABELS, useTheme } from '@/hooks/useTheme'

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
  const { session, profile, businessProfile, signOut, setActiveMode, loading, accountError, retryAccount } =
    useAppStore()
  const destination = useRouterState({ select: (state) => appDestination(state.location.href) })
  const activeSection = useRouterState({ select: (state) => navSection(state.location.pathname) })
  const navigate = useNavigate()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, cycleTheme } = useTheme()

  useEffect(() => {
    if (!loading && !session && !accountError) {
      void navigate({ to: '/', search: { returnTo: destination }, replace: true })
    }
  }, [accountError, destination, loading, navigate, session])

  useEffect(() => router.subscribe('onBeforeNavigate', () => setMenuOpen(false)), [router])

  useEffect(() => {
    if (!window.matchMedia) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/70">Loading...</div>
  }

  if (accountError) return <AccountError message={accountError} onRetry={retryAccount} />

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <AppCard className="p-6">
          <p className="text-sm text-ink/70">Sign in or create an account to open the full app.</p>
          <Link
            to="/"
            search={{ returnTo: destination }}
            className="mt-4 inline-flex rounded-full bg-ink px-4 py-3 text-sm font-bold text-white"
          >
            Sign in
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
          <Link
            to="/onboarding"
            search={{ returnTo: destination }}
            className="mt-4 inline-flex rounded-full bg-ink px-4 py-3 text-sm font-bold text-white"
          >
            Finish onboarding
          </Link>
        </AppCard>
      </div>
    )
  }

  // Keep the common workflow in the same order in Personal and Business mode.
  const coreNavItems = [
    { to: '/app/messages', label: 'Messages', icon: MessageCircleMore },
    { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
    { to: '/app/coordination', label: 'Plans', icon: LayoutGrid },
    { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
    ...(profile.active_mode === 'business'
      ? [{ to: '/app/jobs', label: 'Jobs', icon: BriefcaseBusiness }]
      : []),
  ]
  const commerceNavItems = [
    { to: '/app/budgets', label: 'Money', icon: Wallet },
    { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
  ]
  const utilityNavItems = [
    { to: '/app/search', label: 'Search', icon: Search },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    {
      to: '/app/settings',
      label: profile?.active_mode === 'business' ? 'Profile & Admin' : 'Profile',
      icon: CircleUserRound,
    },
    { to: '/app/integrations', label: 'Integrations', icon: Plug },
    { to: '/app/support', label: 'Support', icon: CircleHelp },
  ] as const

  const currentSection =
    [...coreNavItems, ...commerceNavItems, ...utilityNavItems].find((item) => item.to === activeSection)
      ?.label ?? 'Flow'
  const navigation = (
    <>
      {/* Frozen header — stays put while nav scrolls underneath */}
      <div className="shrink-0 px-2.5 pt-1 pb-2 sm:px-3">
        <button
          type="button"
          aria-label="Flow home"
          className="flex items-center gap-3 text-left"
          onClick={() => void navigate({ to: '/app/messages' })}
        >
          {theme === 'flow' ? (
            <>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold"
                style={{
                  background: '#C45A3B',
                  color: '#F5F2ED',
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                }}
              >
                F
              </span>
              <span
                className="text-base font-bold tracking-[0.18em]"
                style={{ color: '#F5F2ED', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                flow
              </span>
            </>
          ) : theme === 'mono' ? (
            <img src="/logo-flow.png" alt="flow" className="w-28 px-2 py-2" />
          ) : (
            <span
              className="flex h-11 w-11 items-center justify-center bg-butter text-lg font-black text-ink shadow-sm"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              F
            </span>
          )}
        </button>
        {businessProfile?.business_name ? (
          <p className={`mt-1 pl-3 text-sm font-bold ${theme === 'flow' ? 'text-white/70' : 'text-ink/70'}`}>
            {businessProfile.business_name}
          </p>
        ) : null}

        {profile?.account_mode === 'both' ? (
          <div className="mt-2 flex rounded-full bg-white/80 p-1">
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${profile.active_mode === 'individual' ? 'bg-butter text-ink shadow-sm' : 'text-ink/60'}`}
              onClick={() => void setActiveMode('individual').catch(() => undefined)}
            >
              Personal
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${profile.active_mode === 'business' ? 'bg-butter text-ink shadow-sm' : 'text-ink/60'}`}
              onClick={() => void setActiveMode('business').catch(() => undefined)}
            >
              Business
            </button>
          </div>
        ) : null}
      </div>

      {/* Scrollable nav — slides under the frozen header */}
      <div className="ui-scrollbar-hidden flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        <nav aria-label="Main navigation" className="grid gap-4">
          <div className="grid gap-2">
            <p
              className={`px-3 text-[10px] font-bold uppercase tracking-[0.18em] ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}
            >
              Flow
            </p>
            {coreNavItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                aria-label={label}
                title={label}
                aria-current={activeSection === to ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={`ui-nav-link !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                activeProps={{
                  className:
                    'ui-nav-link ui-nav-link--active !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left',
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            ))}
          </div>
          <div className="grid gap-2">
            <p
              className={`px-3 text-[10px] font-bold uppercase tracking-[0.18em] ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}
            >
              Money &amp; marketplace
            </p>
            {commerceNavItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                aria-label={label}
                title={label}
                aria-current={activeSection === to ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={`ui-nav-link !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                activeProps={{
                  className:
                    'ui-nav-link ui-nav-link--active !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left',
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-auto pt-4 grid gap-4">
          <div className="grid gap-2">
            <p
              className={`px-3 text-[10px] font-bold uppercase tracking-[0.18em] ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}
            >
              Account
            </p>
            {utilityNavItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                aria-label={label}
                title={label}
                aria-current={activeSection === to ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={`ui-nav-link !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                activeProps={{
                  className:
                    'ui-nav-link ui-nav-link--active !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left',
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            ))}
          </div>

          {/* Theme cycle */}
          <button
            type="button"
            onClick={cycleTheme}
            className="ui-nav-link !min-h-11 !flex-row !justify-start !gap-3 !px-3 !text-sm !text-left w-full text-left"
            aria-label={`Change theme. Current: ${THEME_LABELS[theme]}`}
            title={`Current: ${THEME_LABELS[theme]} — click to cycle`}
          >
            <Palette className="h-5 w-5 shrink-0" />
            <span>{THEME_LABELS[theme]} theme</span>
          </button>

          <AppButton
            variant="ghost"
            className={`justify-start ${theme === 'flow' ? '!text-white/70' : ''}`}
            onClick={() => {
              void signOut().then(() => navigate({ to: '/' }))
            }}
          >
            Sign out
          </AppButton>
        </div>
      </div>
    </>
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <header className="ui-card sticky top-0 z-40 flex items-center justify-between gap-3 !p-3 lg:hidden">
        <Link to="/app/messages" aria-label="Flow home" className="flex min-h-11 items-center gap-3">
          <img src="/logo-flow.png" alt="flow" className="w-20" />
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{currentSection}</span>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className="ui-button ui-button--ghost min-h-11 gap-2"
          onClick={() => setMenuOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
          Menu
        </button>
      </header>
      <aside className="ui-shell-surface sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-60 shrink-0 flex-col overflow-hidden !px-4 lg:flex">
        {navigation}
      </aside>
      {menuOpen ? (
        <AppDialog title="Menu" onClose={() => setMenuOpen(false)} flush>
          <div className="ui-shell-surface flex min-w-0 flex-col !rounded-none !border-0 !shadow-none">
            {navigation}
          </div>
        </AppDialog>
      ) : null}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        <WriteStatus />
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
