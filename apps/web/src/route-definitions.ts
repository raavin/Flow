// Keep paths/search validation eager; view code is fetched only on navigation or intent preload.
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { appRoute, rootRoute } from '@/components/layout'

export const templateEditorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'template-editor',
  component: lazyRouteComponent(() => import('@/pages/coordination'), 'TemplateEditorPage'),
})

export const aiRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'ai',
  component: lazyRouteComponent(() => import('@/pages/ai'), 'PlanningHelperPage'),
})

export const budgetsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'budgets',
  validateSearch: (search: Record<string, unknown>): { view?: string } => ({
    view:
      typeof search.view === 'string' && /^(fund|project|allocation):[a-zA-Z0-9-]+$/.test(search.view)
        ? search.view
        : undefined,
  }),
  component: lazyRouteComponent(() => import('@/pages/budgets'), 'BudgetsPage'),
})

export const jobDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'jobs/$jobId',
  component: lazyRouteComponent(() => import('@/pages/business'), 'JobDetailPage'),
})

export const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'calendar',
  component: lazyRouteComponent(() => import('@/pages/calendar'), 'CalendarPage'),
})

export const coordinationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'coordination',
  component: lazyRouteComponent(() => import('@/pages/coordination'), 'CoordinationRoutePage'),
})

export const coordinationDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'coordination/$coordinationId',
  component: lazyRouteComponent(() => import('@/pages/coordination'), 'CoordinationDetailPage'),
})

export const ganttRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'gantt',
  component: lazyRouteComponent(() => import('@/pages/gantt'), 'GanttPage'),
})

export const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'home',
  component: lazyRouteComponent(() => import('@/pages/home'), 'HomePage'),
})

export const integrationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'integrations',
  component: lazyRouteComponent(() => import('@/pages/integrations'), 'IntegrationsPage'),
})

export const jobsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'jobs',
  component: lazyRouteComponent(() => import('@/pages/jobs'), 'JobsPage'),
})

export const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/pages/landing'), 'LandingPage'),
})

export const listingDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/listings/$listingId',
  component: lazyRouteComponent(() => import('@/pages/listings'), 'ListingDetailPage'),
})

export const sellerProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/seller/$sellerId',
  component: lazyRouteComponent(() => import('@/pages/listings'), 'SellerProfilePage'),
})

export const businessProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/$ownerId',
  component: lazyRouteComponent(() => import('@/pages/listings'), 'BusinessProfilePage'),
})

export const listingsManagementRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/manage',
  component: lazyRouteComponent(() => import('@/pages/listings'), 'ListingsManagementPage'),
})

export const legacyListingsManagementRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/listings',
  component: lazyRouteComponent(() => import('@/pages/listings'), 'ListingsManagementPage'),
})

export const marketplaceBrowseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace',
  component: lazyRouteComponent(() => import('@/pages/marketplace'), 'MarketplaceBrowsePage'),
})

export const templateMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/templates',
  component: lazyRouteComponent(() => import('@/pages/marketplace'), 'LegacyTemplatesPage'),
})

export const servicesMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/services',
  component: lazyRouteComponent(() => import('@/pages/marketplace'), 'LegacyServicesPage'),
})

export const messagesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'MessagesFeedPage'),
})

export const projectMessagesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/project/$projectId',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'ProjectMessagesPage'),
})

export const postRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/post/$postId',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'PostDetailPage'),
})

export const socialProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/profile/$profileId',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'SocialProfilePage'),
})

export const topicRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/topics/$slug',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'TopicFeedPage'),
})

export const dmInboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/dm',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'DmInboxPage'),
})

export const dmThreadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/dm/$threadId',
  component: lazyRouteComponent(() => import('@/pages/messages'), 'DmThreadPage'),
})

export const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notifications',
  component: lazyRouteComponent(() => import('@/pages/notifications'), 'NotificationsPage'),
})

export const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: lazyRouteComponent(() => import('@/pages/onboarding'), 'OnboardingPage'),
})

export const participantsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/participants',
  component: lazyRouteComponent(() => import('@/pages/participants'), 'ParticipantsPage'),
})

export const availabilityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/availability',
  component: lazyRouteComponent(() => import('@/pages/planning'), 'AvailabilityPage'),
})

export const budgetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/budget',
  component: lazyRouteComponent(() => import('@/pages/planning'), 'BudgetPage'),
})

export const structuredUpdatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/updates',
  component: lazyRouteComponent(() => import('@/pages/planning'), 'UpdatesPage'),
})

export const projectTasksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/tasks',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectTasksPage'),
})

export const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectsPage'),
})

export const projectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectEntryPage'),
})

export const projectConversationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/conversation',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectConversationPage'),
})

export const projectCalendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/calendar',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectCalendarPage'),
})

export const projectTimelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/timeline',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectTimelinePage'),
})

export const projectNotesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/notes',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectNotesPage'),
})

export const projectStoreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/store',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectStorePage'),
})

export const projectPeopleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/people',
  component: lazyRouteComponent(() => import('@/pages/projects'), 'ProjectPeoplePage'),
})

export const requestsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/requests',
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
  component: lazyRouteComponent(() => import('@/pages/supplier-requests'), 'RequestsPage'),
})

export const requestDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/requests/$requestId',
  component: lazyRouteComponent(() => import('@/pages/supplier-requests'), 'RequestDetail'),
})

export const supportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'support',
  component: lazyRouteComponent(() => import('@/pages/support'), 'SupportPage'),
})

export const categoryBrowseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/category/$category',
  component: lazyRouteComponent(() => import('@/pages/tools'), 'CategoryBrowsePage'),
})

export const cartRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/cart',
  component: lazyRouteComponent(() => import('@/pages/tools'), 'CartReviewPage'),
})

export const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'search',
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' ? search.q.slice(0, 200) : undefined,
  }),
  component: lazyRouteComponent(() => import('@/pages/tools'), 'SearchPage'),
})

export const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: lazyRouteComponent(() => import('@/pages/tools'), 'SettingsPage'),
})

export const walletRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'wallet',
  component: lazyRouteComponent(() => import('@/pages/wallet'), 'WalletPage'),
  validateSearch: (
    search: Record<string, unknown>,
  ): { highlight?: string; projectId?: string; fundId?: string; scope?: 'all'; filter?: string } => ({
    fundId: typeof search.fundId === 'string' ? search.fundId : undefined,
    scope: search.scope === 'all' ? 'all' : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
    filter:
      typeof search.filter === 'string' && ['all', 'unpaid', 'paid', 'refunded'].includes(search.filter)
        ? search.filter
        : undefined,
  }),
})
