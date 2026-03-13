import type {
  AppUser,
  BusinessProfile,
  DashboardCard,
  MarketplaceListing,
  ScheduleItem,
  UserProfile,
} from '@superapp/types'

export const defaultProfile: UserProfile = {
  firstName: 'Jason',
  location: 'Sydney',
  timeZone: 'Australia/Sydney',
  useCases: ['moving house', 'family scheduling'],
  integrations: ['calendar'],
}

export const defaultBusinessProfile: BusinessProfile = {
  businessName: 'Sunbeam Studio',
  category: 'Creative planning',
  serviceArea: 'Sydney Inner West',
  offerings: ['templates', 'services'],
  bookingModel: 'request-based',
  availabilityNotes: 'Weekdays after lunch, weekends for special projects',
  visibilityMode: 'progress milestones',
}

export const seededUser: AppUser = {
  email: 'jason@example.com',
  mode: 'both',
  activeMode: 'individual',
  profile: defaultProfile,
  businessProfile: defaultBusinessProfile,
  onboarding: {
    accountMode: 'both',
    individualComplete: true,
    businessComplete: true,
  },
}

export const personalTodayCards: DashboardCard[] = [
  { id: '1', title: '2 events today', subtitle: 'Coffee catch-up and school pickup shuffle', accent: 'butter' },
  { id: '2', title: '4 tasks due', subtitle: 'Packing list is gently waving at you', accent: 'peach' },
  { id: '3', title: '1 reply waiting', subtitle: 'Mia can help Saturday morning only', accent: 'teal' },
  { id: '4', title: '$78 to settle', subtitle: 'Fuel IOU and flowers reimbursement', accent: 'berry' },
]

export const businessCards: DashboardCard[] = [
  { id: '1', title: '3 jobs today', subtitle: 'Two confirmed, one still needs a nudge', accent: 'peach' },
  { id: '2', title: '5 requests pending', subtitle: 'Quote board is looking lively', accent: 'butter' },
  { id: '3', title: '$1,280 incoming', subtitle: 'Deposits due this week', accent: 'teal' },
  { id: '4', title: 'Capacity alert', subtitle: 'Friday afternoon is packed with sparkle', accent: 'berry' },
]

export const scheduleItems: ScheduleItem[] = [
  {
    id: 'plan',
    title: 'Move house plan',
    start: '2026-03-14',
    end: '2026-03-20',
    lane: 'Planning',
    progress: 72,
  },
  {
    id: 'helpers',
    title: 'Confirm helpers',
    start: '2026-03-15',
    end: '2026-03-17',
    lane: 'Coordination',
    progress: 55,
    dependencyIds: ['plan'],
  },
  {
    id: 'van',
    title: 'Book van hire',
    start: '2026-03-16',
    end: '2026-03-18',
    lane: 'Bookings',
    progress: 40,
    dependencyIds: ['plan'],
  },
  {
    id: 'packing',
    title: 'Packing sprint',
    start: '2026-03-16',
    end: '2026-03-22',
    lane: 'Tasks',
    progress: 28,
    dependencyIds: ['helpers'],
  },
]

export const templateListings: MarketplaceListing[] = [
  {
    id: 'tmpl-move',
    title: 'Whisker-Smooth Move Planner',
    summary: 'A cheerful moving template with helper prompts, milestone timing, and budget buckets.',
    kind: 'template',
    category: 'Moving',
    priceLabel: '$12 one-time',
    whimsicalNote: 'Comes with a tiny burst of moving-day calm.',
  },
  {
    id: 'tmpl-party',
    title: 'Birthday Orbit Board',
    summary: 'Milestones, shopping, and guest coordination for delightfully low-stress parties.',
    kind: 'template',
    category: 'Events',
    priceLabel: '$9 one-time',
    whimsicalNote: 'Confetti energy without confetti cleanup.',
  },
]

export const serviceListings: MarketplaceListing[] = [
  {
    id: 'svc-clean',
    title: 'Sunshine Exit Clean',
    summary: 'Bond-cleaning service with live status updates and flexible access windows.',
    kind: 'service',
    category: 'Cleaning',
    priceLabel: 'From $180',
    whimsicalNote: 'Leaves the place sparkling like a good idea.',
  },
  {
    id: 'prd-boxes',
    title: 'Stackable Moving Box Bundle',
    summary: 'Reusable boxes, labels, and tape delivered in one tidy bundle.',
    kind: 'product',
    category: 'Moving gear',
    priceLabel: '$65 bundle',
    whimsicalNote: 'A little cardboard chorus line.',
  },
]
