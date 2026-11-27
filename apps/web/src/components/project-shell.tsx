import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { AppButton, AppCard, AppPill, AppSelect } from '@superapp/ui'
import { deleteProject, fetchProjectDetail, updateProject } from '@/lib/projects'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { useAppStore } from '@/hooks/useAppStore'
import type { Project } from '@superapp/types'

type EditField = 'title' | 'category' | 'targetDate' | 'status' | null

export function ProjectShell({
  projectId,
  activeTab,
  children,
}: {
  projectId: string
  activeTab:
    | 'tasks'
    | 'conversation'
    | 'calendar'
    | 'timeline'
    | 'store'
    | 'people'
    | 'budget'
    | 'notes'
    | 'availability'
    | 'updates'
  children: ReactNode
}) {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('flow:last-project', JSON.stringify({ projectId, activeTab }))
    } catch {
      // Remembering the last view is optional; project pages must still open.
    }
  }, [activeTab, projectId])

  const project = detailQuery.data?.project
  const isOwner = detailQuery.data?.ownerId === session?.user.id && !!session

  // ── Inline edit state ──────────────────────────────────────────────
  const [editingField, setEditingField] = useState<EditField>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')
  const [editStatus, setEditStatus] = useState<Project['status']>('active')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const categoryInputRef = useRef<HTMLInputElement>(null)

  function beginEdit(field: Exclude<EditField, null>) {
    if (!project || !isOwner) return
    if (field === 'title') setEditTitle(project.title)
    if (field === 'category') setEditCategory(project.category || '')
    if (field === 'targetDate') setEditTargetDate(project.targetDate || '')
    if (field === 'status') setEditStatus(project.status)
    setEditingField(field)
    setDeleteConfirm(false)
  }

  useEffect(() => {
    if (editingField === 'title') titleInputRef.current?.select()
    if (editingField === 'category') categoryInputRef.current?.select()
  }, [editingField])

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateProject>[1]) => updateProject(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['project-detail', projectId],
      })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void navigate({ to: '/app/projects' })
    },
  })

  function saveField(field: Exclude<EditField, null>) {
    if (!project || !isOwner) return
    setEditingField(null)
    if (field === 'title' && editTitle.trim() && editTitle.trim() !== project.title) {
      updateMutation.mutate({ title: editTitle.trim() })
    }
    if (field === 'category' && editCategory.trim() !== (project.category || '')) {
      updateMutation.mutate({ category: editCategory.trim() })
    }
    if (field === 'targetDate' && editTargetDate !== (project.targetDate || '')) {
      updateMutation.mutate({ targetDate: editTargetDate || null })
    }
    if (field === 'status' && editStatus !== project.status) {
      updateMutation.mutate({ status: editStatus })
    }
  }

  function cancelEdit() {
    setEditingField(null)
  }

  function handleKeyDown(e: React.KeyboardEvent, field: Exclude<EditField, null>) {
    if (e.key === 'Enter') saveField(field)
    if (e.key === 'Escape') cancelEdit()
  }

  // ── Tabs ───────────────────────────────────────────────────────────
  const tabs = [
    {
      key: 'conversation',
      label: 'Conversation',
      to: '/app/projects/$projectId/conversation',
    },
    { key: 'tasks', label: 'Tasks', to: '/app/projects/$projectId/tasks' },
    {
      key: 'calendar',
      label: 'Calendar',
      to: '/app/projects/$projectId/calendar',
    },
    { key: 'timeline', label: 'Timeline', to: '/app/projects/$projectId/timeline' },
    { key: 'notes', label: 'Notes', to: '/app/projects/$projectId/notes' },
    { key: 'budget', label: 'Budget', to: '/app/projects/$projectId/budget' },
    { key: 'store', label: 'Listings', to: '/app/projects/$projectId/store' },
    { key: 'people', label: 'People', to: '/app/projects/$projectId/people' },
  ] as const

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Left: editable title + subtitle */}
          <div className="min-w-0">
            <p className="ui-eyebrow">Project</p>

            {/* Title — double-click to edit */}
            {editingField === 'title' ? (
              <input
                aria-label="Project title"
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => saveField('title')}
                onKeyDown={(e) => handleKeyDown(e, 'title')}
                className="mt-0.5 w-full bg-transparent text-2xl font-extrabold text-ink outline-none border-b-2 border-ink/40 focus:border-ink"
              />
            ) : (
              <h1
                className="mt-0.5 text-2xl font-extrabold text-ink cursor-text group/title flex items-center gap-2"
                onDoubleClick={() => beginEdit('title')}
                title="Double-click to edit title"
              >
                {project?.title ?? 'Project'}
                {isOwner && (
                  <button
                    type="button"
                    aria-label="Edit project title"
                    className="rounded p-2 text-ink/60 hover:text-ink"
                    onClick={() => beginEdit('title')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </h1>
            )}

            {/* Category · target date — click to edit */}
            {project ? (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-ink/70">
                {editingField === 'category' ? (
                  <input
                    aria-label="Project category"
                    ref={categoryInputRef}
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    onBlur={() => saveField('category')}
                    onKeyDown={(e) => handleKeyDown(e, 'category')}
                    className="w-32 bg-transparent text-sm font-medium text-ink outline-none border-b border-ink/40 focus:border-ink"
                  />
                ) : (
                  <button
                    type="button"
                    className="hover:text-ink hover:underline decoration-dotted"
                    disabled={!isOwner}
                    onClick={() => beginEdit('category')}
                    title="Click to edit category"
                  >
                    {project.category || 'General'}
                  </button>
                )}
                <span>·</span>
                <span>target</span>
                {editingField === 'targetDate' ? (
                  <input
                    aria-label="Target date"
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    onBlur={() => saveField('targetDate')}
                    onKeyDown={(e) => handleKeyDown(e, 'targetDate')}
                    className="bg-transparent text-sm font-medium text-ink outline-none border-b border-ink/40 focus:border-ink"
                  />
                ) : (
                  <button
                    type="button"
                    className="hover:text-ink hover:underline decoration-dotted"
                    disabled={!isOwner}
                    onClick={() => beginEdit('targetDate')}
                    title="Click to edit target date"
                  >
                    {project.targetDate ?? 'to be decided'}
                  </button>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/70">Project unavailable.</p>
            )}
          </div>

          {/* Right: nav + delete actions */}
          <div className="flex flex-wrap items-center gap-2">
            {deleteConfirm ? (
              <>
                <span className="text-sm font-bold text-red-600">Delete this project?</span>
                <AppButton
                  variant="secondary"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                </AppButton>
                <AppButton variant="ghost" onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </AppButton>
              </>
            ) : (
              <>
                {isOwner && (
                  <AppButton variant="ghost" onClick={() => setDeleteConfirm(true)}>
                    Delete
                  </AppButton>
                )}
                <Link to="/app/projects">
                  <AppButton variant="ghost">All projects</AppButton>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Status pill — click to cycle / select */}
        {project ? (
          <div className="flex flex-wrap items-center gap-2">
            {editingField === 'status' ? (
              <AppSelect
                value={editStatus}
                onChange={(e) => {
                  setEditStatus(e.target.value as Project['status'])
                  setEditingField(null)
                  if ((e.target.value as Project['status']) !== project.status) {
                    updateMutation.mutate({
                      status: e.target.value as Project['status'],
                    })
                  }
                }}
                onBlur={() => saveField('status')}
                className="w-36 text-sm"
                autoFocus
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </AppSelect>
            ) : (
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => beginEdit('status')}
                title="Click to change status"
              >
                <AppPill tone="butter" className="cursor-pointer hover:opacity-75">
                  {project.status}
                </AppPill>
              </button>
            )}
          </div>
        ) : null}

        <QueryFeedback query={detailQuery} />
        <MutationFeedback mutation={updateMutation} />
        <MutationFeedback mutation={deleteMutation} />
        {/* Tabs */}
        <nav aria-label="Project navigation" className="flex flex-wrap gap-2">
          {tabs
            .filter((tab) => tab.key !== 'budget' || isOwner)
            .map((tab) => (
              <Link
                key={tab.key}
                to={tab.to}
                params={{ projectId }}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                className={`ui-button min-h-11 ${activeTab === tab.key ? 'ui-button--primary' : 'ui-button--ghost'}`}
              >
                {tab.label}
              </Link>
            ))}
        </nav>
        {(activeTab === 'people' || activeTab === 'availability' || activeTab === 'updates') && (
          <nav aria-label="Project coordination" className="flex flex-wrap gap-3 border-t border-border pt-3">
            <Link
              to="/app/projects/$projectId/people"
              params={{ projectId }}
              aria-current={activeTab === 'people' ? 'page' : undefined}
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              People
            </Link>
            <Link
              to="/app/projects/$projectId/availability"
              params={{ projectId }}
              aria-current={activeTab === 'availability' ? 'page' : undefined}
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              Availability
            </Link>
            <Link
              to="/app/projects/$projectId/updates"
              params={{ projectId }}
              aria-current={activeTab === 'updates' ? 'page' : undefined}
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              Updates
            </Link>
          </nav>
        )}
      </AppCard>

      {children}
    </div>
  )
}
