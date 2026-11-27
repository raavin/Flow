import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoordinationTemplateBlock } from '@superapp/types'
import { AppButton, AppInput, AppSelect } from '@superapp/ui'
import { AppDialog } from './app-dialog'
import { TemplatePreview } from './template-preview'
import { fetchProjects } from '@/lib/projects'
import { applyTemplate } from '@/lib/apply-template'
import { useAppStore } from '@/hooks/useAppStore'
export function ApplyTemplateDialog({
  template,
  onClose,
}: {
  template: { id: string; title: string; blocks: CoordinationTemplateBlock[] }
  onClose: () => void
}) {
  const [id] = useState(() => crypto.randomUUID())
  const [title, setTitle] = useState(template.title)
  const [date, setDate] = useState('')
  const [project, setProject] = useState('new')
  const [selected, setSelected] = useState(() => template.blocks.map((_, i) => i))
  const { profile } = useAppStore()
  const client = useQueryClient()
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const blocks = template.blocks.filter((_, i) => selected.includes(i))
  const apply = useMutation({
    mutationFn: () =>
      applyTemplate({
        id,
        templateId: template.id,
        title,
        blocks,
        anchorDate: date,
        projectId: project === 'new' || project === 'personal' ? null : project,
        newProject: project === 'new',
        timeZone: profile?.time_zone,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['projects'] })
      void client.invalidateQueries({ queryKey: ['coordination-objects'] })
    },
  })
  return (
    <AppDialog title={apply.isSuccess ? 'Template added' : 'Use template'} onClose={onClose} wide>
      {apply.data ? (
        <div className="space-y-4">
          <p role="status">{blocks.length} steps added.</p>
          <div className="flex gap-3">
            <AppButton onClick={onClose}>Done</AppButton>
            {apply.data.project_id ? (
              <Link
                className="inline-flex min-h-11 items-center underline"
                to="/app/projects/$projectId/tasks"
                params={{ projectId: apply.data.project_id }}
              >
                Open tasks
              </Link>
            ) : (
              <Link className="inline-flex min-h-11 items-center underline" to="/app/coordination">
                Open my tasks
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            apply.mutate()
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">
            Project
            <AppSelect value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="new">New project</option>
              <option value="personal">My plans</option>
              {projects.data
                ?.filter((p) => p.isOwner)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </AppSelect>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {project === 'new' ? 'Project name' : 'Task group name'}
            <AppInput value={title} required onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Event or target date
            <AppInput type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Steps to include</legend>
            {template.blocks.map((step, i) => (
              <label key={i} className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-5 w-5"
                  type="checkbox"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((items) => (e.target.checked ? [...items, i] : items.filter((x) => x !== i)))
                  }
                />
                <span>
                  {step.title}
                  <span className="ml-2 text-ink/60">
                    {(step.offsetDays ?? 0) < 0
                      ? `${Math.abs(step.offsetDays ?? 0)} days before`
                      : (step.offsetDays ?? 0) > 0
                        ? `${step.offsetDays} days after`
                        : 'On the day'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {date && blocks.length > 0 && <TemplatePreview blocks={blocks} anchorDate={date} />}
          {apply.isError && (
            <p role="alert" className="text-sm text-berry">
              {apply.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AppButton type="button" variant="ghost" onClick={onClose}>
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={apply.isPending || !date || !title.trim() || !blocks.length}>
              {apply.isPending ? 'Adding…' : `Add ${blocks.length} steps`}
            </AppButton>
          </div>
        </form>
      )}
    </AppDialog>
  )
}
