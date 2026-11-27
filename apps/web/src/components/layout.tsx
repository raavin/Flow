import { useEffect, useState } from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  CircleUserRound,
  House,
  ListTodo,
  MessageCircleMore,
  MoreHorizontal,
  Plug,
  Search,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { AppButton, AppCard } from '@superapp/ui'
import { AppStoreProvider, useAppStore } from '@/hooks/useAppStore'
import { THEMES, THEME_LABELS, useTheme } from '@/hooks/useTheme'
import { navSection } from './section-views'
import { AppDialog } from './app-dialog'

function RootComponent() {
  return (
    <AppStoreProvider>
      <div className="page-shell">
        <Outlet />
      </div>
    </AppStoreProvider>
  )
}
const coreNav = [
  { to: '/app/messages', label: 'Home', icon: House },
  { to: '/app/search', label: 'Explore', icon: Search },
  { to: '/app/messages/dm', label: 'Messages', icon: MessageCircleMore },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/projects', label: 'Projects', icon: BriefcaseBusiness },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
] as const
const extraNav = [
  { to: '/app/coordination', label: 'My tasks', icon: ListTodo },
  { to: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/app/budgets', label: 'Money', icon: Wallet },
  { to: '/app/settings', label: 'Settings', icon: CircleUserRound },
  { to: '/app/integrations', label: 'Connections', icon: Plug },
  { to: '/app/support', label: 'Help', icon: CircleHelp },
] as const
function AppLayout() {
  const { session, profile, signOut, setActiveMode, loading } = useAppStore()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const activeSection = navSection(pathname)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => {
    if (!loading && !session) void navigate({ to: '/' })
  }, [loading, navigate, session])
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])
  if (loading)
    return (
      <p role="status" className="p-6">
        Loading…
      </p>
    )
  if (!session || !profile)
    return (
      <AppCard>
        <p>{session ? 'Finish setting up your profile.' : 'Sign in to continue.'}</p>
        <Link to={session ? '/onboarding' : '/'}>Continue</Link>
      </AppCard>
    )
  const utilities = (
    <>
      {profile.account_mode === 'both' && (
        <label className="grid gap-1 text-sm">
          Account
          <select
            className="ui-input min-h-11"
            value={profile.active_mode}
            onChange={(e) => void setActiveMode(e.target.value as 'individual' | 'business')}
          >
            <option value="individual">Personal</option>
            <option value="business">Business</option>
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm">
        Appearance
        <select
          className="ui-input min-h-11"
          value={theme}
          onChange={(e) => setTheme(e.target.value as typeof theme)}
        >
          {THEMES.map((value) => (
            <option key={value} value={value}>
              {THEME_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <AppButton variant="ghost" onClick={() => void signOut().then(() => navigate({ to: '/' }))}>
        Sign out
      </AppButton>
    </>
  )
  const links = (items: readonly { to: string; label: string; icon: typeof House }[]) =>
    items.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        aria-current={activeSection === to ? 'page' : undefined}
        className={`ui-nav-link min-h-11 ${activeSection === to ? 'ui-nav-link--active' : ''}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </Link>
    ))
  return (
    <div className="app-layout mx-auto flex min-h-screen max-w-7xl gap-4 px-3 py-3 sm:px-4">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="ui-shell-surface sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-56 shrink-0 flex-col overflow-y-auto lg:flex">
        <Link
          to="/app/messages"
          aria-label="Flow home"
          className="mb-5 inline-flex px-3 py-2 text-3xl font-bold"
        >
          flow
        </Link>
        <nav aria-label="Main navigation" className="grid gap-1">
          {links(coreNav)}
        </nav>
        <div className="my-4 border-t border-border" />
        <nav aria-label="More pages" className="grid gap-1">
          {links(extraNav.slice(0, 3))}
          {profile.active_mode === 'business' && (
            <Link to="/app/jobs" className="ui-nav-link">
              <BriefcaseBusiness size={20} />
              Jobs
            </Link>
          )}
        </nav>
        <details className="mt-auto pt-4">
          <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold">
            {profile.first_name || 'Account'}
          </summary>
          <div className="grid gap-3 pb-3">
            {links(extraNav.slice(3))}
            {utilities}
          </div>
        </details>
      </aside>
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <header className="mb-3 flex items-center justify-between lg:hidden">
          <Link to="/app/messages" className="text-2xl font-bold">
            flow
          </Link>
          <Link
            to="/app/notifications"
            aria-label="Notifications"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
          >
            <Bell size={22} />
          </Link>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0">
          <Outlet />
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-white lg:hidden"
      >
        {coreNav
          .filter((item) => ['Home', 'Explore', 'Messages', 'Projects'].includes(item.label))
          .map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={activeSection === to ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${activeSection === to ? 'font-bold text-ink' : 'text-ink/60'}`}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ))}
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs"
        >
          <MoreHorizontal size={22} />
          <span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <AppDialog title="More" onClose={() => setMoreOpen(false)}>
          <nav className="grid gap-1">
            {links([coreNav[5], ...extraNav])}
            {profile.active_mode === 'business' && (
              <Link to="/app/jobs" className="ui-nav-link">
                Jobs
              </Link>
            )}
          </nav>
          <div className="mt-4 grid gap-3 border-t border-border pt-4">{utilities}</div>
        </AppDialog>
      )}
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
