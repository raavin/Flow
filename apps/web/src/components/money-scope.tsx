import { useState } from 'react'
import { AppButton } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
export function useMoneyScope(initialProject?: string) {
  const { session } = useAppStore()
  const key = `flow:money-projects:${session?.user.id ?? 'anonymous'}`
  const [ids, setIds] = useState<string[]>(() => {
    if (initialProject) return [initialProject]
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(value)
        ? value.filter((id) => typeof id === 'string')
        : []
    } catch {
      return []
    }
  })
  function change(next: string[]) {
    setIds(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* Filtering still works when browser storage is unavailable. */
    }
  }
  return [ids, change] as const
}
export function MoneyProjectFilter({
  projects,
  selected,
  onChange,
}: {
  projects: { id: string; title: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <details className="relative w-full max-w-full sm:w-auto">
      <summary className="ui-button ui-button--secondary cursor-pointer">
        {!selected.length
          ? 'All projects'
          : selected.length === 1
            ? (projects.find((p) => p.id === selected[0])?.title ??
              'Selected project')
            : `${selected.length} projects`}
      </summary>
      <div
        className="absolute left-0 sm:left-auto sm:right-0 z-20 mt-2 max-h-80 w-full sm:w-72 sm:max-w-[80vw] space-y-2 overflow-auto border border-border p-3 shadow-lg"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
      >
        <AppButton type="button" variant="ghost" onClick={() => onChange([])}>
          Show all projects
        </AppButton>
        {projects.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 py-1 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, p.id]
                    : selected.filter((id) => id !== p.id),
                )
              }
            />
            {p.title}
          </label>
        ))}
      </div>
    </details>
  )
}
