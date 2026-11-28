import { AppButton, AppCard } from '@superapp/ui'
export function AccountError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg p-6">
      <AppCard>
        <h1 className="text-xl font-bold">Account unavailable</h1>
        <p role="alert" className="my-4 text-sm">
          {message}
        </p>
        <AppButton onClick={onRetry}>Try again</AppButton>
      </AppCard>
    </div>
  )
}
