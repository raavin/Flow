import { budgetsRoute } from '@/route-definitions'

import { MoneyViews } from '@/components/section-views'
import { BudgetLedger } from '@/components/budget-ledger'

export function BudgetsPage() {
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
