import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { useRef, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchJobs, createJob, updateJobStatus, updateJob, deleteJob } from '@/lib/jobs'
import { fetchProjects } from '@/lib/projects'

export function JobsPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs })
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })
  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [status, setStatus] = useState<'today' | 'upcoming' | 'waiting' | 'delayed' | 'completed'>('upcoming')
  const [paymentState, setPaymentState] = useState<'unpaid' | 'deposit due' | 'paid'>('unpaid')
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
      setTitle('')
      setCustomerName('')
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ jobId, nextStatus }: { jobId: string; nextStatus: typeof status }) =>
      updateJobStatus(jobId, nextStatus),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ jobId, input }: { jobId: string; input: { title?: string; customerName?: string } }) =>
      updateJob(jobId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: () => {
      setDeleteConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  // Inline edit state
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'customerName' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  function beginEdit(jobId: string, field: 'title' | 'customerName', currentValue: string) {
    setEditingJobId(jobId)
    setEditingField(field)
    setEditValue(currentValue)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  function commitEdit(jobId: string, field: 'title' | 'customerName') {
    if (!editValue.trim()) {
      cancelEdit()
      return
    }
    updateMutation.mutate({
      jobId,
      input: field === 'title' ? { title: editValue } : { customerName: editValue },
    })
    cancelEdit()
  }

  function cancelEdit() {
    setEditingJobId(null)
    setEditingField(null)
    setEditValue('')
  }

  return (
    <div className="space-y-4">
      <details>
        <summary className="ui-button ui-button--primary cursor-pointer">New job</summary>
        <div className="mt-4">
          <AppCard className="space-y-4">
            <SectionHeading
              eyebrow="Jobs"
              title="New job"
              action={
                <Link to="/app/business/listings">
                  <AppButton variant="ghost">Manage listings</AppButton>
                </Link>
              }
            />
            <FieldLabel>
              Job title
              <AppInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Job title"
              />
            </FieldLabel>
            <FieldLabel>
              Customer
              <AppInput
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
              />
            </FieldLabel>
            <FieldLabel>
              Status
              <AppSelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="waiting">Waiting on customer</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </AppSelect>
            </FieldLabel>
            <FieldLabel>
              Payment status
              <AppSelect
                value={paymentState}
                onChange={(event) => setPaymentState(event.target.value as typeof paymentState)}
              >
                <option value="unpaid">Unpaid</option>

                <option value="paid">Paid</option>
              </AppSelect>
            </FieldLabel>
            <FieldLabel>
              Project
              <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No linked project</option>
                {(projectsQuery.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </AppSelect>
            </FieldLabel>
            <AppButton
              disabled={!session || !title.trim() || !customerName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create job'}
            </AppButton>
            <MutationFeedback mutation={createMutation} success="Job created." />
          </AppCard>
        </div>
      </details>
      <AppCard className="space-y-4">
        <SectionHeading title="Jobs" />
        <QueryFeedback query={jobsQuery} />
        <MutationFeedback mutation={statusMutation} />
        <MutationFeedback mutation={updateMutation} />
        <MutationFeedback mutation={deleteMutation} />
        <div className="grid gap-3">
          {(jobsQuery.data ?? []).map((job) => (
            <AppPanel key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Title — double-click to edit */}
                  {editingJobId === job.id && editingField === 'title' ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(job.id, 'title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(job.id, 'title')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-full bg-transparent text-lg font-extrabold text-ink outline-none border-b-2 border-ink/40 focus:border-ink"
                    />
                  ) : (
                    <p
                      className="text-lg font-extrabold text-ink cursor-text group/title flex items-center gap-2"
                      onDoubleClick={() => beginEdit(job.id, 'title', job.title)}
                      title="Double-click to edit title"
                    >
                      {job.title}
                      <Pencil className="h-3 w-3 text-ink/30 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                    </p>
                  )}
                  {/* Customer — double-click to edit */}
                  <p className="mt-0.5 text-sm text-ink/65 flex items-center gap-1">
                    {editingJobId === job.id && editingField === 'customerName' ? (
                      <input
                        ref={editingField === 'customerName' ? editInputRef : undefined}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(job.id, 'customerName')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(job.id, 'customerName')
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="bg-transparent text-sm font-medium text-ink outline-none border-b border-ink/40 focus:border-ink"
                      />
                    ) : (
                      <button
                        type="button"
                        className="hover:text-ink hover:underline decoration-dotted group/cust flex items-center gap-1"
                        onDoubleClick={() => beginEdit(job.id, 'customerName', job.customer_name)}
                        title="Double-click to edit customer"
                      >
                        {job.customer_name}
                        <Pencil className="h-2.5 w-2.5 text-ink/30 opacity-0 group-hover/cust:opacity-100 transition-opacity" />
                      </button>
                    )}
                    <span>
                      · {job.status} · {job.payment_state}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="ui-field-label">
                    Status
                    <select
                      className="ui-input"
                      value={job.status}
                      disabled={statusMutation.isPending}
                      onChange={(e) =>
                        statusMutation.mutate({
                          jobId: job.id,
                          nextStatus: e.target.value as typeof status,
                        })
                      }
                    >
                      {(['today', 'upcoming', 'waiting', 'delayed', 'completed'] as const).map((value) => (
                        <option key={value} value={value}>
                          {value === 'waiting'
                            ? 'Waiting on customer'
                            : value.charAt(0).toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              {job.linked_project_id ? (
                <Link
                  to="/app/projects/$projectId"
                  params={{ projectId: job.linked_project_id }}
                  className="mt-3 inline-flex text-sm font-bold text-teal"
                >
                  View project
                </Link>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  to="/app/jobs/$jobId"
                  params={{ jobId: job.id }}
                  className="text-sm font-bold text-berry"
                >
                  View job
                </Link>
                {deleteConfirmId === job.id ? (
                  <>
                    <span className="text-xs font-bold text-berry">Delete this job?</span>
                    <AppButton
                      variant="secondary"
                      onClick={() => deleteMutation.mutate(job.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Yes, delete
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                      Cancel
                    </AppButton>
                  </>
                ) : (
                  <AppButton variant="ghost" onClick={() => setDeleteConfirmId(job.id)}>
                    Delete
                  </AppButton>
                )}
              </div>
            </AppPanel>
          ))}
          {!jobsQuery.isPending && !jobsQuery.isError && !jobsQuery.data?.length ? (
            <p className="text-sm text-ink/60">No jobs yet. Add a job to track work for a customer.</p>
          ) : null}
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
