import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppTextarea } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { supabase } from '@/lib/supabase'
import { AppDialog } from './app-dialog'
export function PostSafety({ postId, authorId }: { postId: string; authorId: string }) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState('')
  const change = useMutation({
    mutationFn: async (action: 'mute' | 'block' | 'report') => {
      if (!supabase) throw new Error('Not connected')
      const result =
        action === 'report'
          ? await supabase.from('post_reports').upsert(
              {
                reporter_id: session!.user.id,
                post_id: postId,
                reason: reason.trim(),
              },
              { onConflict: 'reporter_id,post_id' },
            )
          : await supabase.from('social_preferences').upsert(
              {
                user_id: session!.user.id,
                subject_id: authorId,
                ...(action === 'mute' ? { muted: true } : { blocked: true }),
              },
              { onConflict: 'user_id,subject_id' },
            )
      if (result.error) throw result.error
      return action
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['social-feed'] })
    },
  })
  if (session?.user.id === authorId) return null
  return (
    <div className="w-full space-y-1 border-t border-border pt-2 text-sm">
      <button type="button" className="block min-h-11" onClick={() => change.mutate('mute')}>
        Mute account
      </button>
      <button type="button" className="block min-h-11" onClick={() => change.mutate('block')}>
        Block account
      </button>
      <button type="button" className="block min-h-11" onClick={() => setReport(true)}>
        Report post
      </button>
      {change.isError && <p role="alert">Could not save. Try again.</p>}
      {report && (
        <AppDialog title="Report post" onClose={() => setReport(false)}>
          {change.data === 'report' ? (
            <p role="status">Report saved for review.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                change.mutate('report')
              }}
            >
              <label className="grid gap-1">
                Reason
                <AppTextarea
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <AppButton type="submit" disabled={change.isPending || !reason.trim()}>
                Submit report
              </AppButton>
            </form>
          )}
        </AppDialog>
      )}
    </div>
  )
}
