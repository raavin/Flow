import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { AppButton, AppInput, AppSelect } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
export function useMoneyScope(initialProject?: string) {
  const { session } = useAppStore()
  const key = `flow:money-projects:${session?.user.id ?? 'anonymous'}`
  const [ids, setIds] = useState<string[]>(() => {
    if (initialProject) return [initialProject]
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
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
  label,
}: {
  label?: string
  projects: { id: string; title: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const groups = useQuery({
    queryKey: ['budget-groups', session?.user.id],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('budget_groups').select('id,name,project_ids').order('name')
      if (error) throw error
      return data ?? []
    },
  })
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from('budget_groups').upsert(
        {
          owner_id: session!.user.id,
          name: name.trim(),
          project_ids: selected,
        },
        { onConflict: 'owner_id,name' },
      )
      if (error) throw error
    },
    onSuccess: () => {
      setName('')
      void client.invalidateQueries({ queryKey: ['budget-groups'] })
    },
  })
  return (
    <details className="relative w-full max-w-full sm:w-auto">
      <summary className="ui-button ui-button--secondary cursor-pointer">
        {label ??
          (!selected.length
            ? 'All projects'
            : selected.length === 1
              ? (projects.find((p) => p.id === selected[0])?.title ?? 'Selected project')
              : `${selected.length} projects`)}
      </summary>
      <div
        className="absolute left-0 sm:left-auto sm:right-0 z-20 mt-2 max-h-80 w-full sm:w-72 sm:max-w-[80vw] space-y-2 overflow-auto border border-border p-3 shadow-lg"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
      >
        <label className="grid gap-1 text-sm">
          Saved view
          <AppSelect
            value=""
            onChange={(e) => {
              const group = groups.data?.find((g) => g.id === e.target.value)
              if (group) onChange(group.project_ids)
            }}
          >
            <option value="">Choose view</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </AppSelect>
        </label>
        <AppButton type="button" variant="ghost" onClick={() => onChange([])}>
          Show all projects
        </AppButton>
        {projects.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            />
            {p.title}
          </label>
        ))}
        {!!selected.length && (
          <form
            className="grid gap-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <AppInput
              aria-label="View name"
              maxLength={80}
              placeholder="Save this selection"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <AppButton type="submit" variant="secondary" disabled={!name.trim() || save.isPending}>
              Save view
            </AppButton>
            {save.isError && <p role="alert">Could not save this view.</p>}
          </form>
        )}
      </div>
    </details>
  )
}
