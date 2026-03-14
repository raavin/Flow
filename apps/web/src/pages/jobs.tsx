import { useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchJobs, createJob, updateJobStatus } from '@/lib/jobs'
import { fetchProjects } from '@/lib/projects'

function JobsPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [status, setStatus] = useState<'today' | 'upcoming' | 'waiting' | 'delayed' | 'completed'>('upcoming')
  const [paymentState, setPaymentState] = useState<'unpaid' | 'deposit due' | 'paid'>('deposit due')
  const [projectId, setProjectId] = useState('')
  const createMutation = useMutation({
    mutationFn: () =>
      createJob({
        ownerId: session!.user.id,
        title,
        customerName,
        status,
        paymentState,
        linkedProjectId: projectId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ jobId, nextStatus }: { jobId: string; nextStatus: typeof status }) => updateJobStatus(jobId, nextStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard className="space-y-4">
        <SectionHeading
          eyebrow="Jobs"
          title="Create client work"
          action={
            <Link to="/app/business/listings">
              <AppButton variant="ghost">Manage listings</AppButton>
            </Link>
          }
        />
        <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Job title" />
        <AppInput value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
        <AppSelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="waiting">Waiting on customer</option>
          <option value="delayed">Delayed</option>
          <option value="completed">Completed</option>
        </AppSelect>
        <AppSelect value={paymentState} onChange={(event) => setPaymentState(event.target.value as typeof paymentState)}>
          <option value="unpaid">Unpaid</option>
          <option value="deposit due">Deposit due</option>
          <option value="paid">Paid</option>
        </AppSelect>
        <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">No linked project</option>
          {(projectsQuery.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </AppSelect>
        <AppButton disabled={!session || createMutation.isPending} onClick={() => createMutation.mutate()}>
          Create job
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Clients" title="Active work board" />
        <div className="grid gap-3">
          {(jobsQuery.data ?? []).map((job) => (
            <AppPanel key={job.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-ink">{job.title}</p>
                  <p className="text-sm text-ink/65">
                    {job.customer_name} · {job.status} · {job.payment_state}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['today', 'upcoming', 'waiting', 'delayed', 'completed'] as const).map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => statusMutation.mutate({ jobId: job.id, nextStatus })}
                      className={`rounded-full px-3 py-2 text-xs font-bold ${job.status === nextStatus ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
              </div>
              {job.linked_project_id ? (
                <Link to="/app/projects/$projectId" params={{ projectId: job.linked_project_id }} className="mt-3 inline-flex text-sm font-bold text-teal">
                  Open linked project
                </Link>
              ) : null}
              <div className="mt-3">
                <Link to="/app/jobs/$jobId" params={{ jobId: job.id }} className="text-sm font-bold text-berry">
                  Open job detail
                </Link>
              </div>
            </AppPanel>
          ))}
          {!jobsQuery.data?.length ? <p className="text-sm text-ink/60">No jobs yet. This is where business-side work becomes manageable.</p> : null}
        </div>
        <div className="border-t border-ink/10 pt-3">
          <p className="text-xs text-ink/55">
            Offer a repeatable service?{' '}
            <Link to="/app/business/listings" className="font-bold text-teal hover:underline">
              Create a listing
            </Link>{' '}
            and attach it to future jobs.
          </p>
        </div>
      </AppCard>
    </div>
  )
}

export const jobsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'jobs',
  component: JobsPage,
})
