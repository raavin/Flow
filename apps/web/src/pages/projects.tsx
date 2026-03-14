import { useEffect, useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { ProjectShell } from '@/components/project-shell'
import { useAppStore } from '@/hooks/useAppStore'
import { CalendarPage } from '@/pages/calendar'
import { GanttPage } from '@/pages/gantt'
import { MessagesFeedPage } from '@/pages/messages'
import {
  createProject,
  createProjectNote,
  fetchProjectNotes,
  fetchProjects,
  updateProjectNote,
} from '@/lib/projects'
import { fetchPeopleDirectory } from '@/lib/social'
import { fetchParticipants, inviteParticipant, removeParticipant, updateParticipant } from '@/lib/participants'

function ProjectsPage() {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [title, setTitle] = useState('')
  const [lastProject, setLastProject] = useState<{ projectId: string; activeTab: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('flow:last-project')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { projectId?: string; activeTab?: string }
      if (parsed.projectId && parsed.activeTab) {
        setLastProject({ projectId: parsed.projectId, activeTab: parsed.activeTab })
      }
    } catch {
      setLastProject(null)
    }
  }, [])
  const createMutation = useMutation({
    mutationFn: () =>
      createProject({
        ownerId: session!.user.id,
        title,
        category: '',
        targetDate: '',
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      setTitle('')
      void navigate({ to: '/app/projects/$projectId/conversation', params: { projectId: project.id } })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Create" title="Start a project" />
        <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Move house, birthday prep, leave request..." />
        <p className="text-sm text-ink/65">
          Start with just the title. Conversation, calendar, timeline, notes, and people can all be added once you’re inside.
        </p>
        <div className="flex flex-wrap gap-2">
          <AppButton disabled={!session || createMutation.isPending || !title.trim()} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating...' : 'Create project'}
          </AppButton>
          {lastProject ? (
            <AppButton
              variant="ghost"
              onClick={() => {
                const tabRoute =
                  lastProject.activeTab === 'calendar'
                    ? '/app/projects/$projectId/calendar'
                    : lastProject.activeTab === 'timeline'
                      ? '/app/projects/$projectId/timeline'
                      : lastProject.activeTab === 'notes'
                        ? '/app/projects/$projectId/notes'
                        : lastProject.activeTab === 'people'
                          ? '/app/projects/$projectId/people'
                          : '/app/projects/$projectId/conversation'
                void navigate({
                  to: tabRoute,
                  params: { projectId: lastProject.projectId },
                })
              }}
            >
              Continue last project
            </AppButton>
          ) : null}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Projects" title="Your project spaces" />
        <div className="grid gap-3">
          {(projectsQuery.data ?? []).map((project) => (
            <button
              key={project.id}
              type="button"
              className="ui-panel text-left transition hover:-translate-y-0.5"
              onClick={() => void navigate({ to: '/app/projects/$projectId/conversation', params: { projectId: project.id } })}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-ink">{project.title}</p>
                  <p className="text-sm text-ink/65">{project.category || 'General'}</p>
                </div>
                <span className="ui-pill ui-pill--butter py-1">{project.targetDate ?? 'Someday'}</span>
              </div>
            </button>
          ))}
          {!projectsQuery.data?.length ? <p className="text-sm text-ink/60">No projects yet. Create one and land straight in its conversation.</p> : null}
        </div>
      </AppCard>
    </div>
  )
}

function ProjectConversationPage() {
  const { projectId } = projectConversationRoute.useParams()
  return (
    <ProjectShell projectId={projectId} activeTab="conversation">
      <MessagesFeedPage linkedProjectId={projectId} />
    </ProjectShell>
  )
}

function ProjectCalendarPage() {
  const { projectId } = projectCalendarRoute.useParams()
  return (
    <ProjectShell projectId={projectId} activeTab="calendar">
      <CalendarPage linkedProjectId={projectId} />
    </ProjectShell>
  )
}

function ProjectTimelinePage() {
  const { projectId } = projectTimelineRoute.useParams()
  return (
    <ProjectShell projectId={projectId} activeTab="timeline">
      <GanttPage linkedProjectId={projectId} />
    </ProjectShell>
  )
}

function ProjectNotesPage() {
  const { projectId } = projectNotesRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const notesQuery = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: () => fetchProjectNotes(projectId),
  })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: () =>
      editingNoteId
        ? updateProjectNote({ noteId: editingNoteId, title, body })
        : createProjectNote({
            ownerId: session!.user.id,
            projectId,
            title,
            body,
          }),
    onSuccess: () => {
      setTitle('')
      setBody('')
      setEditingNoteId(null)
      void queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
    },
  })

  return (
    <ProjectShell projectId={projectId} activeTab="notes">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow={editingNoteId ? 'Edit note' : 'Add note'} title={editingNoteId ? 'Update project note' : 'Capture a project note'} />
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <AppTextarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-48" placeholder="Write what matters for this project..." />
          <div className="flex gap-2">
            <AppButton disabled={!session || saveMutation.isPending || !body.trim()} onClick={() => saveMutation.mutate()}>
              {editingNoteId ? 'Save changes' : 'Add note'}
            </AppButton>
            {(editingNoteId || title || body) ? (
              <AppButton
                variant="ghost"
                onClick={() => {
                  setEditingNoteId(null)
                  setTitle('')
                  setBody('')
                }}
              >
                Reset
              </AppButton>
            ) : null}
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Notes" title="Project memory" />
          <div className="grid gap-3">
            {(notesQuery.data ?? []).map((note) => (
              <button
                key={note.id}
                type="button"
                className="ui-panel text-left transition hover:-translate-y-0.5"
                onClick={() => {
                  setEditingNoteId(note.id)
                  setTitle(note.title)
                  setBody(note.body)
                }}
              >
                <p className="font-extrabold text-ink">{note.title}</p>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-ink/70">{note.body}</p>
                <p className="mt-2 text-xs font-bold text-ink/45">Updated {note.updated_at.slice(0, 16).replace('T', ' ')}</p>
              </button>
            ))}
            {!notesQuery.data?.length ? <AppPanel className="text-sm text-ink/60">No notes yet. Capture decisions, reminders, or background here.</AppPanel> : null}
          </div>
        </AppCard>
      </div>
    </ProjectShell>
  )
}

function ProjectPeoplePage() {
  const { projectId } = projectPeopleRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const [participantQuery, setParticipantQuery] = useState('@')
  const participantsQuery = useQuery({
    queryKey: ['participants', projectId],
    queryFn: () => fetchParticipants(projectId),
  })
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })

  const filteredPeople = (peopleQuery.data ?? []).filter((person) => {
    const query = participantQuery.replace(/^@/, '').trim().toLowerCase()
    if (!query) return true
    return person.handle.toLowerCase().includes(query) || (person.display_name || '').toLowerCase().includes(query)
  })

  const addMutation = useMutation({
    mutationFn: ({ name, handle }: { name: string; handle: string }) =>
      inviteParticipant({
        ownerId: session!.user.id,
        projectId,
        name,
        participantKind: 'person',
        role: 'collaborator',
        contactHint: `@${handle}`,
        note: '',
      }),
    onSuccess: () => {
      setParticipantQuery('@')
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeParticipant(participantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })

  const activateMutation = useMutation({
    mutationFn: (participantId: string) => updateParticipant({ participantId, status: 'active' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })

  return (
    <ProjectShell projectId={projectId} activeTab="people">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Add people" title="Bring the right people in" />
          <AppInput
            value={participantQuery}
            onChange={(event) => setParticipantQuery(event.target.value.startsWith('@') ? event.target.value : `@${event.target.value}`)}
            placeholder="@name"
          />
          <div className="grid gap-2">
            {filteredPeople.slice(0, 6).map((person) => (
              <button
                key={person.id}
                type="button"
                className="ui-panel flex items-center justify-between gap-3 text-left transition hover:-translate-y-0.5"
                onClick={() =>
                  addMutation.mutate({
                    name: person.display_name || person.handle,
                    handle: person.handle,
                  })
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{person.display_name || person.handle}</p>
                  <p className="truncate text-sm text-ink/55">@{person.handle}</p>
                </div>
                <span className="ui-pill ui-pill--butter">Add</span>
              </button>
            ))}
            {!filteredPeople.length ? <AppPanel className="text-sm text-ink/60">No matching people yet.</AppPanel> : null}
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="People" title="Current participants" />
          <div className="grid gap-3">
            {(participantsQuery.data ?? []).map((participant) => (
              <AppPanel key={participant.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{participant.name}</p>
                    <p className="text-sm text-ink/65">
                      {participant.role} · {participant.status}
                    </p>
                    {participant.contact_hint ? <p className="text-xs font-bold text-berry">{participant.contact_hint}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participant.status !== 'active' ? (
                      <AppButton variant="ghost" onClick={() => activateMutation.mutate(participant.id)}>
                        Activate
                      </AppButton>
                    ) : null}
                    <AppButton variant="secondary" onClick={() => removeMutation.mutate(participant.id)}>
                      Remove
                    </AppButton>
                  </div>
                </div>
              </AppPanel>
            ))}
            {!participantsQuery.data?.length ? <AppPanel className="text-sm text-ink/60">No one added yet.</AppPanel> : null}
          </div>
        </AppCard>
      </div>
    </ProjectShell>
  )
}

function ProjectEntryPage() {
  const { projectId } = projectDetailRoute.useParams()
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: '/app/projects/$projectId/conversation', params: { projectId }, replace: true })
  }, [navigate, projectId])

  return <AppCard>Opening project...</AppCard>
}

export const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects',
  component: ProjectsPage,
})

export const projectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId',
  component: ProjectEntryPage,
})

export const projectConversationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/conversation',
  component: ProjectConversationPage,
})

export const projectCalendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/calendar',
  component: ProjectCalendarPage,
})

export const projectTimelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/timeline',
  component: ProjectTimelinePage,
})

export const projectNotesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/notes',
  component: ProjectNotesPage,
})

export const projectPeopleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/people',
  component: ProjectPeoplePage,
})
