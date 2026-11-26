import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { ProjectBudget } from '@/components/project-budget'
import { useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail } from '@/lib/projects'
import {
  computeAvailabilitySuggestion,
  createStructuredUpdate,
  deleteStructuredUpdate,
  fetchStructuredUpdates,
  previewStructuredImpact,
} from '@/lib/planning'
import { fetchParticipants, updateParticipant } from '@/lib/participants'

function AvailabilityPage() {
  const { projectId } = availabilityRoute.useParams()
  const queryClient = useQueryClient()
  const participantsQuery = useQuery({
    queryKey: ['participants', projectId],
    queryFn: () => fetchParticipants(projectId),
  })
  const suggestionQuery = useQuery({
    queryKey: ['availability-suggestion', projectId],
    queryFn: () => computeAvailabilitySuggestion(projectId),
  })
  const mutation = useMutation({
    mutationFn: ({ participantId, availabilityStatus }: { participantId: string; availabilityStatus: string }) =>
      updateParticipant({ participantId, availabilityStatus }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['availability-suggestion', projectId] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Availability" title="Availability" />
        <div className="grid gap-3">
          {(participantsQuery.data ?? []).map((participant) => (
            <AppPanel key={participant.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-ink">{participant.name}</p>
                  <p className="text-sm text-ink/65">{participant.role}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['available Saturday morning', 'available Sunday afternoon', 'cannot help', 'maybe'].map((option) => (
                    <button
                      key={option}
                      onClick={() => mutation.mutate({ participantId: participant.id, availabilityStatus: option })}
                      className={`rounded-full px-3 py-2 text-xs font-bold ${participant.availability_status === option ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </AppPanel>
          ))}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="" title="Suggested time" />
        <AppPanel tone="butter" className="p-5">
          <p className="text-lg font-extrabold text-ink">{suggestionQuery.data?.recommendation ?? 'Gathering replies...'}</p>
          <p className="mt-2 text-sm text-ink/70">
            Supporting people: {suggestionQuery.data?.supportingPeople?.join(', ') || 'none yet'}
          </p>
        </AppPanel>
        <Link to="/app/projects/$projectId" params={{ projectId }}>
          <AppButton>Back to project</AppButton>
        </Link>
      </AppCard>
    </div>
  )
}

function BudgetPage() {
  const { projectId } = budgetRoute.useParams()
  return <ProjectBudget projectId={projectId} />
}

export function UpdatesPage() {
  const { projectId } = structuredUpdatesRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const updatesQuery = useQuery({
    queryKey: ['structured-updates', projectId],
    queryFn: () => fetchStructuredUpdates(projectId),
  })
  const [updateType, setUpdateType] = useState('booking changed')
  const [milestoneId, setMilestoneId] = useState('')
  const [previousTime, setPreviousTime] = useState('')
  const [nextTime, setNextTime] = useState('')
  const [note, setNote] = useState('')
  const impact = previewStructuredImpact({ updateType, previousTime, nextTime, note })
  const mutation = useMutation({
    mutationFn: () =>
      createStructuredUpdate({
        ownerId: session!.user.id,
        projectId,
        updateType,
        affectedMilestoneId: milestoneId || null,
        previousTime: previousTime ? new Date(previousTime).toISOString() : undefined,
        nextTime: nextTime ? new Date(nextTime).toISOString() : undefined,
        note,
        aiReplan: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['structured-updates', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const [deleteConfirmUpdateId, setDeleteConfirmUpdateId] = useState<string | null>(null)
  const deleteUpdateMutation = useMutation({
    mutationFn: (updateId: string) => deleteStructuredUpdate(updateId),
    onSuccess: () => {
      setDeleteConfirmUpdateId(null)
      void queryClient.invalidateQueries({ queryKey: ['structured-updates', projectId] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Project" title="Post an update" />
        <FieldLabel>Update type<AppSelect value={updateType} onChange={(event) => setUpdateType(event.target.value)}>
          {['delay', 'confirmed', 'completed', 'unavailable', 'payment sent', 'item purchased', 'access changed', 'booking changed'].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </AppSelect></FieldLabel>
        <FieldLabel>Milestone<AppSelect value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
          <option value="">No milestone selected</option>
          {(detailQuery.data?.milestones ?? []).map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.title}
            </option>
          ))}
        </AppSelect></FieldLabel>
        <FieldLabel>Previous date and time (optional)<AppInput type="datetime-local" value={previousTime} onChange={(event) => setPreviousTime(event.target.value)} /></FieldLabel>
        <FieldLabel>New date and time (optional)<AppInput type="datetime-local" value={nextTime} onChange={(event) => setNextTime(event.target.value)} /></FieldLabel>
        <FieldLabel>Notes<AppTextarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24" /></FieldLabel>

        <AppPanel tone="butter" className="text-sm">
          <p className="font-extrabold text-ink">{impact.message}</p>
          <p className="mt-2 text-ink/70">Only the selected milestone can change. Other tasks and bookings stay as they are.</p>
        </AppPanel>
        <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
          Apply update
        </AppButton>
        <MutationFeedback mutation={mutation} success="Update saved." />
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading title="Updates" />
        <QueryFeedback query={updatesQuery} />
        <MutationFeedback mutation={deleteUpdateMutation} />
        <div className="grid gap-3">
          {(updatesQuery.data ?? []).map((update) => (
            <AppPanel key={update.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-ink">{update.update_type}</p>
                  <p className="text-sm text-ink/65">{update.note || 'No note provided'}</p>
                </div>
                {deleteConfirmUpdateId === update.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs font-bold text-berry">Delete?</span>
                    <button type="button" className="text-xs font-bold text-berry hover:underline" onClick={() => deleteUpdateMutation.mutate(update.id)} disabled={deleteUpdateMutation.isPending}>Yes</button>
                    <button type="button" className="text-xs text-ink/55 hover:underline" onClick={() => setDeleteConfirmUpdateId(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="shrink-0 text-xs text-ink/30 hover:text-berry transition-colors" onClick={() => setDeleteConfirmUpdateId(update.id)}>
                    Delete
                  </button>
                )}
              </div>
            </AppPanel>
          ))}
          {!updatesQuery.isPending && !updatesQuery.isError && !updatesQuery.data?.length ? <p className="text-sm text-ink/60">No updates yet.</p> : null}
        </div>
      </AppCard>
    </div>
  )
}

export const availabilityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/availability',
  component: AvailabilityPage,
})

export const budgetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/budget',
  component: BudgetPage,
})

export const structuredUpdatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/updates',
  component: UpdatesPage,
})
