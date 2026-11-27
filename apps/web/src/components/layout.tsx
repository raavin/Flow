import { navSection } from './section-views'
import { useEffect } from 'react'
import { Link, Outlet, createRootRoute, createRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  CircleUserRound,
  LayoutGrid,
  MessageCircleMore,
  Palette,
  Plug,
  Search,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { AppButton, AppCard } from '@superapp/ui'
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
  const { session, profile, businessProfile, signOut, setActiveMode, loading } = useAppStore()
  const activeSection = useRouterState({ select: state => navSection(state.location.pathname) })
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
          { to: '/app/coordination', label: 'Plans', icon: LayoutGrid },
          { to: '/app/jobs', label: 'Jobs', icon: BriefcaseBusiness },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
        ]
      : [
          { to: '/app/messages', label: 'Messages', icon: MessageCircleMore },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
          { to: '/app/coordination', label: 'Plans', icon: LayoutGrid },
        ]
  const commerceNavItems =
    profile?.active_mode === 'business'
      ? [
          { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/budgets', label: 'Money', icon: Wallet },
        ]
      : [
          { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/budgets', label: 'Money', icon: Wallet },
        ]
  const utilityNavItems = [
    { to: '/app/search', label: 'Search', icon: Search },
    { to: '/app/support', label: 'Support', icon: CircleHelp },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: profile?.active_mode === 'business' ? 'Profile & Admin' : 'Profile', icon: CircleUserRound },
    { to: '/app/integrations', label: 'Integrations', icon: Plug },
  ] as const

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-3 px-3 py-3 sm:px-4">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3">Skip to content</a>
      <aside className="ui-shell-surface sticky top-3 flex h-[calc(100vh-1.5rem)] w-[76px] shrink-0 flex-col overflow-hidden !px-0 sm:!px-4 sm:w-60">

        {/* Frozen header — stays put while nav scrolls underneath */}
        <div className="shrink-0 px-2.5 pt-1 pb-2 sm:px-3">
          <button type="button" aria-label="Flow home" className={`text-left ${theme === 'mono' ? 'hidden w-full sm:block' : 'flex items-center gap-3'}`} onClick={() => void navigate({ to: '/app/messages' })}>
            {theme === 'flow' ? (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold" style={{ background: '#C45A3B', color: '#F5F2ED', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>F</span>
                <span className="hidden text-base font-bold tracking-[0.18em] sm:block" style={{ color: '#F5F2ED', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>flow</span>
              </>
            ) : theme === 'mono' ? (
              <img src="/logo-flow.png" alt="flow" className="w-28 px-2 py-2" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center bg-butter text-lg font-black text-ink shadow-sm" style={{ borderRadius: 'var(--radius-control)' }}>F</span>
            )}
          </button>
          {businessProfile?.business_name ? <p className={`mt-1 hidden pl-3 text-sm font-bold sm:block ${theme === 'flow' ? 'text-white/70' : 'text-ink/70'}`}>{businessProfile.business_name}</p> : null}

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

        {profile.account_mode === 'both' && <label className="px-2 pb-2 text-[10px] sm:hidden">Mode
          <select aria-label="Account mode" className="w-full bg-transparent py-2 text-[10px]" value={profile.active_mode} onChange={e => void setActiveMode(e.target.value as 'individual' | 'business')}>
            <option value="individual">Personal</option><option value="business">Business</option>
          </select>
        </label>}
        {/* Scrollable nav — slides under the frozen header */}
        <div className="ui-scrollbar-hidden flex flex-1 flex-col overflow-y-auto px-1 pb-4 sm:px-3">
          <nav aria-label="Main navigation" className="grid gap-4">
            <div className="grid gap-2">
              <p className={`hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] sm:block ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}>Flow</p>
              {coreNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  title={label}
                  className={`ui-nav-link !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[9px] leading-tight sm:text-sm">{label}</span>
                </Link>
              ))}
            </div>
            <div className="grid gap-2">
              <p className={`hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] sm:block ${theme === 'flow' ? 'text-white/30' : 'text-ink/30'}`}>Marketplace &amp; money</p>
              {commerceNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  title={label}
                  className={`ui-nav-link !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[9px] leading-tight sm:text-sm">{label}</span>
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
                  aria-label={label}
                  title={label}
                  className={`ui-nav-link !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm ${activeSection === to ? 'ui-nav-link--active' : ''}`}
                  activeProps={{
                    className: 'ui-nav-link ui-nav-link--active !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm',
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[9px] leading-tight sm:text-sm">{label}</span>
                </Link>
              ))}
            </div>

            {/* Theme cycle */}
            <button
              type="button"
              onClick={cycleTheme}
              className="ui-nav-link !px-1 sm:!px-3 !flex-col sm:!flex-row !justify-start !gap-1 sm:!gap-3 !text-sm w-full text-left"
              aria-label={`Change theme. Current: ${THEME_LABELS[theme]}`}
              title={`Current: ${THEME_LABELS[theme]} — click to cycle`}
            >
              <Palette className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">{THEME_LABELS[theme]} theme</span>
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
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
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
