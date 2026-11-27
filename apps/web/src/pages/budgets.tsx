import { createRoute } from '@tanstack/react-router'
import { appRoute } from '@/components/layout'
import { MoneyViews } from '@/components/section-views'
import { BudgetLedger } from '@/components/budget-ledger'

function BudgetsPage() {
  const { view } = budgetsRoute.useSearch()
  const navigate = budgetsRoute.useNavigate()
  return (
    <div className="space-y-4 min-w-0">
      <MoneyViews active="budgets" budgetView={view} />
      <BudgetLedger
        focus={view ?? 'overall'}
        onFocus={(id) => {
          void navigate({ search: { view: id === 'overall' ? undefined : id } })
        }}
      />
    </div>
  )
}
export const budgetsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'budgets',
  validateSearch: (search: Record<string, unknown>): { view?: string } => ({
    view:
      typeof search.view === 'string' && /^(fund|project|allocation):[a-zA-Z0-9-]+$/.test(search.view)
        ? search.view
        : undefined,
  }),
  component: BudgetsPage,
})
