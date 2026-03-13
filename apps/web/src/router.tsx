import { createRouter } from '@tanstack/react-router'
import { rootRoute, appRoute } from '@/components/layout'
import { landingRoute } from '@/pages/landing'
import { onboardingRoute } from '@/pages/onboarding'
import { homeRoute } from '@/pages/home'
import { coordinationRoute } from '@/pages/coordination'
import { calendarRoute } from '@/pages/calendar'
import { ganttRoute } from '@/pages/gantt'
import { servicesMarketplaceRoute, templateMarketplaceRoute } from '@/pages/marketplace'
import { projectDetailRoute, projectsRoute } from '@/pages/projects'
import { jobsRoute } from '@/pages/jobs'
import { dmInboxRoute, dmThreadRoute, messagesRoute, postRoute, socialProfileRoute, topicRoute } from '@/pages/messages'
import { walletRoute } from '@/pages/wallet'
import { notificationsRoute } from '@/pages/notifications'
import { businessProfileRoute, listingDetailRoute, listingsManagementRoute } from '@/pages/listings'
import { participantsRoute } from '@/pages/participants'
import { availabilityRoute, budgetRoute, structuredUpdatesRoute } from '@/pages/planning'
import { cartRoute, categoryBrowseRoute, searchRoute, settingsRoute } from '@/pages/tools'
import { jobDetailRoute } from '@/pages/business'
import { aiRoute } from '@/pages/ai'
import { supportRoute } from '@/pages/support'

const routeTree = rootRoute.addChildren([
  landingRoute,
  onboardingRoute,
  appRoute.addChildren([
    homeRoute,
    coordinationRoute,
    calendarRoute,
    ganttRoute,
    templateMarketplaceRoute,
    servicesMarketplaceRoute,
    categoryBrowseRoute,
    cartRoute,
    listingDetailRoute,
    businessProfileRoute,
    listingsManagementRoute,
    projectsRoute,
    projectDetailRoute,
    participantsRoute,
    availabilityRoute,
    budgetRoute,
    structuredUpdatesRoute,
    messagesRoute,
    postRoute,
    socialProfileRoute,
    topicRoute,
    dmInboxRoute,
    dmThreadRoute,
    walletRoute,
    jobsRoute,
    jobDetailRoute,
    notificationsRoute,
    searchRoute,
    supportRoute,
    settingsRoute,
    aiRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
