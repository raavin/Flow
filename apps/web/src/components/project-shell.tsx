import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { AppButton, AppCard, AppPill, AppSelect } from '@superapp/ui'
import { deleteProject, fetchProjectDetail, updateProject } from '@/lib/projects'
import type { Project } from '@superapp/types'

type EditField = 'title' | 'category' | 'targetDate' | 'status' | null

export function ProjectShell({
  projectId,
  activeTab,
  children,
}: {
  projectId: string
  activeTab: 'conversation' | 'calendar' | 'timeline' | 'store' | 'people'
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('flow:last-project', JSON.stringify({ projectId, activeTab }))
  }, [activeTab, projectId])

  const project = detailQuery.data?.project

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
    if (!project) return
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
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
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
    if (!project) return
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
    { key: 'conversation', label: 'Conversation', to: '/app/projects/$projectId/conversation' as const },
    { key: 'calendar', label: 'Calendar', to: '/app/projects/$projectId/calendar' as const },
    { key: 'timeline', label: 'Timeline', to: '/app/projects/$projectId/timeline' as const },
    { key: 'store', label: 'Store', to: '/app/projects/$projectId/store' as const },
    { key: 'people', label: 'People', to: '/app/projects/$projectId/people' as const },
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
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => saveField('title')}
                onKeyDown={(e) => handleKeyDown(e, 'title')}
                className="mt-0.5 w-full bg-transparent text-2xl font-extrabold text-ink outline-none border-b-2 border-ink/40 focus:border-ink"
              />
            ) : (
              <h2
                className="mt-0.5 text-2xl font-extrabold text-ink cursor-text group/title flex items-center gap-2"
                onDoubleClick={() => beginEdit('title')}
                title="Double-click to edit title"
              >
                {project?.title ?? 'Project'}
                <Pencil className="h-3.5 w-3.5 text-ink/30 opacity-0 group-hover/title:opacity-100 transition-opacity" />
              </h2>
            )}

            {/* Category · target date — click to edit */}
            {project ? (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-ink/70">
                {editingField === 'category' ? (
                  <input
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
                    onClick={() => beginEdit('targetDate')}
                    title="Click to edit target date"
                  >
                    {project.targetDate ?? 'to be decided'}
                  </button>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/70">Loading project context...</p>
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
                <AppButton variant="ghost" onClick={() => setDeleteConfirm(true)}>
                  Delete
                </AppButton>
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
                    updateMutation.mutate({ status: e.target.value as Project['status'] })
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
              <button type="button" onClick={() => beginEdit('status')} title="Click to change status">
                <AppPill tone="butter" className="cursor-pointer hover:opacity-75">{project.status}</AppPill>
              </button>
            )}
            {project.targetDate ? <AppPill tone="teal">{project.targetDate}</AppPill> : null}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link key={tab.key} to={tab.to} params={{ projectId }}>
              <AppButton variant={activeTab === tab.key ? 'primary' : 'ghost'}>{tab.label}</AppButton>
            </Link>
          ))}
        </div>
      </AppCard>

      {children}
    </div>
  )
}
