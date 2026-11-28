import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, SectionHeading } from '@superapp/ui'

import { ApplyTemplateDialog } from '@/components/apply-template-dialog'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchCoordinationTemplates, seedStarterCoordinationTemplates } from '@/lib/coordination-objects'
import type { CoordinationTemplate } from '@superapp/types'
export function PlanningHelperPage() {
  const { session } = useAppStore()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CoordinationTemplate | null>(null)
  const templates = useQuery({
    queryKey: ['coordination-templates'],
    queryFn: fetchCoordinationTemplates,
  })
  const seed = useMutation({
    mutationFn: () => seedStarterCoordinationTemplates(session!.user.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coordination-templates'] })
    },
  })
  const matches = (templates.data ?? []).filter((t) =>
    `${t.title} ${t.summary ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading
          title="Templates"
          action={
            <Link to="/app/template-editor" className="inline-flex min-h-11 items-center text-sm underline">
              Create template
            </Link>
          }
        />
        <div className="flex flex-wrap gap-3">
          <AppInput
            aria-label="Search templates"
            className="min-w-0 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
          />
          <AppButton variant="secondary" disabled={seed.isPending} onClick={() => seed.mutate()}>
            Add starter templates
          </AppButton>
        </div>
        <QueryFeedback query={templates} />
        <MutationFeedback mutation={seed} />
        <Link to="/app/marketplace/templates" className="inline-flex min-h-11 items-center text-sm underline">
          Community templates
        </Link>
      </AppCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {matches.map((template) => (
          <AppCard key={template.id} className="space-y-3">
            <h2 className="text-lg font-semibold">{template.title}</h2>
            <p className="text-sm text-ink/65">{template.summary}</p>
            <ol className="space-y-2 text-sm">
              {template.blocks.slice(0, 4).map((step, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span>{step.title}</span>
                  <span className="shrink-0 text-ink/60">
                    {(step.offsetDays ?? 0) < 0
                      ? `${Math.abs(step.offsetDays ?? 0)} days before`
                      : (step.offsetDays ?? 0) > 0
                        ? `${step.offsetDays} days after`
                        : 'On the day'}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60">{template.blocks.length} steps</span>
              <AppButton onClick={() => setSelected(template)}>Use template</AppButton>
            </div>
          </AppCard>
        ))}
      </div>
      {!templates.isPending && !templates.isError && !matches.length && (
        <AppCard>
          {search
            ? 'No matching templates.'
            : 'Add starter templates for birthdays, weddings, moving and business projects.'}
        </AppCard>
      )}
      {selected && <ApplyTemplateDialog template={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// Preserve existing bookmarks while replacing the prototype AI surface.
