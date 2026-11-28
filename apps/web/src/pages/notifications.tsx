import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppPanel, AppSelect, SectionHeading } from '@superapp/ui'

import { fetchNotifications, markNotificationRead } from '@/lib/coordination'

export function NotificationsPage() {
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  })
  const mutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from('notifications').update({ is_read: true }).eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const rows = (notificationsQuery.data ?? []).filter(
    (item) =>
      (filter === 'all' || !item.is_read) &&
      (category === 'all' ||
        (category === 'projects'
          ? item.link_url?.startsWith('/app/projects') || item.kind === 'projects'
          : item.link_url?.startsWith('/app/messages'))),
  )
  return (
    <AppCard className="space-y-4">
      <SectionHeading
        title="Notifications"
        action={
          <AppButton
            variant="ghost"
            disabled={markAll.isPending || !(notificationsQuery.data ?? []).some((n) => !n.is_read)}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </AppButton>
        }
      />
      <div className="flex gap-2">
        <AppButton variant={filter === 'unread' ? 'primary' : 'ghost'} onClick={() => setFilter('unread')}>
          Unread
        </AppButton>
        <AppButton variant={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>
          All
        </AppButton>
      </div>
      <AppSelect
        aria-label="Notification category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="all">All activity</option>
        <option value="social">Social</option>
        <option value="projects">Projects</option>
      </AppSelect>
      <MutationFeedback mutation={markAll} />
      <QueryFeedback query={notificationsQuery} />
      <MutationFeedback mutation={mutation} />
      <div className="grid gap-3">
        {rows.map((item) => (
          <AppPanel key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-ink">{item.title}</p>
                <time className="text-xs text-ink/60" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
                <p className="text-sm text-ink/65">{item.body}</p>

                {item.link_url ? (
                  <Link
                    to={item.link_url as never}
                    onClick={() => {
                      if (!item.is_read) mutation.mutate(item.id)
                    }}
                    className="mt-2 inline-flex text-xs font-bold text-teal hover:underline"
                  >
                    View →
                  </Link>
                ) : null}
              </div>
              {!item.is_read ? (
                <AppButton
                  disabled={mutation.isPending}
                  variant="secondary"
                  onClick={() => mutation.mutate(item.id)}
                >
                  Mark read
                </AppButton>
              ) : (
                <span className="text-xs font-bold text-teal">Read</span>
              )}
            </div>
          </AppPanel>
        ))}
        {!notificationsQuery.isPending && !notificationsQuery.isError && !rows.length ? (
          <p className="text-sm text-ink/60">No notifications here.</p>
        ) : null}
      </div>
    </AppCard>
  )
}
