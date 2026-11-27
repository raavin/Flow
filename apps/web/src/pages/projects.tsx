import { AppDialog } from '@/components/app-dialog'
import { TaskList } from '@/components/task-list'
import { SourceLinks } from '@/components/source-action'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
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
  fetchProjectDetail,
  updateProjectNote,
  deleteProjectNote,
} from '@/lib/projects'
import { fetchPeopleDirectory } from '@/lib/social'
import { fetchListingsByProject, updateListingPublished } from '@/lib/marketplace'
import { fetchParticipants, inviteParticipant, removeParticipant } from '@/lib/participants'

function ProjectsPage() {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('open')
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const invites = useQuery({
    queryKey: ['project-invitations'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('project_invitations')
      if (error) throw error
      return (data ?? []) as {
        id: string
        project_id: string
        title: string
        role: string
      }[]
    },
  })
  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase!.rpc('respond_project_invitation', {
        p_id: id,
        p_accept: accept,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['project-invitations'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
  const create = useMutation({
    mutationFn: () =>
      createProject({
        ownerId: session!.user.id,
        title: title.trim(),
        category: '',
        targetDate: '',
      }),
    onSuccess: (project) => {
      void client.invalidateQueries({ queryKey: ['projects'] })
      void navigate({
        to: '/app/projects/$projectId/conversation',
        params: { projectId: project.id },
      })
    },
  })
  const rows = (projects.data ?? []).filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'completed' ? p.status === 'completed' : p.status !== 'completed')),
  )
  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading
          title="Projects"
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/coordination"
                className="inline-flex min-h-11 items-center px-3 text-sm underline"
              >
                Plans
              </Link>
              <Link to="/app/ai" className="inline-flex min-h-11 items-center px-3 text-sm underline">
                Templates
              </Link>
              <AppButton onClick={() => setAdding(true)}>New project</AppButton>
            </div>
          }
        />
        {invites.data?.map((i) => (
          <div key={i.id} className="ui-panel flex flex-wrap items-center justify-between gap-3">
            <p>
              Invitation to <strong>{i.title}</strong>
            </p>
            <div className="flex gap-2">
              <AppButton
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: i.id, accept: true })}
              >
                Accept
              </AppButton>
              <AppButton
                disabled={respond.isPending}
                variant="ghost"
                onClick={() => respond.mutate({ id: i.id, accept: false })}
              >
                Decline
              </AppButton>
            </div>
          </div>
        ))}
        <MutationFeedback mutation={respond} />
        <div className="flex flex-wrap gap-3">
          <AppInput
            aria-label="Search projects"
            placeholder="Search projects"
            className="min-w-0 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <AppSelect
            aria-label="Project status"
            className="w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </AppSelect>
        </div>
        <QueryFeedback query={projects} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-ink/60">
              <tr>
                <th className="py-3 pr-3">Project</th>
                <th className="py-3 pr-3">Target date</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="py-4 pr-3">
                    <Link
                      className="font-semibold hover:underline"
                      to="/app/projects/$projectId"
                      params={{ projectId: p.id }}
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink/60">{p.category}</p>
                  </td>
                  <td className="py-4 pr-3">
                    {p.targetDate
                      ? new Date(`${p.targetDate}T12:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Not set'}
                  </td>
                  <td className="py-4 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!projects.isPending && !projects.isError && !rows.length && (
          <p className="py-4 text-sm text-ink/65">
            {search ? 'No matching projects.' : 'No projects here yet. Create one or use a template.'}
          </p>
        )}
      </AppCard>
      {adding && (
        <AppDialog title="New project" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <label className="grid gap-1">
              Project name
              <AppInput required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <MutationFeedback mutation={create} />
            <div className="flex justify-end gap-2">
              <AppButton variant="ghost" type="button" onClick={() => setAdding(false)}>
                Cancel
              </AppButton>
              <AppButton type="submit" disabled={create.isPending || !title.trim()}>
                Create project
              </AppButton>
            </div>
          </form>
        </AppDialog>
      )}
    </div>
  )
}
function ProjectTasksPage() {
  const { projectId } = projectTasksRoute.useParams()
  return (
    <ProjectShell projectId={projectId} activeTab="tasks">
      <TaskList projectId={projectId} />
    </ProjectShell>
  )
}
export const projectTasksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/tasks',
  component: ProjectTasksPage,
})

function ProjectConversationPage() {
  const { projectId } = projectConversationRoute.useParams()
  return (
    <ProjectShell projectId={projectId} activeTab="conversation">
      <SourceLinks projectId={projectId} />
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
  const project = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const isOwner = !!session && project.data?.ownerId === session.user.id
  const notesQuery = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: () => fetchProjectNotes(projectId),
  })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState<string | null>(null)

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
      setEditorOpen(false)
      setTitle('')
      setBody('')
      setEditingNoteId(null)
      void queryClient.invalidateQueries({
        queryKey: ['project-notes', projectId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['project-activity', projectId],
      })
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => deleteProjectNote(noteId),
    onSuccess: () => {
      setDeleteConfirmNoteId(null)
      if (editingNoteId === deleteNoteMutation.variables) {
        setEditingNoteId(null)
        setTitle('')
        setBody('')
      }
      void queryClient.invalidateQueries({
        queryKey: ['project-notes', projectId],
      })
    },
  })

  return (
    <ProjectShell projectId={projectId} activeTab="notes">
      <div className="space-y-4">
        {isOwner && (editorOpen || editingNoteId) && (
          <AppDialog
            title={editingNoteId ? 'Edit note' : 'New note'}
            onClose={() => {
              setEditorOpen(false)
              setEditingNoteId(null)
            }}
          >
            <AppCard className="space-y-4">
              <AppInput
                aria-label="Note title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
              />
              <AppTextarea
                aria-label="Note text"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-48"
                placeholder="Note"
              />
              <div className="flex gap-2">
                <AppButton
                  disabled={!session || saveMutation.isPending || !body.trim()}
                  onClick={() => saveMutation.mutate()}
                >
                  {editingNoteId ? 'Save changes' : 'Add note'}
                </AppButton>
                {editingNoteId || title || body ? (
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
          </AppDialog>
        )}
        <AppCard className="space-y-4">
          <SectionHeading
            title="Notes"
            action={
              isOwner && (
                <AppButton
                  onClick={() => {
                    setTitle('')
                    setBody('')
                    setEditorOpen(true)
                  }}
                >
                  Add note
                </AppButton>
              )
            }
          />
          <QueryFeedback query={notesQuery} />
          <MutationFeedback mutation={saveMutation} />
          <MutationFeedback mutation={deleteNoteMutation} />
          <div className="grid gap-3">
            {(notesQuery.data ?? []).map((note) => (
              <div key={note.id} className="ui-panel">
                <button
                  type="button"
                  disabled={!isOwner}
                  className="w-full text-left transition hover:-translate-y-0.5"
                  onClick={() => {
                    setEditingNoteId(note.id)
                    setTitle(note.title)
                    setBody(note.body)
                  }}
                >
                  <p className="font-extrabold text-ink">{note.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/70">{note.body}</p>
                  <p className="mt-2 text-xs font-bold text-ink/45">
                    Updated {note.updated_at.slice(0, 16).replace('T', ' ')}
                  </p>
                </button>
                {isOwner && (
                  <div className="mt-3 flex gap-2">
                    {deleteConfirmNoteId === note.id ? (
                      <>
                        <span className="text-xs font-bold text-berry self-center">Delete this note?</span>
                        <AppButton
                          variant="secondary"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          disabled={deleteNoteMutation.isPending}
                        >
                          Yes, delete
                        </AppButton>
                        <AppButton variant="ghost" onClick={() => setDeleteConfirmNoteId(null)}>
                          Cancel
                        </AppButton>
                      </>
                    ) : (
                      <AppButton variant="ghost" onClick={() => setDeleteConfirmNoteId(note.id)}>
                        Delete
                      </AppButton>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!notesQuery.data?.length ? (
              <AppPanel className="text-sm text-ink/60">
                No notes yet. Capture decisions, reminders, or background here.
              </AppPanel>
            ) : null}
          </div>
        </AppCard>
      </div>
    </ProjectShell>
  )
}

export function ProjectPeoplePage() {
  const { projectId } = projectPeopleRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const project = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const isOwner = !!session && project.data?.ownerId === session.user.id
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
    return (
      person.handle.toLowerCase().includes(query) || (person.display_name || '').toLowerCase().includes(query)
    )
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
      void queryClient.invalidateQueries({
        queryKey: ['participants', projectId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['project-activity', projectId],
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeParticipant(participantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['participants', projectId],
      })
    },
  })

  return (
    <ProjectShell projectId={projectId} activeTab="people">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {isOwner && (
          <AppCard className="space-y-4">
            <SectionHeading title="Invite people" />
            <MutationFeedback mutation={addMutation} />
            <QueryFeedback query={peopleQuery} />
            <AppInput
              value={participantQuery}
              onChange={(event) =>
                setParticipantQuery(
                  event.target.value.startsWith('@') ? event.target.value : `@${event.target.value}`,
                )
              }
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
                  <span className="ui-pill ui-pill--butter">Invite</span>
                </button>
              ))}
              {!filteredPeople.length ? (
                <AppPanel className="text-sm text-ink/60">No matching people yet.</AppPanel>
              ) : null}
            </div>
          </AppCard>
        )}

        <AppCard className="space-y-4">
          <SectionHeading title="People" />
          <QueryFeedback query={participantsQuery} />
          <MutationFeedback mutation={removeMutation} />
          <div className="grid gap-3">
            {(participantsQuery.data ?? []).map((participant) => (
              <AppPanel key={participant.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{participant.name}</p>
                    <p className="text-sm text-ink/65">
                      {participant.role} · {participant.status}
                    </p>
                    {participant.contact_hint ? (
                      <p className="text-xs font-bold text-berry">{participant.contact_hint}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participant.status === 'invited' ? (
                      <span className="text-sm text-ink/60">Awaiting response</span>
                    ) : null}
                    {isOwner && (
                      <AppButton variant="secondary" onClick={() => removeMutation.mutate(participant.id)}>
                        Remove
                      </AppButton>
                    )}
                  </div>
                </div>
              </AppPanel>
            ))}
            {!participantsQuery.data?.length ? (
              <AppPanel className="text-sm text-ink/60">No one added yet.</AppPanel>
            ) : null}
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
    void navigate({
      to: '/app/projects/$projectId/conversation',
      params: { projectId },
      replace: true,
    })
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

function ProjectStorePage() {
  const { projectId } = projectStoreRoute.useParams()
  const queryClient = useQueryClient()
  const listingsQuery = useQuery({
    queryKey: ['project-listings', projectId],
    queryFn: () => fetchListingsByProject(projectId),
  })

  const togglePublishedMutation = useMutation({
    mutationFn: ({ listingId, isPublished }: { listingId: string; isPublished: boolean }) =>
      updateListingPublished(listingId, isPublished),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['project-listings', projectId],
      }),
  })

  const listings = listingsQuery.data ?? []

  return (
    <ProjectShell projectId={projectId} activeTab="store">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Store" title="Project listings" />
        {listings.length === 0 ? (
          <AppPanel className="text-sm text-ink/60">
            No listings linked to this project yet. Create a listing and set this as the workspace project to
            see it here.
          </AppPanel>
        ) : (
          <div className="grid gap-3">
            {listings.map((listing) => (
              <AppPanel key={listing.id} className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-ink">{listing.title}</p>
                  <p className="text-sm text-ink/65">
                    {listing.kind} · {listing.category} · {listing.price_label}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold ${listing.is_published ? 'text-teal' : 'text-ink/45'}`}>
                    {listing.is_published ? 'Published' : 'Draft'}
                  </span>
                  <AppButton
                    variant={listing.is_published ? 'ghost' : 'secondary'}
                    onClick={() =>
                      togglePublishedMutation.mutate({
                        listingId: listing.id,
                        isPublished: !listing.is_published,
                      })
                    }
                    disabled={togglePublishedMutation.isPending}
                  >
                    {listing.is_published ? 'Unpublish' : 'Publish'}
                  </AppButton>
                </div>
              </AppPanel>
            ))}
          </div>
        )}
      </AppCard>
    </ProjectShell>
  )
}

export const projectStoreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/store',
  component: ProjectStorePage,
})

export const projectPeopleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/people',
  component: ProjectPeoplePage,
})
