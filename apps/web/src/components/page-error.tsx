import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { AppButton, AppCard } from '@superapp/ui'
import { useQueryClient } from '@tanstack/react-query'

// Keep a page failure inside its route so the sidebar remains available.
export function PageError({ reset }: ErrorComponentProps) {
  const client = useQueryClient()
  async function retry() {
    // The failed route has unmounted. Drop its stale data before mounting it again.
    await client.resetQueries({ type: 'inactive' })
    reset()
  }
  return (
    <AppCard className="space-y-4">
      <div role="alert">
        <h1 className="text-xl font-bold">This page could not be opened</h1>
        <p className="mt-2 text-sm text-ink/70">Try again, or use the menu to open another page.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <AppButton onClick={() => void retry()}>Try again</AppButton>
        <Link to="/app/messages" className="ui-button ui-button--secondary">
          Back to messages
        </Link>
      </div>
    </AppCard>
  )
}
