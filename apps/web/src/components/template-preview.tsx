import type { CoordinationTemplateBlock } from '@superapp/types'
import { templateSchedule } from '@/lib/template-planning'

export function TemplatePreview({ blocks, anchorDate }: { blocks: CoordinationTemplateBlock[]; anchorDate: string }) {
  try {
    const steps = templateSchedule(blocks, anchorDate)
    return <ol className="space-y-2 text-sm">{steps.map((step, index) => <li key={index} className="flex flex-wrap justify-between gap-2 border-b border-ink/10 pb-2"><span>{step.title}</span><span className="text-ink/70">{step.startsOn}{step.endsOn !== step.startsOn ? ` → ${step.endsOn}` : ''}</span></li>)}</ol>
  } catch (error) {
    return <p className="text-sm text-ink/70">{error instanceof Error ? error.message : 'Choose a date to preview this plan.'}</p>
  }
}
