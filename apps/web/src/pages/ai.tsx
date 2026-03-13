import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppPanel, AppPill, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { acceptAiAction, createAiSuggestions, fetchAiActions, updateAiActionStatus } from '@/lib/ai'
import { fetchProjects } from '@/lib/projects'

function AiPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [prompt, setPrompt] = useState('')
  const [projectId, setProjectId] = useState('')
  const actionsQuery = useQuery({
    queryKey: ['ai-actions', projectId || 'global'],
    queryFn: () => fetchAiActions(projectId || undefined),
  })
  const createMutation = useMutation({
    mutationFn: () =>
      createAiSuggestions({
        ownerId: session!.user.id,
        linkedProjectId: projectId || null,
        prompt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-actions', projectId || 'global'] })
    },
  })
  const acceptMutation = useMutation({
    mutationFn: (action: { id: string; suggestion_type: string; suggestion_title: string }) =>
      acceptAiAction({
        ownerId: session!.user.id,
        actionId: action.id,
        linkedProjectId: projectId || null,
        suggestionType: action.suggestion_type,
        suggestionTitle: action.suggestion_title,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-actions', projectId || 'global'] })
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
  const ignoreMutation = useMutation({
    mutationFn: (id: string) => updateAiActionStatus(id, 'ignored'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-actions', projectId || 'global'] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="AI assistant" title="Global and project help" />
        <AppTextarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-32" />
        <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">No project context</option>
          {(projectsQuery.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </AppSelect>
        <div className="flex flex-wrap gap-2">
          {['plan something', 'optimize schedule', 'draft message', 'estimate costs', 'suggest providers', 'what am I missing?'].map((chip) => (
            <button key={chip} onClick={() => setPrompt(chip)}>
              <AppPill tone="butter">{chip}</AppPill>
            </button>
          ))}
        </div>
        <AppButton onClick={() => createMutation.mutate()} disabled={!session}>
          Generate suggestions
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Recommendations" title="Recent AI actions" />
        <div className="grid gap-3">
          {(actionsQuery.data ?? []).map((action) => (
            <AppPanel key={action.id}>
              <p className="font-extrabold text-ink">{action.suggestion_title}</p>
              <p className="text-sm text-ink/65">{action.suggestion_detail}</p>
              <p className="mt-1 text-xs font-bold text-berry">{action.suggestion_type}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AppButton variant="secondary" onClick={() => acceptMutation.mutate(action)} disabled={action.status !== 'open'}>
                  {action.status === 'accepted' ? 'Accepted' : 'Accept'}
                </AppButton>
                <AppButton variant="ghost" onClick={() => ignoreMutation.mutate(action.id)} disabled={action.status !== 'open'}>
                  Ignore
                </AppButton>
              </div>
            </AppPanel>
          ))}
        </div>
      </AppCard>
    </div>
  )
}

export const aiRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'ai',
  component: AiPage,
})
