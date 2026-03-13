import { useMemo, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail } from '@/lib/projects'
import {
  computeAvailabilitySuggestion,
  createExpense,
  createStructuredUpdate,
  fetchExpenses,
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
        <SectionHeading eyebrow="Availability" title="Matching replies" />
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
        <SectionHeading eyebrow="System proposal" title="Best slot" />
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
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const expensesQuery = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: () => fetchExpenses(projectId),
  })
  const [category, setCategory] = useState('services')
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [actual, setActual] = useState('')
  const mutation = useMutation({
    mutationFn: () =>
      createExpense({
        ownerId: session!.user.id,
        projectId,
        category,
        title,
        estimateCents: Math.round(Number(estimate || 0) * 100),
        actualCents: Math.round(Number(actual || 0) * 100),
        paymentStatus: 'paid',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
    },
  })

  const totals = useMemo(() => {
    const expenses = expensesQuery.data ?? []
    return expenses.reduce(
      (acc, item) => {
        acc.estimate += item.estimate_cents
        acc.actual += item.actual_cents
        if (item.payment_status !== 'paid') acc.outstanding += item.actual_cents
        return acc
      },
      { estimate: 0, actual: 0, outstanding: 0 },
    )
  }, [expensesQuery.data])

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Budget" title={`Budget for ${detailQuery.data?.project.title ?? 'project'}`} />
        <div className="grid gap-3 md:grid-cols-4">
          <AppPanel><p className="text-xs font-bold uppercase text-ink/50">Budget target</p><p className="text-lg font-extrabold">${((detailQuery.data?.project.budgetCents ?? 0) / 100).toFixed(2)}</p></AppPanel>
          <AppPanel><p className="text-xs font-bold uppercase text-ink/50">Estimated</p><p className="text-lg font-extrabold">${(totals.estimate / 100).toFixed(2)}</p></AppPanel>
          <AppPanel><p className="text-xs font-bold uppercase text-ink/50">Actual</p><p className="text-lg font-extrabold">${(totals.actual / 100).toFixed(2)}</p></AppPanel>
          <AppPanel><p className="text-xs font-bold uppercase text-ink/50">Outstanding</p><p className="text-lg font-extrabold">${(totals.outstanding / 100).toFixed(2)}</p></AppPanel>
        </div>
      </AppCard>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Add expense" title="Track spend" />
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Expense title" />
          <AppInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
          <AppInput value={estimate} onChange={(event) => setEstimate(event.target.value)} placeholder="Estimate" />
          <AppInput value={actual} onChange={(event) => setActual(event.target.value)} placeholder="Actual" />
          <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
            Add expense
          </AppButton>
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Categories" title="Project expenses" />
          <div className="grid gap-3">
            {(expensesQuery.data ?? []).map((expense) => (
              <AppPanel key={expense.id}>
                <p className="font-extrabold text-ink">{expense.title}</p>
                <p className="text-sm text-ink/65">
                  {expense.category} · estimate ${(expense.estimate_cents / 100).toFixed(2)} · actual ${(expense.actual_cents / 100).toFixed(2)}
                </p>
              </AppPanel>
            ))}
            {!expensesQuery.data?.length ? <p className="text-sm text-ink/60">Attach purchases and manual costs here to keep your budget honest.</p> : null}
          </div>
        </AppCard>
      </div>
    </div>
  )
}

function UpdatesPage() {
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
  const [aiReplan, setAiReplan] = useState(true)
  const impact = previewStructuredImpact({ updateType, previousTime, nextTime, note })
  const mutation = useMutation({
    mutationFn: () =>
      createStructuredUpdate({
        ownerId: session!.user.id,
        projectId,
        updateType,
        affectedMilestoneId: milestoneId || null,
        previousTime: new Date(previousTime).toISOString(),
        nextTime: new Date(nextTime).toISOString(),
        note,
        aiReplan,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['structured-updates', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Structured update" title="Preview impact" />
        <AppSelect value={updateType} onChange={(event) => setUpdateType(event.target.value)}>
          {['delay', 'confirmed', 'completed', 'unavailable', 'payment sent', 'item purchased', 'access changed', 'booking changed'].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </AppSelect>
        <AppSelect value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
          <option value="">No milestone selected</option>
          {(detailQuery.data?.milestones ?? []).map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.title}
            </option>
          ))}
        </AppSelect>
        <AppInput type="datetime-local" value={previousTime} onChange={(event) => setPreviousTime(event.target.value)} />
        <AppInput type="datetime-local" value={nextTime} onChange={(event) => setNextTime(event.target.value)} />
        <AppTextarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24" />
        <label className="flex items-center gap-3 rounded-2xl bg-cloud px-4 py-3 text-sm font-bold text-ink">
          <input type="checkbox" checked={aiReplan} onChange={(event) => setAiReplan(event.target.checked)} />
          Ask for replan suggestion
        </label>
        <AppPanel tone="butter" className="text-sm">
          <p className="font-extrabold text-ink">{impact.message}</p>
          <p className="mt-2 text-ink/70">Affected: {impact.affected.join(', ')}</p>
        </AppPanel>
        <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
          Send update and apply
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Update feed" title="Recent structured updates" />
        <div className="grid gap-3">
          {(updatesQuery.data ?? []).map((update) => (
            <AppPanel key={update.id}>
              <p className="font-extrabold text-ink">{update.update_type}</p>
              <p className="text-sm text-ink/65">{update.note || 'No note provided'}</p>
            </AppPanel>
          ))}
          {!updatesQuery.data?.length ? <p className="text-sm text-ink/60">Structured updates will show how live changes affect the project timeline.</p> : null}
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
