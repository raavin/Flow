import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppCard } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail } from '@/lib/projects'
import { ProjectShell } from './project-shell'
import { BudgetLedger } from './budget-ledger'

export function ProjectBudget({ projectId }: { projectId: string }) {
  const { session } = useAppStore()
  const [selection, setSelection] = useState<{ project: string; node: string } | null>(null)
  const project = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  return (
    <ProjectShell projectId={projectId} activeTab="budget">
      {project.isPending ? (
        <AppCard>
          <p role="status">Loading budget…</p>
        </AppCard>
      ) : project.isError ? (
        <AppCard>
          <p role="alert">Could not load this project.</p>
        </AppCard>
      ) : project.data?.ownerId !== session?.user.id ? (
        <AppCard>The project budget is private to its owner.</AppCard>
      ) : (
        <BudgetLedger
          projectContextId={projectId}
          focus={selection?.project === projectId ? selection.node : `project:${projectId}`}
          onFocus={(node) => setSelection({ project: projectId, node })}
        />
      )}
    </ProjectShell>
  )
}
