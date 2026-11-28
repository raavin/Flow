import { Link } from '@tanstack/react-router'
import { AppCard, SectionHeading } from '@superapp/ui'

export function IntegrationsPage() {
  return (
    <AppCard className="space-y-5">
      <SectionHeading level={1} title="Integrations" />
      <p className="text-sm text-ink/70">
        External account connections are not available yet. You can manage budgets, costs and receipts within
        Flow.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Integration availability</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="p-3">
                Service
              </th>
              <th scope="col" className="p-3">
                Purpose
              </th>
              <th scope="col" className="p-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Xero', 'Accounting'],
              ['MYOB', 'Accounting'],
              ['Shiftly', 'Rostering'],
            ].map(([service, purpose]) => (
              <tr key={service} className="border-b border-border">
                <th scope="row" className="p-3 font-semibold">
                  {service}
                </th>
                <td className="p-3">{purpose}</td>
                <td className="p-3">Not available</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link to="/app/budgets" className="ui-button ui-button--secondary">
        Open budgets
      </Link>
    </AppCard>
  )
}
