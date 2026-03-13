import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { fetchNotifications, markNotificationRead } from '@/lib/coordination'

function NotificationsPage() {
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })
  const mutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Alerts" title="Notifications" />
      <div className="grid gap-3">
        {(notificationsQuery.data ?? []).map((item) => (
          <AppPanel key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-extrabold text-ink">{item.title}</p>
                <p className="text-sm text-ink/65">{item.body}</p>
                <p className="mt-1 text-xs font-bold text-berry">{item.kind}</p>
              </div>
              {!item.is_read ? (
                <AppButton variant="secondary" onClick={() => mutation.mutate(item.id)}>
                  Mark read
                </AppButton>
              ) : (
                <span className="text-xs font-bold text-teal">Read</span>
              )}
            </div>
          </AppPanel>
        ))}
        {!notificationsQuery.data?.length ? <p className="text-sm text-ink/60">Notifications from messages, wallet, jobs, and project updates will appear here.</p> : null}
      </div>
    </AppCard>
  )
}

export const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notifications',
  component: NotificationsPage,
})
