import { useEffect } from 'react'
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
  Search,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { AppButton, AppCard } from '@superapp/ui'
import { AppStoreProvider, useAppStore } from '@/hooks/useAppStore'

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

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: '/' })
    }
  }, [loading, navigate, session])

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/70">Warming up your cozy control panel...</div>
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
          { to: '/app/coordination', label: 'Flows', icon: LayoutGrid },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/app/gantt', label: 'Timeline', icon: LayoutGrid },
          { to: '/app/jobs', label: 'Jobs', icon: BriefcaseBusiness },
        ]
      : [
          { to: '/app/messages', label: 'Messages', icon: MessageCircleMore },
          { to: '/app/coordination', label: 'Flows', icon: LayoutGrid },
          { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/app/gantt', label: 'Timeline', icon: LayoutGrid },
          { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
        ]
  const commerceNavItems =
    profile?.active_mode === 'business'
      ? [
          { to: '/app/marketplace/services', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/wallet', label: 'Wallet', icon: Wallet },
        ]
      : [
          { to: '/app/marketplace/templates', label: 'Marketplace', icon: ShoppingBag },
          { to: '/app/wallet', label: 'Wallet', icon: Wallet },
        ]
  const utilityNavItems = [
    { to: '/app/home', label: 'Overview', icon: Search },
    { to: '/app/search', label: 'Search', icon: Search },
    { to: '/app/support', label: 'Support', icon: CircleHelp },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: profile?.active_mode === 'business' ? 'Profile & Admin' : 'Profile', icon: CircleUserRound },
    { to: '/app/ai', label: 'AI assistant', icon: Bot },
  ] as const

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-3 px-3 py-3 sm:px-4">
      <aside className="ui-shell-surface ui-scrollbar-hidden sticky top-3 flex h-[calc(100vh-1.5rem)] w-[76px] shrink-0 flex-col overflow-y-auto px-2.5 py-4 sm:w-60 sm:px-3">
        <div className="mb-4">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => void navigate({ to: '/app/messages' })}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-butter text-lg font-black text-ink shadow-sm">F</span>
          </button>
          {businessProfile?.business_name ? <p className="mt-1 hidden text-sm font-bold text-ink/70 sm:block">{businessProfile.business_name}</p> : null}
        </div>

        {profile?.account_mode === 'both' ? (
          <div className="mb-4 hidden rounded-full bg-white/80 p-1 sm:flex">
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

        <nav className="grid gap-4">
          <div className="grid gap-2">
            <p className="hidden px-3 text-[11px] font-black uppercase tracking-[0.24em] text-ink/40 sm:block">Flow</p>
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
            <p className="hidden px-3 text-[11px] font-black uppercase tracking-[0.24em] text-ink/40 sm:block">Commerce</p>
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

        <div className="mt-auto grid gap-4">
          <div className="grid gap-2">
            <p className="hidden px-3 text-[11px] font-black uppercase tracking-[0.24em] text-ink/40 sm:block">Profile & Support</p>
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
      </aside>

      <main className="min-w-0 flex-1 py-1">
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
