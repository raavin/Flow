export type AccountMode = 'individual' | 'business' | 'both'

export type CoordinationObjectKind =
  | 'message'
  | 'dm_thread'
  | 'event'
  | 'reminder'
  | 'task'
  | 'booking'
  | 'purchase'
  | 'request'
  | 'plan'
  | 'project'
  | 'workflow'
  | 'job'
  | 'listing'
  | 'template'

export type CoordinationObjectState =
  | 'draft'
  | 'pending'
  | 'scheduled'
  | 'active'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'archived'

export type CoordinationDisplayKind =
  | 'chat'
  | 'event'
  | 'task'
  | 'booking'
  | 'purchase'
  | 'reminder'
  | 'plan'
  | 'project'
  | 'workflow'

export type CoordinationObjectIntent =
  | 'coordinate'
  | 'meet'
  | 'attend'
  | 'buy'
  | 'book'
  | 'remind'
  | 'notify'
  | 'ask'
  | 'deliver'
  | 'celebrate'
  | 'travel'
  | 'health'
  | 'work'
  | 'support'
  | 'custom'

export type CoordinationTimeWindow = {
  startsAt: string | null
  endsAt: string | null
  dueAt?: string | null
  isAllDay?: boolean
  flexibility?: 'fixed' | 'shiftable' | 'floating'
}

export type CoordinationParticipantRole =
  | 'owner'
  | 'participant'
  | 'viewer'
  | 'provider'
  | 'customer'
  | 'assignee'
  | 'watcher'

export type CoordinationParticipantState = 'invited' | 'active' | 'blocked' | 'declined' | 'completed'

export type CoordinationObject = {
  id: string
  ownerId: string
  sourceTable?: string | null
  sourceId?: string | null
  kind: CoordinationObjectKind
  displayKind: CoordinationDisplayKind
  title: string
  summary?: string | null
  intent: CoordinationObjectIntent
  state: CoordinationObjectState
  time: CoordinationTimeWindow
  parentId?: string | null
  linkedProjectId?: string | null
  linkedListingId?: string | null
  linkedJobId?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CoordinationParticipant = {
  id: string
  coordinationObjectId: string
  profileId?: string | null
  participantName: string
  role: CoordinationParticipantRole
  state: CoordinationParticipantState
}

export type CoordinationDependencyKind = 'blocks' | 'supports' | 'follows' | 'overlaps' | 'duplicates'

export type CoordinationTemplateBlock = {
  title: string
  kind: CoordinationObjectKind
  displayKind: CoordinationDisplayKind
  intent: CoordinationObjectIntent
  offsetDays?: number
  durationDays?: number
  lane?: string
  metadata?: Record<string, unknown>
}

export type CoordinationTemplate = {
  id: string
  ownerId: string
  title: string
  summary?: string | null
  displayKind: CoordinationDisplayKind
  blocks: CoordinationTemplateBlock[]
}

export type CoordinationMessage = {
  id: string
  coordinationObjectId: string
  authorId: string
  body: string
  visibility: 'private' | 'participants' | 'followers'
  sourcePostId?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  author?: {
    id: string
    handle?: string | null
    displayName?: string | null
  } | null
}

export type UserProfile = {
  firstName: string
  lastName?: string
  location: string
  timeZone: string
  photoUrl?: string
  useCases: string[]
  integrations: string[]
}

export type BusinessProfile = {
  businessName: string
  category: string
  serviceArea: string
  logoUrl?: string
  offerings: string[]
  bookingModel: string
  availabilityNotes: string
  visibilityMode: string
}

export type OnboardingState = {
  accountMode: AccountMode | null
  individualComplete: boolean
  businessComplete: boolean
}

export type ProfileRecord = {
  id: string
  account_mode: AccountMode
  active_mode: 'individual' | 'business'
  first_name: string
  last_name: string | null
  location: string
  time_zone: string
  use_cases: string[]
  integrations: string[]
  avatar_path: string | null
}

export type BusinessProfileRecord = {
  id: string
  business_name: string
  category: string
  service_area: string
  offerings: string[]
  booking_model: string
  availability_notes: string
  visibility_mode: string
  logo_path: string | null
}

export type DashboardCard = {
  id: string
  title: string
  subtitle: string
  accent: 'peach' | 'butter' | 'berry' | 'teal'
}

export type ScheduleItem = {
  id: string
  title: string
  start: string
  end: string
  lane: string
  progress: number
  dependencyIds?: string[]
}

export type Project = {
  id: string
  title: string
  category: string
  status: 'active' | 'upcoming' | 'completed'
  targetDate: string | null
  budgetCents: number | null
  attachedListingsCount?: number
}

export type Milestone = {
  id: string
  projectId: string
  title: string
  startsOn: string
  endsOn: string
  lane: string
  progress: number
}

export type CalendarEvent = {
  id: string
  projectId: string | null
  title: string
  startsAt: string
  endsAt: string
  notes: string | null
}

export type MarketplaceKind = 'template' | 'service' | 'product'

export type TemplatePayload = {
  durationDays?: number
  milestones?: Array<{
    title: string
    offsetDays: number
    durationDays: number
    lane: string
  }>
  tasks?: Array<{
    title: string
    offsetDays: number
  }>
}

export type MarketplaceListing = {
  id: string
  title: string
  summary: string
  kind: MarketplaceKind
  category: string
  priceLabel: string
  whimsicalNote: string
  ownerId?: string
  isPublished?: boolean
  templatePayload?: TemplatePayload
}

export type AppUser = {
  email: string
  mode: AccountMode
  activeMode: Exclude<AccountMode, 'both'> | 'both'
  profile: UserProfile
  businessProfile: BusinessProfile
  onboarding: OnboardingState
}
