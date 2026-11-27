import { Link } from '@tanstack/react-router'
import { PageNavigation } from './page-navigation'
const linkClass = 'inline-flex min-h-11 items-center border-b-2 px-4 py-2 text-sm font-semibold'
const activeClass = 'border-ink text-ink'
const inactiveClass = 'border-transparent text-ink/65 hover:border-ink/30 hover:text-ink'
export function MoneyViews({ active, budgetView }: { active: 'budgets' | 'records'; budgetView?: string }) {
  return (
    <nav aria-label="Money views" className="flex border-b border-border">
      <Link
        to="/app/budgets"
        search={{ view: budgetView }}
        className={`${linkClass} ${active === 'budgets' ? activeClass : inactiveClass}`}
        aria-current={active === 'budgets' ? 'page' : undefined}
      >
        Overview
      </Link>
      <Link
        to="/app/wallet"
        search={{
          projectId: budgetView?.startsWith('project:') ? budgetView.slice(8) : undefined,
          fundId: budgetView?.startsWith('fund:') ? budgetView.slice(5) : undefined,
          scope: budgetView?.startsWith('project:') || budgetView?.startsWith('fund:') ? undefined : 'all',
        }}
        className={`${linkClass} ${active === 'records' ? activeClass : inactiveClass}`}
        aria-current={active === 'records' ? 'page' : undefined}
      >
        Activity
      </Link>
    </nav>
  )
}
export function ScheduleViews({ active }: { active: 'calendar' | 'timeline' }) {
  return (
    <nav aria-label="Schedule views" className="flex border-b border-border">
      <Link
        to="/app/calendar"
        className={`${linkClass} ${active === 'calendar' ? activeClass : inactiveClass}`}
        aria-current={active === 'calendar' ? 'page' : undefined}
      >
        Calendar
      </Link>
      <Link
        to="/app/gantt"
        className={`${linkClass} ${active === 'timeline' ? activeClass : inactiveClass}`}
        aria-current={active === 'timeline' ? 'page' : undefined}
      >
        Timeline
      </Link>
    </nav>
  )
}
export function MarketplaceViews({
  active,
  savedCount = 0,
}: {
  active: 'browse' | 'requests' | 'saved' | 'listings'
  savedCount?: number
}) {
  const pages = [
    { key: 'browse', label: 'Browse', to: '/app/marketplace' },
    { key: 'requests', label: 'Requests & quotes', to: '/app/marketplace/requests' },
    { key: 'saved', label: 'Saved items', to: '/app/marketplace/cart' },
    { key: 'listings', label: 'My listings', to: '/app/marketplace/manage' },
  ] as const
  return (
    <PageNavigation
      label="Marketplace navigation"
      compactLabel="Marketplace page"
      currentPage={pages.find((page) => page.key === active)!.label}
    >
      {pages.map((page) => (
        <Link
          key={page.key}
          to={page.to}
          search={{}}
          activeOptions={{ exact: true }}
          aria-current={page.key === active ? 'page' : undefined}
          className={`flow-page-link ${page.key === active ? 'flow-page-link--active' : ''}`}
        >
          {page.label}
          {page.key === 'saved' && savedCount > 0 ? ` (${savedCount})` : ''}
        </Link>
      ))}
    </PageNavigation>
  )
}
export function navSection(path: string) {
  if (path === '/app/home') return '/app/messages'
  if (path === '/app/wallet' || path === '/app/budgets') return '/app/budgets'
  if (path === '/app/gantt' || path === '/app/calendar') return '/app/calendar'
  if (path.startsWith('/app/projects/')) return '/app/projects'
  if (path.startsWith('/app/messages/')) return '/app/messages'
  if (path.startsWith('/app/marketplace/')) return '/app/marketplace'
  if (path.startsWith('/app/business/')) return '/app/marketplace'
  if (path.startsWith('/app/jobs/')) return '/app/jobs'
  if (path.startsWith('/app/coordination/')) return '/app/coordination'
  if (path === '/app/ai' || path === '/app/template-editor') return '/app/coordination'
  return path
}
