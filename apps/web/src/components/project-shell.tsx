import { useEffect, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppButton, AppCard, AppPill, SectionHeading } from '@superapp/ui'
import { fetchProjectDetail } from '@/lib/projects'

export function ProjectShell({
  projectId,
  activeTab,
  children,
}: {
  projectId: string
  activeTab: 'conversation' | 'calendar' | 'timeline' | 'notes' | 'people'
  children: ReactNode
}) {
  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('flow:last-project', JSON.stringify({ projectId, activeTab }))
  }, [activeTab, projectId])

  const project = detailQuery.data?.project

  const tabs = [
    { key: 'conversation', label: 'Conversation', to: '/app/projects/$projectId/conversation' as const },
    { key: 'calendar', label: 'Calendar', to: '/app/projects/$projectId/calendar' as const },
    { key: 'timeline', label: 'Timeline', to: '/app/projects/$projectId/timeline' as const },
    { key: 'notes', label: 'Notes', to: '/app/projects/$projectId/notes' as const },
    { key: 'people', label: 'People', to: '/app/projects/$projectId/people' as const },
  ] as const

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeading eyebrow="Project" title={project?.title ?? 'Project'} />
            <p className="text-sm text-ink/70">
              {project ? `${project.category || 'General'} · target ${project.targetDate ?? 'to be decided'}` : 'Loading project context...'}
            </p>
          </div>
          <Link to="/app/projects">
            <AppButton variant="ghost">All projects</AppButton>
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppPill tone="butter">{project?.status ?? 'active'}</AppPill>
          {project?.targetDate ? <AppPill tone="teal">{project.targetDate}</AppPill> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link key={tab.key} to={tab.to} params={{ projectId }}>
              <AppButton variant={activeTab === tab.key ? 'primary' : 'ghost'}>{tab.label}</AppButton>
            </Link>
          ))}
        </div>
      </AppCard>

      {children}
    </div>
  )
}
