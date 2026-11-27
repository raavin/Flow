import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, SectionHeading } from '@superapp/ui'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/hooks/useAppStore'
import { QueryFeedback, MutationFeedback } from './request-feedback'
export function PrivacySettings() {
  const { session } = useAppStore()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['social-preferences', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase!.from('social_preferences').select('subject_id,muted,blocked')
      if (error) throw error
      if (!data?.length) return []
      const people = await supabase!
        .from('social_profiles')
        .select('id,handle,display_name')
        .in(
          'id',
          data.map((p) => p.subject_id),
        )
      if (people.error) throw people.error
      return data
        .filter((p) => p.muted || p.blocked)
        .map((p) => ({
          ...p,
          name: people.data?.find((person) => person.id === p.subject_id)?.handle ?? 'Account',
        }))
    },
  })
  const change = useMutation({
    mutationFn: async ({ id, field }: { id: string; field: 'muted' | 'blocked' }) => {
      const { error } = await supabase!
        .from('social_preferences')
        .update({ [field]: false })
        .eq('user_id', session!.user.id)
        .eq('subject_id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['social-preferences'] })
      void client.invalidateQueries({ queryKey: ['social-feed'] })
    },
  })
  return (
    <AppCard className="space-y-4">
      <SectionHeading title="Muted and blocked accounts" />
      <QueryFeedback query={query} />
      <MutationFeedback mutation={change} />
      {query.data?.map((p) => (
        <div key={p.subject_id} className="flex flex-wrap items-center gap-3 border-b border-border py-3">
          <p className="flex-1">@{p.name}</p>
          {p.muted && (
            <AppButton
              disabled={change.isPending}
              variant="ghost"
              onClick={() => change.mutate({ id: p.subject_id, field: 'muted' })}
            >
              Unmute
            </AppButton>
          )}
          {p.blocked && (
            <AppButton
              disabled={change.isPending}
              variant="ghost"
              onClick={() => change.mutate({ id: p.subject_id, field: 'blocked' })}
            >
              Unblock
            </AppButton>
          )}
        </div>
      ))}
      {!query.isPending && !query.isError && !query.data?.length && (
        <p className="text-sm text-ink/60">No muted or blocked accounts.</p>
      )}
    </AppCard>
  )
}
