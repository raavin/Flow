import { supabase } from './supabase'
import { createTask, createCalendarEvent } from './projects'

export async function fetchAiActions(projectId?: string) {
  if (!supabase) return []
  let query = supabase
    .from('ai_actions')
    .select('id, linked_project_id, prompt, suggestion_type, suggestion_title, suggestion_detail, status, created_at')
    .order('created_at', { ascending: false })
  if (projectId) {
    query = query.eq('linked_project_id', projectId)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createAiSuggestions(input: {
  ownerId: string
  linkedProjectId?: string | null
  prompt: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const normalized = input.prompt.toLowerCase()
  const suggestions = [
    normalized.includes('cost') || normalized.includes('budget')
      ? {
          suggestion_type: 'estimate',
          suggestion_title: 'Estimate missing categories',
          suggestion_detail: 'Add transport and supplies estimates to avoid surprise spend.',
        }
      : {
          suggestion_type: 'task',
          suggestion_title: 'Book van by Tuesday',
          suggestion_detail: 'Booking early keeps the Saturday move window flexible.',
        },
    {
      suggestion_type: 'message',
      suggestion_title: 'Nudge helpers for availability',
      suggestion_detail: 'Ask who can do Saturday morning versus Sunday afternoon.',
    },
    {
      suggestion_type: 'listing',
      suggestion_title: 'Shortlist a cleaner',
      suggestion_detail: 'A move-out clean fits this timeline and budget shape well.',
    },
  ]

  const { error } = await supabase.from('ai_actions').insert(
    suggestions.map((suggestion) => ({
      owner_id: input.ownerId,
      linked_project_id: input.linkedProjectId ?? null,
      prompt: input.prompt,
      ...suggestion,
    })),
  )
  if (error) throw error
}

export async function updateAiActionStatus(actionId: string, status: 'open' | 'accepted' | 'ignored') {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('ai_actions').update({ status }).eq('id', actionId)
  if (error) throw error
}

export async function acceptAiAction(input: {
  ownerId: string
  actionId: string
  linkedProjectId?: string | null
  suggestionType: string
  suggestionTitle: string
}) {
  await updateAiActionStatus(input.actionId, 'accepted')

  if (!input.linkedProjectId) return

  if (input.suggestionType === 'task' || input.suggestionType === 'estimate') {
    await createTask({
      projectId: input.linkedProjectId,
      title: input.suggestionTitle,
    })
    return
  }

  if (input.suggestionType === 'message') {
    await createCalendarEvent({
      ownerId: input.ownerId,
      projectId: input.linkedProjectId,
      title: input.suggestionTitle,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      notes: 'Created from AI suggestion',
    })
  }
}
