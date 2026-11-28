import { useSyncExternalStore } from 'react'
import { optimisticWrites } from '@/lib/optimistic'

export function WriteStatus() {
  const { pending, failed } = useSyncExternalStore(optimisticWrites.subscribe, optimisticWrites.getSnapshot)
  if (!pending && !failed) return null
  return (
    <div className="ui-card fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] !p-3 text-sm shadow-lg">
      {failed ? (
        <div role="alert" className="flex items-center gap-3">
          <span>A change could not be saved. Check the entry and try again.</span>
          <button type="button" className="underline min-h-8" onClick={optimisticWrites.dismissError}>
            Dismiss
          </button>
        </div>
      ) : (
        <p role="status">Saving changes…</p>
      )}
    </div>
  )
}
