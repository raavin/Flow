import type { CoordinationTemplateBlock, TemplatePayload } from '@superapp/types'
import { supabase } from './supabase'
import { templateSchedule } from './template-planning'
export function listingTemplateBlocks(payload: TemplatePayload): CoordinationTemplateBlock[] {
  return [
    ...(payload.milestones ?? []).map((step) => ({
      ...step,
      kind: 'task' as const,
      displayKind: 'task' as const,
      intent: 'deliver' as const,
    })),
    ...(payload.tasks ?? []).map((step) => ({
      ...step,
      durationDays: 1,
      kind: 'task' as const,
      displayKind: 'task' as const,
      intent: 'deliver' as const,
    })),
  ]
}
export async function applyTemplate(input: {
  id: string
  templateId: string
  title: string
  blocks: CoordinationTemplateBlock[]
  anchorDate: string
  projectId?: string | null
  newProject?: boolean
  timeZone?: string
}) {
  if (!supabase) throw new Error('Not connected')
  templateSchedule(input.blocks, input.anchorDate)
  const { data, error } = await supabase.rpc('apply_task_template', {
    p_id: input.id,
    p_template_id: input.templateId,
    p_title: input.title,
    p_blocks: input.blocks,
    p_anchor: input.anchorDate,
    p_timezone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_project_id: input.projectId || null,
    p_new_project: input.newProject ?? false,
  })
  if (error) throw error
  return data as { project_id: string | null; object_id: string }
}
