import { Link, createRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppCard, AppButton, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { HeroPanel, Pill, TwoColumnGrid } from '@/components/page-primitives'
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
  const nextProject = projects[0]
  const nextActionLink =
    profile.active_mode === 'business'
      ? { to: '/app/jobs', label: jobs.length ? 'Open jobs board' : 'Create your first job' }
      : { to: '/app/projects', label: projects.length ? 'Open project board' : 'Create your first project' }

  return (
    <div className="space-y-4">
      <HeroPanel
        badge={profile.active_mode === 'business' ? 'Business home' : 'Personal home'}
        title={
          profile.active_mode === 'business'
            ? `Hello, ${businessProfile?.business_name || profile.first_name}`
            : `Hello, ${profile.first_name}`
        }
        subtitle="Today’s coordination board keeps your plans, people, and useful nudges gathered in one bright place."
      >
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill tone="peach">Quick add</Pill>
          <Pill tone="teal">AI assistant</Pill>
          <Pill>Structured updates</Pill>
        </div>
      </HeroPanel>

      <TwoColumnGrid>
        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Today" title="What needs your sparkle" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">{projects.length} active projects</p>
                <p className="text-sm text-ink/65">
                  {projects.length ? 'Projects are live and ready for planning.' : 'Create your first project to get started.'}
                </p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">{coordinationObjects.length} coordination objects</p>
                <p className="text-sm text-ink/65">Flows, reminders, asks, bookings, and plans now share one backbone.</p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">
                  {profile.active_mode === 'business' ? todayJobs.length : recentPosts.length} live updates
                </p>
                <p className="text-sm text-ink/65">
                  {profile.active_mode === 'business'
                    ? 'Jobs marked for today show up here.'
                    : recentPosts.length
                      ? 'Posts from people and topics you follow are bubbling here.'
                      : 'Follow people or topics to shape this stream.'}
                </p>
              </AppPanel>
              <AppPanel>
                <p className="text-lg font-extrabold text-ink">
                  {profile.active_mode === 'business' ? pendingWallet.length : dmThreads.length} {profile.active_mode === 'business' ? 'pending money items' : 'open DMs'}
                </p>
                <p className="text-sm text-ink/65">
                  {profile.active_mode === 'business'
                    ? pendingWallet.length
                      ? 'Reimbursements and requests are waiting in wallet.'
                      : 'No pending wallet items right now.'
                    : dmThreads.length
                      ? 'Private conversations are active and ready to pick back up.'
                      : 'No direct messages yet.'}
                </p>
              </AppPanel>
            </div>
          </AppCard>

          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Suggestions" title="Next best nudges" />
            <div className="space-y-3 text-sm">
              {projects.length === 0 ? (
                <AppPanel tone="butter">Create a project so the planner can start shaping dates, tasks, and messages.</AppPanel>
              ) : null}
              {coordinationObjects.length === 0 ? (
                <AppPanel tone="peach">Start with one lightweight flow and let it grow only if life actually needs more structure.</AppPanel>
              ) : null}
              {pendingWallet.length > 0 ? (
                <AppPanel tone="teal">You have money items waiting; settling them will clean up your project budgets.</AppPanel>
              ) : null}
              {dueSoonCoordination.length > 0 && (
                <AppPanel tone="teal">You have {dueSoonCoordination.length} flows with time attached. The timeline editor can now treat those as clips, not just projects.</AppPanel>
              )}
              {projects.length > 0 && coordinationObjects.length > 0 && pendingWallet.length === 0 && dueSoonCoordination.length === 0 ? (
                <AppPanel tone="teal">Your current data looks healthy. The next high-value move is probably in participants, templates, or marketplace.</AppPanel>
              ) : null}
            </div>
          </AppCard>
        </div>

        <div className="space-y-4">
          <AppCard className="space-y-4">
            <SectionHeading eyebrow="Recent updates" title="Little ripples" />
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
            <SectionHeading eyebrow="Quick start" title="Pick a path" />
            <div className="grid gap-3">
              <Link to={nextActionLink.to}>
                <AppButton className="w-full">{nextActionLink.label}</AppButton>
              </Link>
              <Link to="/app/coordination">
                <AppButton className="w-full" variant="secondary">
                  {coordinationObjects.length ? 'Open coordination board' : 'Capture your first flow'}
                </AppButton>
              </Link>
              <Link to="/app/gantt">
                <AppButton className="w-full" variant="secondary">
                  {nextProject ? `View ${nextProject.title} timeline` : 'Open the Gantt planner'}
                </AppButton>
              </Link>
              <Link to={profile.active_mode === 'business' ? '/app/marketplace/services' : '/app/marketplace/templates'}>
                <AppButton className="w-full" variant="ghost">
                  {profile.active_mode === 'business' ? 'Manage marketplace offers' : 'Browse templates and services'}
                </AppButton>
              </Link>
            </div>
            <p className="text-xs text-ink/60">
              The dashboard now derives its summaries from your actual projects, coordination objects, wallet entries, feed activity, DMs, jobs, and notifications.
            </p>
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
