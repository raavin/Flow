import { MoneyViews } from '@/components/section-views'
import { useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppCard, AppSelect, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { fetchProjects } from '@/lib/projects'
import { fetchExpenses } from '@/lib/planning'
import { summarizeCosts } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'

function BudgetsPage() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const expenses = useQuery({ queryKey: ['expenses', 'all'], queryFn: () => fetchExpenses() })
  const [scope, setScope] = useState('open')
  const rows = (projects.data ?? []).filter(project => scope === 'all' || project.status !== 'completed').map(project => ({
    project, ...summarizeCosts((expenses.data ?? []).filter(cost => cost.project_id === project.id)),
  }))
  const totals = rows.reduce((sum, row) => ({ budget: sum.budget + (row.project.budgetCents ?? 0), forecast: sum.forecast + row.forecast, paid: sum.paid + row.paid, remaining: sum.remaining + row.remaining }), { budget: 0, forecast: 0, paid: 0, remaining: 0 })
  const unset = rows.filter(row => row.project.budgetCents == null).length

  return <div className="space-y-4 min-w-0">
    <MoneyViews active="budgets" />
    <AppCard className="min-w-0 space-y-4">
      <SectionHeading eyebrow="Money · AUD" title="Project budgets" action={
        <div className="w-56 max-w-full"><AppSelect aria-label="Project scope" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="open">Active and upcoming</option>
          <option value="all">All projects</option>
        </AppSelect></div>
      } />
      <p className="text-sm text-ink/70">Select a project to manage its costs and receipts.</p>
      {projects.isPending || expenses.isPending ? <p role="status">Loading budgets…</p> : projects.isError || expenses.isError ? <p role="alert">Budgets could not be loaded. Please refresh to try again.</p> : rows.length ? <>
        <div className="ui-ledger-shell relative" role="region" aria-label="Project budgets table" tabIndex={0}>
          <table className="ui-budget-table min-w-[760px]">
            <caption className="sr-only">Project budgets in Australian dollars</caption>
            <thead><tr>
              <th scope="col">Project</th>
              <th scope="col" className="budget-money">Budget</th>
              <th scope="col" className="budget-money">Forecast</th>
              <th scope="col" className="budget-money">Paid</th>
              <th scope="col" className="budget-money">To pay</th>
              <th scope="col" className="budget-money">Budget left</th>
            </tr></thead>
            <tbody>{rows.map(row => {
              const balance = row.project.budgetCents == null ? null : row.project.budgetCents - row.forecast
              return <tr key={row.project.id}>
                <th scope="row" className="min-w-52 font-normal">
                  <Link to="/app/projects/$projectId/budget" params={{ projectId: row.project.id }} className="font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink">{row.project.title}</Link>
                  <p className="mt-1 text-xs font-normal text-ink/65">{[row.project.category, row.project.status.charAt(0).toUpperCase() + row.project.status.slice(1)].filter(Boolean).join(' · ')}</p>
                </th>
                <td className="budget-money">{row.project.budgetCents == null ? <span className="text-ink/60">Not set</span> : formatCurrency(row.project.budgetCents)}</td>
                <td className="budget-money">{formatCurrency(row.forecast)}</td>
                <td className="budget-money">{formatCurrency(row.paid)}</td>
                <td className="budget-money">{formatCurrency(row.remaining)}</td>
                <td className={`budget-money ${balance !== null && balance < 0 ? 'text-berry font-semibold' : ''}`}>
                  {balance === null ? <span aria-label="Budget not set">—</span> : <>{formatCurrency(balance)}{balance < 0 ? <span className="block text-xs">Over budget</span> : null}</>}
                </td>
              </tr>
            })}</tbody>
            <tfoot><tr>
              <th scope="row">Total</th>
              <td className="budget-money">{formatCurrency(totals.budget)}{unset ? <span className="block text-xs font-normal">Set limits only</span> : null}</td>
              <td className="budget-money">{formatCurrency(totals.forecast)}</td>
              <td className="budget-money">{formatCurrency(totals.paid)}</td>
              <td className="budget-money">{formatCurrency(totals.remaining)}</td>
              <td className={`budget-money ${!unset && totals.forecast > totals.budget ? 'text-berry' : ''}`}>{unset ? <span aria-label="Some projects have no budget limit">—</span> : formatCurrency(totals.budget - totals.forecast)}</td>
            </tr></tfoot>
          </table>
        </div>
        <p className="text-xs text-ink/65">Budget left is the limit minus forecast costs. To pay is the forecast for costs not marked paid.</p>
        <p className="text-xs text-ink/65">{unset ? `${unset} project${unset === 1 ? ' has' : 's have'} no budget limit. ` : ''}Totals cover the selected projects’ full lifetime. Separate payment records are not added to these totals.</p>
      </> : <p className="text-sm">No projects in this view yet. <Link to="/app/projects" className="underline">Start a project</Link> to set a budget.</p>}
    </AppCard>
  </div>
}

export const budgetsRoute = createRoute({ getParentRoute: () => appRoute, path: 'budgets', component: BudgetsPage })
