import { useState } from 'react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoordinationTemplate } from '@superapp/types'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, FieldLabel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { TemplatePreview } from '@/components/template-preview'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects } from '@/lib/projects'
import { fetchCoordinationTemplates, instantiateCoordinationTemplate, seedStarterCoordinationTemplates } from '@/lib/coordination-objects'

function PlanningHelperPage() {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [anchorDate, setAnchorDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const templates = useQuery({ queryKey: ['coordination-templates'], queryFn: fetchCoordinationTemplates })
  const seed = useMutation({ mutationFn: () => seedStarterCoordinationTemplates(session!.user.id), onSuccess: () => { void client.invalidateQueries({ queryKey: ['coordination-templates'] }) } })
  const apply = useMutation({
    mutationFn: (template: CoordinationTemplate) => instantiateCoordinationTemplate({ ownerId: session!.user.id, template, anchorDate, linkedProjectId: projectId || null }),
    onSuccess: (id) => {
      void client.invalidateQueries({ queryKey: ['coordination-objects'] })
      void navigate({ to: '/app/coordination/$coordinationId', params: { coordinationId: id } })
    },
  })
  const matches = (templates.data ?? []).filter(template => `${template.title} ${template.summary ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <div className="space-y-4">
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Planning helper" title="Find the steps around your idea" action={<AppButton variant="ghost" disabled={!session || seed.isPending} onClick={() => seed.mutate()}>Add starter plans</AppButton>} />
      <p className="text-sm text-ink/70">Use a reusable plan to work backwards from a date. Preview the preparation and follow-up, then add the steps to your calendar and timeline. This helper uses saved templates, not AI-generated advice.</p>
      <FieldLabel>Find a starting point<AppInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Birthday, appointment, move…" /></FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel>Main date / day zero<AppInput type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)} /></FieldLabel>
        <FieldLabel>Attach to a project (optional)<AppSelect value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Keep as a standalone plan</option>{(projects.data ?? []).map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</AppSelect></FieldLabel>
      </div>
      <p className="text-sm text-ink/70">Day zero is the template's reference date. Check the preview: birthday plans count back from the birthday; an appointment flow starts with the booking request.</p>
      <Link to="/app/coordination" className="inline-block text-sm underline">Create your own reusable plan</Link>
      {(apply.error || seed.error || templates.error || projects.error) ? <p role="alert">{(apply.error || seed.error || templates.error || projects.error)?.message}</p> : null}
    </AppCard>
    {templates.isPending ? <p role="status">Loading plans…</p> : null}
    {!templates.isPending && !templates.isError && !templates.data?.length ? <AppCard><p className="mb-3 text-sm">Start with birthday, wedding, business launch, appointment and moving plans. You can create your own sequence too.</p><AppButton disabled={!session || seed.isPending} onClick={() => seed.mutate()}>{seed.isPending ? 'Adding…' : 'Add starter plans'}</AppButton></AppCard> : null}
    {templates.data?.length && !matches.length ? <p>No matching plans. Try another term or create your own.</p> : null}
    <div className="grid gap-4 lg:grid-cols-2">{matches.map(template => <AppCard key={template.id} className="space-y-4">
      <SectionHeading eyebrow={`${template.blocks.length} steps`} title={template.title} />
      <p className="text-sm text-ink/70">{template.summary}</p>
      <AppPanel><TemplatePreview blocks={template.blocks} anchorDate={anchorDate} /></AppPanel>
      <AppButton disabled={!session || !anchorDate || apply.isPending || projects.isError} onClick={() => apply.mutate(template)}>{apply.isPending ? 'Adding plan…' : 'Add these steps to my plan'}</AppButton>
    </AppCard>)}</div>
  </div>
}

// Preserve existing bookmarks while replacing the prototype AI surface.
export const aiRoute = createRoute({ getParentRoute: () => appRoute, path: 'ai', component: PlanningHelperPage })
