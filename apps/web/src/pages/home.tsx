import { Link, createRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppCard, AppButton, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { HeroPanel, TwoColumnGrid } from '@/components/page-primitives'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects } from '@/lib/projects'
import { fetchWalletEntries } from '@/lib/wallet'
import { fetchNotifications } from '@/lib/coordination'
import { fetchJobs } from '@/lib/jobs'
import { fetchDmThreads } from '@/lib/dm'
import { fetchFeed } from '@/lib/social'
import { fetchCoordinationObjects } from '@/lib/coordination-objects'

function HomePage() {
  const { profile, businessProfile, session } = useAppStore()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: fetchWalletEntries })
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs })
  const coordinationQuery = useQuery({
    queryKey: ['coordination-objects'],
    queryFn: () => fetchCoordinationObjects(),
    enabled: Boolean(session?.user.id),
  })
  const feedQuery = useQuery({
    queryKey: ['social-feed', session?.user.id, 'following'],
    queryFn: () => fetchFeed(session!.user.id, 'following'),
    enabled: Boolean(session?.user.id),
  })
  const dmThreadsQuery = useQuery({ queryKey: ['dm-threads'], queryFn: fetchDmThreads, enabled: Boolean(session?.user.id) })
  if (!profile) return null

  const projects = projectsQuery.data ?? []
  const walletEntries = walletQuery.data ?? []
  const notifications = notificationsQuery.data ?? []
  const jobs = jobsQuery.data ?? []
  const coordinationObjects = coordinationQuery.data ?? []
  const feedPosts = feedQuery.data ?? []
  const dmThreads = dmThreadsQuery.data ?? []
  const unreadNotifications = notifications.filter((item) => !item.is_read)
  const pendingWallet = walletEntries.filter((item) => item.status === 'pending')
  const todayJobs = jobs.filter((item) => item.status === 'today')
  const dueSoonCoordination = coordinationObjects.filter((item) => {
    const keyDay = item.time.startsAt ?? item.time.dueAt
    if (!keyDay) return false
    return keyDay.slice(0, 10) >= new Date().toISOString().slice(0, 10)
  })
  const recentPosts = feedPosts.slice(0, 5)
  const nextActionLink =
    profile.active_mode === 'business'
      ? { to: '/app/jobs', label: jobs.length ? 'View jobs' : 'Create your first job' }
      : { to: '/app/projects', label: projects.length ? 'View projects' : 'Create your first project' }

  return (
    <div className="space-y-4">
      <HeroPanel
        badge={profile.active_mode === 'business' ? 'Business home' : 'Personal home'}
        title={
          profile.active_mode === 'business'
            ? `Hello, ${businessProfile?.business_name || profile.first_name}`
            : `Hello, ${profile.first_name}`
        }
        subtitle="Your projects, plans and recent activity."
      >
      </HeroPanel>

      <TwoColumnGrid>
        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Today" title="Overview" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">{projects.length} projects</p>
                <p className="text-sm text-ink/65">
                  {projects.length ? 'View tasks, dates and costs.' : 'Create your first project to get started.'}
                </p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">{coordinationObjects.length} plans</p>
                <p className="text-sm text-ink/65">Plans, reminders, requests and bookings.</p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">
                  {profile.active_mode === 'business' ? todayJobs.length : recentPosts.length} recent updates
                </p>
                <p className="text-sm text-ink/65">
                  {profile.active_mode === 'business'
                    ? 'Jobs marked for today show up here.'
                    : recentPosts.length
                      ? 'Recent posts from people and topics you follow.'
                      : 'Follow people or topics to see their posts.'}
                </p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">
                  {profile.active_mode === 'business' ? pendingWallet.length : dmThreads.length} {profile.active_mode === 'business' ? 'outstanding payments' : 'conversations'}
                </p>
                <p className="text-sm text-ink/65">
                  {profile.active_mode === 'business'
                    ? pendingWallet.length
                      ? 'Review unpaid entries in Money.'
                      : 'No unpaid entries.'
                    : dmThreads.length
                      ? 'Continue a private conversation.'
                      : 'No direct messages yet.'}
                </p>
              </AppPanel>
            </div>
          </AppCard>

          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Suggestions" title="To do" />
            <div className="space-y-3 text-sm">
              {projects.length === 0 ? (
                <AppPanel tone="butter">Create a project to organise tasks, dates and costs.</AppPanel>
              ) : null}
              {coordinationObjects.length === 0 ? (
                <AppPanel tone="peach">Add a plan or choose a template.</AppPanel>
              ) : null}
              {pendingWallet.length > 0 ? (
                <AppPanel tone="teal">Review unpaid entries in Money.</AppPanel>
              ) : null}
              {dueSoonCoordination.length > 0 && (
                <AppPanel tone="teal">You have {dueSoonCoordination.length} scheduled plans. View your calendar.</AppPanel>
              )}
              {projects.length > 0 && coordinationObjects.length > 0 && pendingWallet.length === 0 && dueSoonCoordination.length === 0 ? (
                <AppPanel tone="teal">No upcoming plans or outstanding payments.</AppPanel>
              ) : null}
            </div>
          </AppCard>
        </div>

        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Recent updates" title="Notifications" />
            <div className="space-y-3 text-sm">
              {unreadNotifications.slice(0, 3).map((item) => (
                <AppPanel key={item.id} className="rounded-control">
                  {item.body}
                </AppPanel>
              ))}
              {!unreadNotifications.length ? <AppPanel className="rounded-control">No unread notifications yet. New project activity will show up here.</AppPanel> : null}
            </div>
          </AppCard>

          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Quick start" title="Shortcuts" />
            <div className="grid gap-3">
              <Link to={nextActionLink.to}>
                <AppButton className="w-full">{nextActionLink.label}</AppButton>
              </Link>
              <Link to="/app/coordination">
                <AppButton className="w-full" variant="secondary">
                  {coordinationObjects.length ? 'View plans' : 'Create a plan'}
                </AppButton>
              </Link>
              <Link to="/app/gantt">
                <AppButton className="w-full" variant="secondary">
                  View timeline
                </AppButton>
              </Link>
              <Link to={profile.active_mode === 'business' ? '/app/marketplace/services' : '/app/marketplace/templates'}>
                <AppButton className="w-full" variant="ghost">
                  {profile.active_mode === 'business' ? 'Browse services' : 'Browse templates'}
                </AppButton>
              </Link>
            </div>

          </AppCard>
        </div>
      </TwoColumnGrid>
    </div>
  )
}

export const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'home',
  component: HomePage,
})
