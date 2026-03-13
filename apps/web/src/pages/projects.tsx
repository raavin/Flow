import { useState } from 'react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import {
  fetchProjects,
  createProject,
  fetchProjectDetail,
  shiftMilestone,
  attachListingToProject,
  createTask,
  updateTaskStatus,
} from '@/lib/projects'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchMarketplaceListings } from '@/lib/marketplace'
import { fetchProjectActivity } from '@/lib/coordination'

function ProjectsPage() {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const createMutation = useMutation({
    mutationFn: () =>
      createProject({
        ownerId: session!.user.id,
        title,
        category,
        targetDate,
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      setTitle('')
      setCategory('')
      setTargetDate('')
      void navigate({ to: '/app/projects/$projectId', params: { projectId: project.id } })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Create" title="Start a real project" />
        <FieldLabel>
          Title
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" />
        </FieldLabel>
        <FieldLabel>
          Category
          <AppInput value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2" />
        </FieldLabel>
        <FieldLabel>
          Target date
          <AppInput type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-2" />
        </FieldLabel>
        <AppButton disabled={!session || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? 'Creating...' : 'Create project'}
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Projects" title="Your live coordination board" />
        <div className="grid gap-3">
          {(projectsQuery.data ?? []).map((project) => (
            <Link key={project.id} to="/app/projects/$projectId" params={{ projectId: project.id }} className="ui-panel transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-ink">{project.title}</p>
                  <p className="text-sm text-ink/65">{project.category}</p>
                </div>
                <AppPill tone="butter" className="py-1">{project.targetDate ?? 'Someday'}</AppPill>
              </div>
            </Link>
          ))}
          {!projectsQuery.data?.length ? <p className="text-sm text-ink/60">No projects yet. Create one and it will immediately show up in calendar and Gantt planning.</p> : null}
        </div>
      </AppCard>
    </div>
  )
}

function ProjectDetailPage() {
  const { projectId } = projectDetailRoute.useParams()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const [taskTitle, setTaskTitle] = useState('')
  const servicesQuery = useQuery({
    queryKey: ['marketplace', 'services-combined'],
    queryFn: async () => {
      const services = await fetchMarketplaceListings('service')
      const products = await fetchMarketplaceListings('product')
      return [...(services ?? []), ...(products ?? [])]
    },
  })
  const activityQuery = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => fetchProjectActivity(projectId),
  })

  const shiftMutation = useMutation({
    mutationFn: ({ milestoneId, days }: { milestoneId: string; days: number }) => shiftMilestone(milestoneId, days),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })

  const attachMutation = useMutation({
    mutationFn: (listingId: string) => attachListingToProject(projectId, listingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
    },
  })
  const taskMutation = useMutation({
    mutationFn: () => createTask({ projectId, title: taskTitle }),
    onSuccess: () => {
      setTaskTitle('')
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
    },
  })
  const taskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'todo' | 'doing' | 'done' }) =>
      updateTaskStatus(taskId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
    },
  })

  const detail = detailQuery.data

  if (!detail) {
    return <AppCard>Loading project...</AppCard>
  }

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Overview" title={detail.project.title} />
        <p className="text-sm text-ink/70">
          {detail.project.category} · target {detail.project.targetDate ?? 'to be decided'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/app/projects/$projectId/participants" params={{ projectId }}>
            <AppButton variant="secondary">Manage participants</AppButton>
          </Link>
          <Link to="/app/projects/$projectId/availability" params={{ projectId }}>
            <AppButton variant="ghost">Availability matching</AppButton>
          </Link>
          <Link to="/app/projects/$projectId/budget" params={{ projectId }}>
            <AppButton variant="ghost">Budget</AppButton>
          </Link>
          <Link to="/app/projects/$projectId/updates" params={{ projectId }}>
            <AppButton variant="ghost">Structured updates</AppButton>
          </Link>
          <Link to="/app/calendar">
            <AppButton variant="ghost">Open calendar</AppButton>
          </Link>
        </div>
      </AppCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Milestones" title="Interactive schedule" />
          <div className="space-y-3">
            {detail.milestones.map((milestone) => (
              <AppPanel key={milestone.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{milestone.title}</p>
                    <p className="text-sm text-ink/65">
                      {milestone.startsOn} to {milestone.endsOn} · {milestone.lane}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AppButton variant="ghost" onClick={() => shiftMutation.mutate({ milestoneId: milestone.id, days: -1 })}>
                      -1 day
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => shiftMutation.mutate({ milestoneId: milestone.id, days: 1 })}>
                      +1 day
                    </AppButton>
                  </div>
                </div>
              </AppPanel>
            ))}
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Marketplace" title="Attach help to this project" />
          <div className="space-y-3">
            {(servicesQuery.data ?? []).map((listing) => (
              <AppPanel key={listing.id}>
                <p className="font-extrabold text-ink">{listing.title}</p>
                <p className="text-sm text-ink/65">{listing.summary}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-teal">{listing.priceLabel}</span>
                  <AppButton variant="secondary" onClick={() => attachMutation.mutate(listing.id)}>
                    Attach
                  </AppButton>
                </div>
              </AppPanel>
            ))}
          </div>
          <AppPanel tone="butter" className="text-sm">
            Attached items: {detail.attachments.length}
          </AppPanel>
        </AppCard>
      </div>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Tasks" title="Keep momentum visible" />
        <div className="flex flex-col gap-3 md:flex-row">
          <AppInput
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            className="flex-1"
            placeholder="Add a task"
          />
          <AppButton onClick={() => taskMutation.mutate()} disabled={taskMutation.isPending || !taskTitle}>
            Add task
          </AppButton>
        </div>
        <div className="grid gap-3">
          {detail.tasks.map((task: { id: string; title: string; status: 'todo' | 'doing' | 'done'; due_on: string | null; assignee_name: string | null }) => (
            <AppPanel key={task.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-ink">{task.title}</p>
                  <p className="text-sm text-ink/65">
                    {task.status} {task.due_on ? `· due ${task.due_on}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['todo', 'doing', 'done'] as const).map((status) => (
                    <AppButton
                      key={status}
                      variant={task.status === status ? 'primary' : 'ghost'}
                      onClick={() => taskStatusMutation.mutate({ taskId: task.id, status })}
                    >
                      {status}
                    </AppButton>
                  ))}
                </div>
              </div>
            </AppPanel>
          ))}
          {!detail.tasks.length ? <p className="text-sm text-ink/60">No tasks yet. Add one and use the status chips to move it across the flow.</p> : null}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Activity" title="Project feed" />
        <div className="grid gap-3">
          {(activityQuery.data ?? []).map((activity) => (
            <AppPanel key={activity.id}>
              <p className="font-extrabold text-ink">{activity.title}</p>
              <p className="text-sm text-ink/65">{activity.detail}</p>
              <p className="mt-1 text-xs font-bold text-berry">{activity.activity_type}</p>
            </AppPanel>
          ))}
          {!activityQuery.data?.length ? <p className="text-sm text-ink/60">Project actions will build a chronological feed here.</p> : null}
        </div>
      </AppCard>
    </div>
  )
}

export const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects',
  component: ProjectsPage,
})

export const projectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId',
  component: ProjectDetailPage,
})
