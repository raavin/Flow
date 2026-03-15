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
  participants?: CoordinationParticipant[]
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
  projectKind?: 'general' | 'product_workspace' | 'service_workspace' | 'template_workspace'
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
  priceCents?: number
  currencyCode?: string
  sku?: string | null
  taxRateBasisPoints?: number
  workspaceProjectId?: string | null
  fulfillmentNotes?: string
  whimsicalNote: string
  ownerId?: string
  isPublished?: boolean
  templatePayload?: TemplatePayload
}

export type CartItem = {
  id: string
  listingId: string
  linkedProjectId: string | null
  orderId?: string | null
  quantity: number
  bookingNote: string | null
  bookingDate: string | null
  splitWith: string[]
  status: 'draft' | 'ordered' | 'removed'
  listing: {
    id: string
    ownerId: string | null
    title: string
    kind: MarketplaceKind
    category: string
    priceLabel: string
    priceCents: number
    currencyCode: string
    sku?: string | null
    taxRateBasisPoints: number
    workspaceProjectId?: string | null
  } | null
}

export type CheckoutSummary = {
  currencyCode: string
  subtotalCents: number
  taxCents: number
  totalCents: number
}

export type CommerceOrder = {
  id: string
  orderNumber: string
  buyerProfileId: string
  sellerProfileId: string
  linkedProjectId?: string | null
  currencyCode: string
  status: 'placed' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  paymentStatus: 'pending' | 'paid' | 'refunded'
  payoutStatus: 'not_applicable' | 'pending' | 'paid'
  subtotalCents: number
  taxCents: number
  platformFeeCents: number
  totalCents: number
  sellerNetCents: number
  createdAt: string
}

export type OrderItem = {
  id: string
  orderId: string
  listingId: string | null
  linkedProjectId?: string | null
  workspaceProjectId?: string | null
  title: string
  kind: MarketplaceKind
  category: string
  sku?: string | null
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  taxCents: number
  platformFeeCents: number
  totalCents: number
  sellerNetCents: number
}

export type FinancialTransaction = {
  id: string
  profileId: string
  counterpartyProfileId?: string | null
  orderId?: string | null
  linkedProjectId?: string | null
  linkedListingId?: string | null
  transactionRole: 'buyer' | 'seller' | 'manual'
  transactionType: 'transfer' | 'purchase' | 'sale' | 'request' | 'refund' | 'payout'
  sourceKind: 'manual' | 'marketplace' | 'peer' | 'project'
  direction: 'in' | 'out'
  description: string
  counterpartyLabel: string
  counterpartyHandle?: string | null
  referenceNumber?: string | null
  currencyCode: string
  subtotalCents: number
  taxCents: number
  platformFeeCents: number
  totalCents: number
  sellerNetCents: number
  status: 'pending' | 'placed' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded' | 'settled'
  payoutStatus: 'not_applicable' | 'pending' | 'paid'
  occurredAt: string
  createdAt: string
}

export type SalesLedgerRow = {
  orderId: string
  orderNumber: string
  transactionId: string | null
  orderItemId: string
  orderDate: string
  customerProfileId: string
  customerDisplayName: string
  customerHandle?: string | null
  productTitle: string
  listingId: string | null
  listingCode?: string | null
  linkedProjectId?: string | null
  linkedProjectTitle?: string | null
  workspaceProjectId?: string | null
  workspaceProjectTitle?: string | null
  subtotalCents: number
  taxCents: number
  platformFeeCents: number
  totalCents: number
  sellerNetCents: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  payoutStatus: 'not_applicable' | 'pending' | 'paid'
  currencyCode: string
}

export type ListingImage = {
  id: string
  listingId: string
  storagePath: string
  altText: string
  sortOrder: number
  createdAt: string
}

export type ListingReview = {
  id: string
  listingId: string
  orderId: string | null
  reviewerId: string
  sellerId: string
  rating: number
  body: string
  responseBody: string | null
  responseAt: string | null
  conversationThreadId: string | null
  conversationMessageId: string | null
  isVisible: boolean
  createdAt: string
  updatedAt: string
  // Joined fields
  reviewerHandle?: string | null
  reviewerDisplayName?: string | null
  reviewerAvatarPath?: string | null
}

export type BrowseListing = {
  id: string
  title: string
  kind: MarketplaceKind
  category: string
  priceCents: number
  priceLabel: string
  currencyCode: string
  coverImagePath: string | null
  locationLabel: string
  reviewCount: number
  ratingSum: number
  sellerId: string
  sellerName: string
  isPublished: boolean
}

export type SellerPublicProfile = {
  id: string
  businessName: string
  category: string
  serviceArea: string
  offerings: string[]
  bookingModel: string
  availabilityNotes: string
  totalSales: number
  totalReviewCount: number
  totalRatingSum: number
  memberSince: string | null
  logoPath: string | null
}

export type AppUser = {
  email: string
  mode: AccountMode
  activeMode: Exclude<AccountMode, 'both'> | 'both'
  profile: UserProfile
  businessProfile: BusinessProfile
  onboarding: OnboardingState
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export type IntegrationProvider =
  | 'stripe'
  | 'paypal'
  | 'openwallex'
  | 'direct_banking'
  | 'xero'
  | 'myob'
  | 'shiftly'
  | 'generic'

export type IntegrationStatus = 'active' | 'disconnected' | 'error' | 'pending_oauth'

export type ConnectedIntegration = {
  id: string
  profileId: string
  provider: IntegrationProvider
  status: IntegrationStatus
  oauthTokenExpiresAt: string | null
  oauthScope: string | null
  providerAccountId: string | null
  providerAccountLabel: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type IntegrationApiKey = {
  id: string
  profileId: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export type WebhookEndpoint = {
  id: string
  profileId: string
  url: string
  description: string
  eventTypes: string[]
  isActive: boolean
  failureCount: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  createdAt: string
  updatedAt: string
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'abandoned'

export type WebhookDelivery = {
  id: string
  endpointId: string
  eventType: string
  eventId: string
  payload: Record<string, unknown>
  attemptCount: number
  nextRetryAt: string | null
  status: WebhookDeliveryStatus
  lastResponseStatus: number | null
  lastResponseBody: string | null
  createdAt: string
  deliveredAt: string | null
}
