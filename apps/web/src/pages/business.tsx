import { jobDetailRoute } from '@/route-definitions'
import { MoneyEntryForm } from '@/components/money-entry-form'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, AppTextarea, FieldLabel, SectionHeading } from '@superapp/ui'

import {
  deleteWorkflowStep,
  fetchJobDetail,
  updateJobBooking,
  updateJobNotes,
  updateJobPaymentState,
  updateJobStatus,
  updateWorkflowStep,
} from '@/lib/jobs'
import { createStructuredUpdate, fetchStructuredUpdates } from '@/lib/planning'
import { useAppStore } from '@/hooks/useAppStore'

export function JobDetailPage() {
  const { jobId } = jobDetailRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => fetchJobDetail(jobId),
  })
  const updatesQuery = useQuery({
    queryKey: ['job-structured-updates', jobId],
    queryFn: async () => {
      const detail = await fetchJobDetail(jobId)
      if (!detail?.job.linked_project_id) return []
      return fetchStructuredUpdates(detail.job.linked_project_id)
    },
  })
  const [bookingAt, setBookingAt] = useState('')
  const [notes, setNotes] = useState<string | null>(null)
  const [entryVersion, setEntryVersion] = useState(0)
  const [entrySaved, setEntrySaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'payment' | 'updates'>('overview')

  const statusMutation = useMutation({
    mutationFn: (status: 'today' | 'upcoming' | 'waiting' | 'delayed' | 'completed') =>
      updateJobStatus(jobId, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] }),
  })
  const bookingMutation = useMutation({
    mutationFn: () => updateJobBooking(jobId, new Date(bookingAt).toISOString()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] }),
  })
  const notesMutation = useMutation({
    mutationFn: () => updateJobNotes(jobId, notes ?? detailQuery.data?.job.notes ?? ''),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] }),
  })
  const paymentStateMutation = useMutation({
    mutationFn: (paymentState: 'unpaid' | 'deposit due' | 'paid') =>
      updateJobPaymentState(jobId, paymentState),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] }),
  })
  const stepMutation = useMutation({
    mutationFn: (input: {
      stepId: string
      title?: string
      status?: 'todo' | 'doing' | 'done'
      customerVisible?: boolean
    }) => updateWorkflowStep(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] }),
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      createStructuredUpdate({
        ownerId: session!.user.id,
        projectId: detailQuery.data!.job.linked_project_id,
        updateType: 'confirmed',
        note: `Status update from ${detailQuery.data!.job.title}`,
        aiReplan: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['job-structured-updates', jobId],
      })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => deleteWorkflowStep(stepId),
    onSuccess: () => {
      setDeleteConfirmStepId(null)
      void queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
    },
  })

  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editStepValue, setEditStepValue] = useState('')
  const [deleteConfirmStepId, setDeleteConfirmStepId] = useState<string | null>(null)
  const stepEditRef = useRef<HTMLInputElement>(null)

  function beginStepEdit(stepId: string, currentTitle: string) {
    setEditingStepId(stepId)
    setEditStepValue(currentTitle)
    setTimeout(() => stepEditRef.current?.select(), 0)
  }

  function commitStepEdit(stepId: string) {
    if (!editStepValue.trim()) {
      cancelStepEdit()
      return
    }
    stepMutation.mutate({ stepId, title: editStepValue.trim() })
    cancelStepEdit()
  }

  function cancelStepEdit() {
    setEditingStepId(null)
    setEditStepValue('')
  }

  const detail = detailQuery.data
  if (detailQuery.isPending || detailQuery.isError)
    return (
      <AppCard>
        <QueryFeedback query={detailQuery} />
      </AppCard>
    )
  if (!detail) return <AppCard>Job not found.</AppCard>

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Job detail" title={`${detail.job.customer_name} · ${detail.job.title}`} />
        <p className="text-sm text-ink/70">
          {detail.job.status} · {detail.job.payment_state} ·{' '}
          {detail.job.booking_at ? new Date(detail.job.booking_at).toLocaleString() : 'no booking time yet'}
        </p>
        <div role="group" aria-label="Job view" className="grid grid-cols-4 gap-1 sm:flex">
          {(['overview', 'workflow', 'payment', 'updates'] as const).map((tab) => (
            <AppButton
              key={tab}
              className="min-h-11 min-w-0 !px-2"
              aria-pressed={activeTab === tab}
              variant={activeTab === tab ? 'primary' : 'ghost'}
              onClick={() => setActiveTab(tab)}
            >
              {
                {
                  overview: 'Overview',
                  workflow: 'Steps',
                  payment: 'Money',
                  updates: 'Updates',
                }[tab]
              }
            </AppButton>
          ))}
        </div>
      </AppCard>

      {activeTab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Overview" title="Appointment and notes" />
            <FieldLabel>
              Appointment
              <AppInput
                type="datetime-local"
                value={bookingAt}
                onChange={(event) => setBookingAt(event.target.value)}
              />
            </FieldLabel>
            <AppButton
              disabled={!bookingAt || bookingMutation.isPending}
              onClick={() => bookingMutation.mutate()}
            >
              Set appointment
            </AppButton>
            <MutationFeedback mutation={bookingMutation} success="Appointment saved." />
            <FieldLabel>
              Internal notes
              <AppTextarea
                value={notes ?? detail.job.notes ?? ''}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-28"
              />
            </FieldLabel>
            <AppButton variant="secondary" onClick={() => notesMutation.mutate()}>
              Save notes
            </AppButton>
            <MutationFeedback mutation={notesMutation} success="Notes saved." />
          </AppCard>
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Status" title="Job status" />
            <div className="flex flex-wrap gap-2">
              {(['today', 'upcoming', 'waiting', 'delayed', 'completed'] as const).map((status) => (
                <AppButton
                  key={status}
                  variant={detail.job.status === status ? 'primary' : 'ghost'}
                  onClick={() => statusMutation.mutate(status)}
                >
                  {
                    {
                      today: 'Today',
                      upcoming: 'Upcoming',
                      waiting: 'Waiting on customer',
                      delayed: 'Delayed',
                      completed: 'Completed',
                      todo: 'To do',
                      doing: 'In progress',
                      done: 'Done',
                    }[status]
                  }
                </AppButton>
              ))}
            </div>
            <MutationFeedback mutation={statusMutation} />
            {detail.job.linked_project_id ? (
              <Link
                to="/app/projects/$projectId/conversation"
                params={{ projectId: detail.job.linked_project_id }}
                className="text-sm underline"
              >
                Open linked project
              </Link>
            ) : (
              <p className="text-sm text-ink/65">Not linked to a shared project yet.</p>
            )}
          </AppCard>
        </div>
      ) : null}

      {activeTab === 'workflow' ? (
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Workflow" title="Job steps" />
          {!detail.steps.length ? <p className="text-sm text-ink/65">No steps for this job.</p> : null}
          <MutationFeedback mutation={stepMutation} />
          <MutationFeedback mutation={deleteStepMutation} />
          <div className="grid gap-3">
            {detail.steps.map((step) => (
              <AppPanel key={step.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingStepId === step.id ? (
                      <input
                        ref={stepEditRef}
                        value={editStepValue}
                        onChange={(e) => setEditStepValue(e.target.value)}
                        onBlur={() => commitStepEdit(step.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitStepEdit(step.id)
                          if (e.key === 'Escape') cancelStepEdit()
                        }}
                        className="w-full bg-transparent font-extrabold text-ink outline-none border-b-2 border-ink/40 focus:border-ink"
                      />
                    ) : (
                      <p
                        className="font-extrabold text-ink cursor-text group/step flex items-center gap-1.5"
                        onDoubleClick={() => beginStepEdit(step.id, step.title)}
                        title="Double-click to rename"
                      >
                        <span>{step.title}</span>
                        <Pencil className="h-3 w-3 shrink-0 text-ink/30 opacity-0 group-hover/step:opacity-100 transition-opacity" />
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-ink/65">
                      {step.customer_visible ? 'Customer-visible' : 'Internal only'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['todo', 'doing', 'done'] as const).map((status) => (
                      <AppButton
                        key={status}
                        variant={step.status === status ? 'primary' : 'ghost'}
                        onClick={() => stepMutation.mutate({ stepId: step.id, status })}
                      >
                        {
                          {
                            today: 'Today',
                            upcoming: 'Upcoming',
                            waiting: 'Waiting on customer',
                            delayed: 'Delayed',
                            completed: 'Completed',
                            todo: 'To do',
                            doing: 'In progress',
                            done: 'Done',
                          }[status]
                        }
                      </AppButton>
                    ))}
                    <AppButton
                      variant="secondary"
                      onClick={() =>
                        stepMutation.mutate({
                          stepId: step.id,
                          customerVisible: !step.customer_visible,
                        })
                      }
                    >
                      {step.customer_visible ? 'Hide from customer' : 'Share with customer'}
                    </AppButton>
                    {deleteConfirmStepId === step.id ? (
                      <>
                        <span className="flex items-center text-xs font-bold text-berry">Delete?</span>
                        <AppButton
                          variant="secondary"
                          onClick={() => deleteStepMutation.mutate(step.id)}
                          disabled={deleteStepMutation.isPending}
                        >
                          Yes
                        </AppButton>
                        <AppButton variant="ghost" onClick={() => setDeleteConfirmStepId(null)}>
                          No
                        </AppButton>
                      </>
                    ) : (
                      <AppButton variant="ghost" onClick={() => setDeleteConfirmStepId(step.id)}>
                        Delete
                      </AppButton>
                    )}
                  </div>
                </div>
              </AppPanel>
            ))}
          </div>
        </AppCard>
      ) : null}

      {activeTab === 'payment' ? (
        <AppCard className="space-y-4">
          <SectionHeading
            title="Money"
            action={
              <Link
                to="/app/wallet"
                search={{
                  projectId: detail.job.linked_project_id ?? undefined,
                }}
                className="underline text-sm"
              >
                View activity
              </Link>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Job payment status</span>
            {(['unpaid', 'paid'] as const).map((state) => (
              <AppButton
                key={state}
                variant={detail.job.payment_state === state ? 'primary' : 'ghost'}
                disabled={paymentStateMutation.isPending}
                onClick={() => paymentStateMutation.mutate(state)}
              >
                {state === 'paid' ? 'Paid' : 'Unpaid'}
              </AppButton>
            ))}
          </div>
          <p className="text-xs text-ink/65">Changing the job status does not create a financial entry.</p>
          <MutationFeedback mutation={paymentStateMutation} />
          <h3 className="font-semibold">Add entry</h3>
          {entrySaved ? (
            <p role="status" className="text-sm">
              Entry saved in Activity.
            </p>
          ) : null}
          <MoneyEntryForm
            key={entryVersion}
            projectId={detail.job.linked_project_id ?? undefined}
            defaultDirection="in"
            defaultTitle={detail.job.title}
            defaultCounterparty={detail.job.customer_name}
            onSaved={() => {
              setEntryVersion((v) => v + 1)
              setEntrySaved(true)
            }}
          />
        </AppCard>
      ) : null}

      {activeTab === 'updates' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Customer-visible" title="Shared updates" />
            <AppButton
              onClick={() => updateMutation.mutate()}
              disabled={!detail.job.linked_project_id || updateMutation.isPending}
            >
              Post update
            </AppButton>
            <MutationFeedback mutation={updateMutation} success="Update posted." />
          </AppCard>
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Feed" title="Customer activity" />
            <QueryFeedback query={updatesQuery} />
            {updatesQuery.isSuccess && !updatesQuery.data.length ? (
              <p className="text-sm text-ink/65">No updates yet.</p>
            ) : null}
            <div className="grid gap-3">
              {(updatesQuery.data ?? []).map((update) => (
                <AppPanel key={update.id}>
                  <p className="font-extrabold text-ink">{update.update_type}</p>
                  <p className="text-sm text-ink/65">{update.note || 'No detail provided'}</p>
                </AppPanel>
              ))}
            </div>
          </AppCard>
        </div>
      ) : null}
    </div>
  )
}
