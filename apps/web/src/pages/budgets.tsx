import { MoneyViews } from '@/components/section-views'
import { useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppCard, AppPanel, AppSelect, SectionHeading } from '@superapp/ui'
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
  const unset = rows.filter(row => row.project.budgetCents === null || row.project.budgetCents === undefined).length
  return <div className="space-y-4">
    <MoneyViews active="budgets"/>
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Money · AUD" title="Project budgets" />
      <p className="text-sm text-ink/70">Set limits, track costs and add receipts inside each project.</p>
      <AppSelect aria-label="Project scope" value={scope} onChange={e => setScope(e.target.value)}><option value="open">Active and upcoming projects</option><option value="all">All projects, including completed</option></AppSelect>
      {projects.isPending || expenses.isPending ? <p role="status">Loading budgets…</p> : projects.isError || expenses.isError ? <p role="alert">Budgets could not be loaded. Please refresh to try again.</p> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Budget limits', totals.budget], ['Forecast costs', totals.forecast], ['Paid', totals.paid], ['Still to cover', totals.remaining]].map(([label, value]) => <AppPanel key={label}><p className="text-sm text-ink/70">{label}</p><p className="text-xl font-bold">{formatCurrency(Number(value))}</p></AppPanel>)}</div>
        <p className="text-sm text-ink/70">{unset ? `${unset} project${unset === 1 ? ' has' : 's have'} no budget limit yet. ` : ''}Totals cover each selected project's full lifetime. Payments and IOUs are separate records, so they are not counted twice.</p>
        {rows.length ? <div className="grid gap-3 md:grid-cols-2">{rows.map(row => <Link key={row.project.id} to="/app/projects/$projectId/budget" params={{ projectId: row.project.id }} className="block rounded-panel focus-visible:outline focus-visible:outline-2">
          <AppPanel><h2 className="font-bold">{row.project.title}</h2><p className="text-sm text-ink/70">{row.project.category} · {row.project.status}</p><p className="mt-3 text-sm">Forecast {formatCurrency(row.forecast)} · Paid {formatCurrency(row.paid)}</p><p className="mt-1 text-sm font-semibold">{row.project.budgetCents == null ? 'Set a budget limit' : row.forecast > row.project.budgetCents ? `${formatCurrency(row.forecast - row.project.budgetCents)} over budget` : `${formatCurrency(row.project.budgetCents - row.forecast)} remaining`}</p><p className="mt-3 text-sm underline">Open budget →</p></AppPanel>
        </Link>)}</div> : <p className="text-sm">No projects in this view yet. <Link to="/app/projects" className="underline">Start a project</Link> or turn an idea from your conversations into a plan.</p>}
      </>}
    </AppCard>
  </div>
}

export const budgetsRoute = createRoute({ getParentRoute: () => appRoute, path: 'budgets', component: BudgetsPage })
