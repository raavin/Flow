import { useMemo, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoordinationDisplayKind, CoordinationObject, CoordinationObjectIntent, CoordinationObjectKind, CoordinationObjectState, CoordinationTemplateBlock } from '@superapp/types'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, AppTextarea, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import {
  createCoordinationTemplate,
  createManualCoordinationObject,
  fetchCoordinationObjects,
  fetchCoordinationTemplates,
  instantiateCoordinationTemplate,
  seedStarterCoordinationTemplates,
  updateCoordinationObjectState,
} from '@/lib/coordination-objects'
import { fetchProjects } from '@/lib/projects'

const kindOptions: Array<{ value: CoordinationObjectKind; label: string }> = [
  { value: 'reminder', label: 'Reminder' },
  { value: 'event', label: 'Event' },
  { value: 'request', label: 'Request' },
  { value: 'booking', label: 'Booking' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'plan', label: 'Plan' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'project', label: 'Project' },
]

const displayOptions: Array<{ value: CoordinationDisplayKind; label: string }> = [
  { value: 'task', label: 'Task' },
  { value: 'event', label: 'Event' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'booking', label: 'Booking' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'plan', label: 'Plan' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'project', label: 'Project' },
]

const intentOptions: Array<{ value: CoordinationObjectIntent; label: string }> = [
  { value: 'coordinate', label: 'Coordinate' },
  { value: 'remind', label: 'Remind' },
  { value: 'ask', label: 'Ask' },
  { value: 'book', label: 'Book' },
  { value: 'buy', label: 'Buy' },
  { value: 'attend', label: 'Attend' },
  { value: 'celebrate', label: 'Celebrate' },
  { value: 'health', label: 'Health' },
  { value: 'work', label: 'Work' },
  { value: 'support', label: 'Support' },
]

function CoordinationPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [kind, setKind] = useState<CoordinationObjectKind>('reminder')
  const [displayKind, setDisplayKind] = useState<CoordinationDisplayKind>('reminder')
  const [intent, setIntent] = useState<CoordinationObjectIntent>('coordinate')
  const [date, setDate] = useState(todayDate())
  const [endDate, setEndDate] = useState('')
  const [participants, setParticipants] = useState('')
  const [linkedProjectId, setLinkedProjectId] = useState('')
  const [templateAnchorDate, setTemplateAnchorDate] = useState(todayDate())
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateSummary, setTemplateSummary] = useState('')
  const [templateDisplayKind, setTemplateDisplayKind] = useState<CoordinationDisplayKind>('plan')
  const [templateJson, setTemplateJson] = useState('')
  const [templateError, setTemplateError] = useState<string | null>(null)

  const coordinationQuery = useQuery({
    queryKey: ['coordination-objects'],
    queryFn: () => fetchCoordinationObjects(),
    enabled: Boolean(session?.user.id),
  })
  const templatesQuery = useQuery({
    queryKey: ['coordination-templates'],
    queryFn: fetchCoordinationTemplates,
    enabled: Boolean(session?.user.id),
  })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  const createMutation = useMutation({
    mutationFn: () =>
      createManualCoordinationObject({
        ownerId: session!.user.id,
        title,
        summary: summary || null,
        kind,
        displayKind,
        intent,
        state: displayKind === 'reminder' ? 'pending' : 'scheduled',
        startsAt: toStartIso(date),
        endsAt: toEndIso(endDate || date),
        dueAt: displayKind === 'task' || displayKind === 'reminder' ? toDueIso(endDate || date) : null,
        isAllDay: true,
        flexibility: displayKind === 'reminder' ? 'floating' : 'shiftable',
        linkedProjectId: linkedProjectId || null,
        participantNames: participants.split(',').map((value) => value.trim()).filter(Boolean),
        metadata: {
          lane: displayKind,
          captureSource: 'coordination-page',
        },
      }),
    onSuccess: () => {
      setTitle('')
      setSummary('')
      setParticipants('')
      setLinkedProjectId('')
      setEndDate('')
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  const stateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: CoordinationObjectState }) => updateCoordinationObjectState(id, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      setTemplateError(null)
      let blocks: CoordinationTemplateBlock[] = []

      try {
        blocks = parseTemplateBlocks(templateJson)
      } catch (error) {
        setTemplateError(error instanceof Error ? error.message : 'Template JSON is not valid.')
        throw error
      }

      return createCoordinationTemplate({
        ownerId: session!.user.id,
        title: templateTitle,
        summary: templateSummary || null,
        displayKind: templateDisplayKind,
        blocks,
      })
    },
    onSuccess: () => {
      setTemplateTitle('')
      setTemplateSummary('')
      setTemplateJson('')
      setTemplateError(null)
      void queryClient.invalidateQueries({ queryKey: ['coordination-templates'] })
    },
  })

  const starterTemplatesMutation = useMutation({
    mutationFn: () => seedStarterCoordinationTemplates(session!.user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coordination-templates'] })
    },
  })

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => {
      const template = (templatesQuery.data ?? []).find((item) => item.id === templateId)
      if (!template) throw new Error('Template not found.')

      return instantiateCoordinationTemplate({
        ownerId: session!.user.id,
        template,
        anchorDate: templateAnchorDate,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })

  const buckets = useMemo(() => groupCoordinationObjects(coordinationQuery.data ?? []), [coordinationQuery.data])

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Flows" title="Coordination objects" />
        <p className="text-sm text-ink/70">
          Everything can start lightweight here: a reminder, a request, an appointment, a booking, a tiny plan, or the seed of a bigger project.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <AppPanel tone="butter">
            <p className="text-xs font-bold uppercase text-ink/50">Active now</p>
            <p className="text-2xl font-extrabold text-ink">{buckets.now.length}</p>
          </AppPanel>
          <AppPanel tone="peach">
            <p className="text-xs font-bold uppercase text-ink/50">Upcoming</p>
            <p className="text-2xl font-extrabold text-ink">{buckets.next.length}</p>
          </AppPanel>
          <AppPanel tone="teal">
            <p className="text-xs font-bold uppercase text-ink/50">Reusable flows</p>
            <p className="text-2xl font-extrabold text-ink">{templatesQuery.data?.length ?? 0}</p>
          </AppPanel>
        </div>
      </AppCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Quick capture" title="Start light, structure later" />
            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel>
                Title
                <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Doctor appointment, coffee catch-up, request leave..." className="mt-2" />
              </FieldLabel>
              <FieldLabel>
                Intent
                <AppSelect value={intent} onChange={(event) => setIntent(event.target.value as CoordinationObjectIntent)} className="mt-2">
                  {intentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </FieldLabel>
              <FieldLabel>
                Structure
                <AppSelect value={displayKind} onChange={(event) => setDisplayKind(event.target.value as CoordinationDisplayKind)} className="mt-2">
                  {displayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </FieldLabel>
              <FieldLabel>
                Internal kind
                <AppSelect value={kind} onChange={(event) => setKind(event.target.value as CoordinationObjectKind)} className="mt-2">
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </FieldLabel>
              <FieldLabel>
                Starts
                <AppInput type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2" />
              </FieldLabel>
              <FieldLabel>
                Ends or due
                <AppInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-2" />
              </FieldLabel>
            </div>
            <FieldLabel>
              Supporting note
              <AppTextarea value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-2 min-h-24" placeholder="What is this trying to make happen?" />
            </FieldLabel>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel>
                Participants
                <AppInput value={participants} onChange={(event) => setParticipants(event.target.value)} className="mt-2" placeholder="Jimmy, work manager, Dr Smith" />
              </FieldLabel>
              <FieldLabel>
                Linked project
                <AppSelect value={linkedProjectId} onChange={(event) => setLinkedProjectId(event.target.value)} className="mt-2">
                  <option value="">None</option>
                  {(projectsQuery.data ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </AppSelect>
              </FieldLabel>
            </div>
            <div className="flex flex-wrap gap-2">
              <AppButton disabled={!session || createMutation.isPending || !title.trim()} onClick={() => createMutation.mutate()}>
                Create coordination object
              </AppButton>
              <Link to="/app/gantt">
                <AppButton variant="ghost">Open timeline editor</AppButton>
              </Link>
            </div>
          </AppCard>

          <BoardSection
            title="Now"
            eyebrow="Live"
            description="Active, happening today, or ready to move."
            items={buckets.now}
            onStateChange={(id, state) => stateMutation.mutate({ id, state })}
          />
          <BoardSection
            title="Next"
            eyebrow="Upcoming"
            description="Scheduled next without needing full project ceremony."
            items={buckets.next}
            onStateChange={(id, state) => stateMutation.mutate({ id, state })}
          />
          <BoardSection
            title="Backlog"
            eyebrow="Flexible"
            description="Floating, draft, and support clips waiting for a clearer slot."
            items={buckets.backlog}
            onStateChange={(id, state) => stateMutation.mutate({ id, state })}
          />
          <BoardSection
            title="Done"
            eyebrow="Completed"
            description="Finished flows and moments."
            items={buckets.done}
            onStateChange={(id, state) => stateMutation.mutate({ id, state })}
          />
        </div>

        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Reusable flows" title="Templates as timeline blocks" />
            <p className="text-sm text-ink/70">
              Save the shape of real-life sequences, then drop them onto the timeline whenever the same pattern comes around again.
            </p>
            <FieldLabel>
              Anchor date
              <AppInput type="date" value={templateAnchorDate} onChange={(event) => setTemplateAnchorDate(event.target.value)} className="mt-2" />
            </FieldLabel>
            <div className="space-y-3">
              {(templatesQuery.data ?? []).map((template) => (
                <AppPanel key={template.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-ink">{template.title}</p>
                      <p className="mt-1 text-sm text-ink/65">{template.summary || 'No summary yet.'}</p>
                    </div>
                    <AppPill tone="teal">{template.blocks.length} blocks</AppPill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.blocks.slice(0, 4).map((block, index) => (
                      <AppPill key={`${template.id}-${index}`} tone="butter">
                        {block.title}
                      </AppPill>
                    ))}
                  </div>
                  <AppButton
                    variant="secondary"
                    disabled={!session || applyTemplateMutation.isPending}
                    onClick={() => applyTemplateMutation.mutate(template.id)}
                  >
                    Apply to timeline
                  </AppButton>
                </AppPanel>
              ))}
              {!templatesQuery.data?.length ? (
                <AppPanel className="space-y-3">
                  <p className="text-sm text-ink/70">No reusable flows yet. You can seed a few strong starting patterns or create your own below.</p>
                  <AppButton variant="secondary" disabled={!session || starterTemplatesMutation.isPending} onClick={() => starterTemplatesMutation.mutate()}>
                    Add starter templates
                  </AppButton>
                </AppPanel>
              ) : null}
            </div>
          </AppCard>

          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Custom template" title="Define your own sequence" />
            <FieldLabel>
              Template title
              <AppInput value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} className="mt-2" placeholder="Annual birthday prep, concert night, medical admin..." />
            </FieldLabel>
            <FieldLabel>
              Summary
              <AppTextarea value={templateSummary} onChange={(event) => setTemplateSummary(event.target.value)} className="mt-2 min-h-20" placeholder="What pattern does this capture?" />
            </FieldLabel>
            <FieldLabel>
              Template surface
              <AppSelect value={templateDisplayKind} onChange={(event) => setTemplateDisplayKind(event.target.value as CoordinationDisplayKind)} className="mt-2">
                {displayOptions.filter((option) => ['plan', 'workflow', 'project'].includes(option.value)).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AppSelect>
            </FieldLabel>
            <FieldLabel>
              Blocks JSON
              <AppTextarea
                value={templateJson}
                onChange={(event) => setTemplateJson(event.target.value)}
                className="mt-2 min-h-40 font-mono text-xs"
                placeholder={`[
  { "title": "Invite people", "kind": "message", "displayKind": "chat", "intent": "notify", "offsetDays": -7, "durationDays": 1, "lane": "People" },
  { "title": "Main event", "kind": "event", "displayKind": "event", "intent": "celebrate", "offsetDays": 0, "durationDays": 1, "lane": "Main event" }
]`}
              />
            </FieldLabel>
            {templateError ? <AppPanel tone="peach">{templateError}</AppPanel> : null}
            <AppButton disabled={!session || saveTemplateMutation.isPending || !templateTitle.trim() || !templateJson.trim()} onClick={() => saveTemplateMutation.mutate()}>
              Save reusable flow
            </AppButton>
          </AppCard>
        </div>
      </div>
    </div>
  )
}

function BoardSection({
  title,
  eyebrow,
  description,
  items,
  onStateChange,
}: {
  title: string
  eyebrow: string
  description: string
  items: CoordinationObject[]
  onStateChange: (id: string, state: CoordinationObjectState) => void
}) {
  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <p className="text-sm text-ink/65">{description}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <AppPanel key={item.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <AppPill tone="butter">{item.displayKind}</AppPill>
                  <AppPill tone="teal">{item.intent}</AppPill>
                  <AppPill>{item.state}</AppPill>
                </div>
                <p className="mt-3 text-lg font-extrabold text-ink">{item.title}</p>
                {item.summary ? <p className="mt-1 text-sm text-ink/70">{item.summary}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.state !== 'active' ? (
                  <AppButton variant="ghost" onClick={() => onStateChange(item.id, 'active')}>
                    Start
                  </AppButton>
                ) : null}
                {item.state !== 'completed' ? (
                  <AppButton variant="secondary" onClick={() => onStateChange(item.id, 'completed')}>
                    Complete
                  </AppButton>
                ) : null}
                {item.state === 'completed' ? (
                  <AppButton variant="ghost" onClick={() => onStateChange(item.id, 'archived')}>
                    Archive
                  </AppButton>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-ink/60">
              <span>{formatTimeWindow(item)}</span>
              {getParticipantNames(item).length ? <span>Participants: {getParticipantNames(item).join(', ')}</span> : null}
              {item.linkedProjectId ? <span>Linked project</span> : null}
            </div>
          </AppPanel>
        ))}
        {!items.length ? <AppPanel className="text-sm text-ink/60">Nothing in this lane yet.</AppPanel> : null}
      </div>
    </AppCard>
  )
}

function groupCoordinationObjects(items: CoordinationObject[]) {
  const today = new Date().toISOString().slice(0, 10)

  return {
    now: items.filter((item) => item.state === 'active' || normalizeDay(item.time.startsAt || item.time.dueAt) === today),
    next: items.filter((item) => !['active', 'completed', 'archived'].includes(item.state) && isFutureish(item)),
    backlog: items.filter((item) => ['draft', 'pending'].includes(item.state) || (!item.time.startsAt && !item.time.dueAt)),
    done: items.filter((item) => item.state === 'completed'),
  }
}

function isFutureish(item: CoordinationObject) {
  const day = normalizeDay(item.time.startsAt || item.time.dueAt)
  if (!day) return false
  return day > new Date().toISOString().slice(0, 10)
}

function normalizeDay(value?: string | null) {
  return value ? value.slice(0, 10) : null
}

function formatTimeWindow(item: CoordinationObject) {
  const start = normalizeDay(item.time.startsAt)
  const end = normalizeDay(item.time.endsAt)
  const due = normalizeDay(item.time.dueAt)

  if (start && end && start !== end) return `${start} to ${end}`
  if (start) return `Starts ${start}`
  if (due) return `Due ${due}`
  return 'Flexible timing'
}

function getParticipantNames(item: CoordinationObject) {
  const participants = (item.metadata?.participants as Array<{ participantName: string; role: string }> | undefined) ?? []
  return participants.filter((participant) => participant.role !== 'owner').map((participant) => participant.participantName)
}

function parseTemplateBlocks(value: string) {
  const parsed = JSON.parse(value) as CoordinationTemplateBlock[]
  if (!Array.isArray(parsed) || !parsed.every((block) => typeof block?.title === 'string' && typeof block?.kind === 'string' && typeof block?.displayKind === 'string' && typeof block?.intent === 'string')) {
    throw new Error('Template blocks must be a JSON array with title, kind, displayKind, and intent on each block.')
  }
  return parsed
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function toStartIso(day: string) {
  return `${day}T00:00:00.000Z`
}

function toEndIso(day: string) {
  return `${day}T23:59:59.000Z`
}

function toDueIso(day: string) {
  return `${day}T17:00:00.000Z`
}

export const coordinationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'coordination',
  component: CoordinationPage,
})
