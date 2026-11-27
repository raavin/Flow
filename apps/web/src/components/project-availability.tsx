import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, SectionHeading } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjectDetail } from '@/lib/projects'
import { supabase } from '@/lib/supabase'
import { QueryFeedback, MutationFeedback } from './request-feedback'
export function ProjectAvailability({ projectId }: { projectId: string }) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const project = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const isOwner = project.data?.ownerId === session?.user.id && !!session
  const query = useQuery({
    queryKey: ['availability', projectId],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('availability_slots')
        .select('id,starts_at,ends_at,availability_votes(profile_id,answer)')
        .eq('project_id', projectId)
        .order('starts_at')
      if (error) throw error
      return data ?? []
    },
  })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['availability', projectId] })
  }
  const add = useMutation({
    mutationFn: async () => {
      if (new Date(end) <= new Date(start)) throw new Error('End must be after start')
      const { error } = await supabase!.from('availability_slots').insert({
        project_id: projectId,
        owner_id: session!.user.id,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      setStart('')
      setEnd('')
    },
  })
  const vote = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      const { error } = await supabase!
        .from('availability_votes')
        .upsert({ slot_id: id, profile_id: session!.user.id, answer }, { onConflict: 'slot_id,profile_id' })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  return (
    <AppCard className="space-y-4">
      <SectionHeading title="Availability" />
      <p className="text-sm text-ink/65">
        Suggest times and let each person respond. Times are shown in{' '}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      {isOwner && (
        <details>
          <summary className="cursor-pointer min-h-11 py-3 font-semibold">Suggest a time</summary>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate()
            }}
          >
            <label>
              Starts
              <AppInput
                required
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Ends
              <AppInput required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <AppButton type="submit" disabled={add.isPending}>
              Add option
            </AppButton>
            {add.isError && <p role="alert">{add.error.message}</p>}
          </form>
        </details>
      )}
      <QueryFeedback query={query} />
      <MutationFeedback mutation={vote} />
      <div className="divide-y divide-border">
        {query.data?.map((slot) => (
          <div key={slot.id} className="space-y-3 py-4">
            <p className="font-semibold">
              {new Date(slot.starts_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              –{' '}
              {new Date(slot.ends_at).toLocaleTimeString(undefined, {
                timeStyle: 'short',
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['yes', 'maybe', 'no'] as const).map((answer) => (
                <AppButton
                  key={answer}
                  variant={
                    slot.availability_votes.some(
                      (v) => v.profile_id === session?.user.id && v.answer === answer,
                    )
                      ? 'primary'
                      : 'secondary'
                  }
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ id: slot.id, answer })}
                >
                  {answer === 'yes' ? 'Yes' : answer === 'maybe' ? 'Maybe' : 'No'} (
                  {slot.availability_votes.filter((v) => v.answer === answer).length})
                </AppButton>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!query.isPending && !query.isError && !query.data?.length && (
        <p className="text-sm text-ink/60">No times proposed yet.</p>
      )}
    </AppCard>
  )
}
