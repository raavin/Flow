import { AppButton } from '@superapp/ui'

export function QueryFeedback({ query }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown } }) {
  if (query.isPending) return <p role="status" className="text-sm text-ink/65">Loading…</p>
  if (!query.isError) return null
  return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-berry">Could not load this page.<AppButton variant="secondary" onClick={() => { void query.refetch() }}>Try again</AppButton></div>
}

export function MutationFeedback({ mutation, success }: { mutation: { isError: boolean; isPending: boolean; isSuccess: boolean }; success?: string }) {
  if (mutation.isError) return <p role="alert" className="text-sm text-berry">Changes could not be saved. Please try again.</p>
  if (mutation.isPending) return <p role="status" className="text-sm text-ink/65">Saving…</p>
  if (mutation.isSuccess && success) return <p role="status" className="text-sm text-teal">{success}</p>
  return null
}
