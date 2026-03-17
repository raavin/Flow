import { useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, RotateCcw, Truck } from 'lucide-react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import type { TemplatePayload } from '@superapp/types'
import { appRoute } from '@/components/layout'
import { createProjectFromTemplate, fetchProjects, attachListingToProject } from '@/lib/projects'
import {
  createMarketplaceListing,
  deleteListingImage,
  duplicateListing,
  deleteMarketplaceListing,
  fetchBusinessListings,
  fetchListingDetail,
  fetchListingImages,
  fetchMoreFromSeller,
  fetchSellerPublicProfile,
  getListingImageUrl,
  updateListing,
  updateListingContent,
  uploadListingImage,
  type ListingDetail,
} from '@/lib/marketplace'
import { addToCart, fetchCartCount } from '@/lib/cart'
import {
  checkCanReview,
  createReview,
  fetchListingReviews,
  fetchSellerReviews,
  formatRating,
  respondToReview,
} from '@/lib/reviews'
import { useAppStore } from '@/hooks/useAppStore'

// ─── Shared components ────────────────────────────────────────────────────────

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.4 && rating - full < 0.9
  const empty = 5 - full - (hasHalf ? 1 : 0)
  const cls = size === 'lg' ? 'text-base' : 'text-xs'
  return (
    <span className={`${cls} text-ink/70`} aria-label={`${rating.toFixed(1)} stars`}>
      {'★'.repeat(full)}{hasHalf ? '½' : ''}{'☆'.repeat(empty)}
    </span>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`text-2xl transition ${n <= value ? 'text-ink' : 'text-ink/20'} hover:text-ink`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return formatDate(iso)
}

function AvatarBadge({ label }: { label: string }) {
  return <div className="ui-avatar-badge h-8 w-8 text-sm shrink-0">{label.slice(0, 1).toUpperCase()}</div>
}

// ─── Photo gallery ────────────────────────────────────────────────────────────

function PhotoGallery({ images, title }: { images: Array<{ id: string; storagePath: string; altText: string }>; title: string }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const urls = images.map((img) => getListingImageUrl(img.storagePath))
  const active = urls[activeIdx]

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full bg-cloud border border-border flex items-center justify-center">
        <span className="text-sm text-ink/30 uppercase tracking-widest">No images yet</span>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {/* Thumbnail strip */}
      {images.length > 1 ? (
        <div className="flex w-16 shrink-0 flex-col gap-2 overflow-y-auto max-h-[480px]">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`aspect-square w-full border overflow-hidden transition ${
                idx === activeIdx ? 'border-ink' : 'border-border hover:border-ink/40'
              }`}
            >
              <img
                src={getListingImageUrl(img.storagePath)}
                alt={img.altText || title}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* Main image */}
      <div className="relative flex-1 aspect-square overflow-hidden bg-cloud border border-border">
        {active ? (
          <img src={active} alt={images[activeIdx]?.altText || title} className="h-full w-full object-cover" />
        ) : null}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 ui-soft-icon-button p-2"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 ui-soft-icon-button p-2"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Reviews list ─────────────────────────────────────────────────────────────

function ReviewsList({
  listingId,
  sellerId,
  showRespondButton,
}: {
  listingId: string
  sellerId: string
  showRespondButton: boolean
}) {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const reviewsQuery = useQuery({
    queryKey: ['listing-reviews', listingId],
    queryFn: () => fetchListingReviews(listingId),
  })
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  const respondMutation = useMutation({
    mutationFn: ({ reviewId, body }: { reviewId: string; body: string }) => respondToReview(reviewId, body),
    onSuccess: () => {
      setRespondingTo(null)
      setResponseText('')
      void queryClient.invalidateQueries({ queryKey: ['listing-reviews', listingId] })
      void queryClient.invalidateQueries({ queryKey: ['seller-reviews', sellerId] })
    },
  })

  const reviews = reviewsQuery.data ?? []
  const isSeller = session?.user.id === sellerId

  if (!reviews.length) {
    return <AppPanel className="text-sm text-ink/60">No reviews yet. Reviews appear here after a purchase is completed.</AppPanel>
  }

  return (
    <div className="space-y-5">
      {reviews.map((review) => (
        <div key={review.id} className="space-y-3">
          {/* Reviewer message */}
          <div className="flex gap-3">
            <AvatarBadge label={review.reviewerDisplayName || review.reviewerHandle || '?'} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-ink/55">
                <span className="font-extrabold text-ink">
                  {review.reviewerDisplayName || (review.reviewerHandle ? `@${review.reviewerHandle}` : 'Buyer')}
                </span>
                <span>·</span>
                <StarDisplay rating={review.rating} />
                <span>·</span>
                <span>{timeAgo(review.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-ink/80 leading-relaxed">{review.body}</p>
            </div>
          </div>

          {/* Seller reply */}
          {review.responseBody ? (
            <div className="flex gap-3 pl-6">
              <AvatarBadge label="S" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-ink/55">
                  <span className="font-extrabold text-ink">Shop owner</span>
                  {review.responseAt ? (
                    <>
                      <span>·</span>
                      <span>{timeAgo(review.responseAt)}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink/75 leading-relaxed">{review.responseBody}</p>
              </div>
            </div>
          ) : isSeller && showRespondButton ? (
            respondingTo === review.id ? (
              <div className="flex gap-3 pl-6">
                <AvatarBadge label="S" />
                <div className="min-w-0 flex-1 space-y-2">
                  <AppTextarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="min-h-20 text-sm"
                    placeholder="Write a response..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <AppButton
                      disabled={!responseText.trim() || respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ reviewId: review.id, body: responseText.trim() })}
                    >
                      {respondMutation.isPending ? 'Saving…' : 'Post response'}
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => { setRespondingTo(null); setResponseText('') }}>
                      Cancel
                    </AppButton>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="pl-6 text-xs text-ink/50 hover:text-ink hover:underline"
                onClick={() => setRespondingTo(review.id)}
              >
                Reply
              </button>
            )
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ─── Write review ─────────────────────────────────────────────────────────────

function WriteReviewSection({ listingId, sellerId, listingTitle }: { listingId: string; sellerId: string; listingTitle?: string }) {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')

  const canReviewQuery = useQuery({
    queryKey: ['can-review', listingId, session?.user.id],
    queryFn: () => checkCanReview(listingId, session!.user.id),
    enabled: Boolean(session?.user.id),
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      createReview({
        listingId,
        orderId: canReviewQuery.data!.orderId!,
        sellerId,
        reviewerId: session!.user.id,
        rating,
        body,
        listingTitle,
      }),
    onSuccess: () => {
      setBody('')
      setRating(5)
      void queryClient.invalidateQueries({ queryKey: ['listing-reviews', listingId] })
      void queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
    },
  })

  if (!session) return null
  if (canReviewQuery.isPending) return null
  if (canReviewQuery.data?.alreadyReviewed) {
    return <AppPanel tone="teal" className="text-sm text-ink/70">You've already reviewed this listing.</AppPanel>
  }
  if (!canReviewQuery.data?.canReview) return null

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Your review" title="Share your experience" />
      <StarPicker value={rating} onChange={setRating} />
      <AppTextarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-28"
        placeholder="What was it like? Be honest and specific."
      />
      <AppButton
        disabled={!body.trim() || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? 'Submitting…' : 'Submit review'}
      </AppButton>
    </AppCard>
  )
}

// ─── More from seller grid ────────────────────────────────────────────────────

function MoreFromSeller({ sellerId, excludeId, sellerName }: { sellerId: string; excludeId: string; sellerName: string }) {
  const moreQuery = useQuery({
    queryKey: ['more-from-seller', sellerId, excludeId],
    queryFn: () => fetchMoreFromSeller(sellerId, excludeId, 4),
  })
  const items = moreQuery.data ?? []
  if (!items.length) return null

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-ink">More from {sellerName}</p>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {items.map((item) => {
          const url = item.coverImagePath ? getListingImageUrl(item.coverImagePath) : null
          return (
            <Link key={item.id} to="/app/marketplace/listings/$listingId" params={{ listingId: item.id }} className="group">
              <div className="aspect-square bg-cloud border border-border overflow-hidden">
                {url ? (
                  <img src={url} alt={item.title} className="h-full w-full object-cover group-hover:scale-[1.03] transition" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-xs text-ink/30 uppercase tracking-widest">No image</span>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium text-ink line-clamp-2 group-hover:underline">{item.title}</p>
              <p className="text-xs text-ink/55">{item.priceLabel}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Listing detail ───────────────────────────────────────────────────────────

function ListingDetailPage() {
  const { listingId } = listingDetailRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const listingQuery = useQuery<ListingDetail | null>({ queryKey: ['listing', listingId], queryFn: () => fetchListingDetail(listingId) })
  const imagesQuery = useQuery({ queryKey: ['listing-images', listingId], queryFn: () => fetchListingImages(listingId) })
  const sellerQuery = useQuery({
    queryKey: ['seller-profile', listingQuery.data?.owner_id],
    queryFn: () => fetchSellerPublicProfile(listingQuery.data!.owner_id),
    enabled: Boolean(listingQuery.data?.owner_id),
  })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const cartCountQuery = useQuery({ queryKey: ['cart-count'], queryFn: fetchCartCount, enabled: Boolean(session) })
  const [projectId, setProjectId] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [deliveryOpen, setDeliveryOpen] = useState(false)

  const addToCartMutation = useMutation({
    mutationFn: () => addToCart({ ownerId: session!.user.id, listingId, linkedProjectId: projectId || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart-count'] })
    },
  })

  const attachMutation = useMutation({
    mutationFn: () => attachListingToProject(projectId, listingId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] }),
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!session || !listingQuery.data?.template_payload) throw new Error('Template is missing its plan payload.')
      return createProjectFromTemplate({
        ownerId: session.user.id,
        title: listingQuery.data.title,
        category: listingQuery.data.category,
        startDate: new Date().toISOString().slice(0, 10),
        templatePayload: listingQuery.data.template_payload,
      })
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void navigate({ to: '/app/projects/$projectId', params: { projectId: project.id } })
    },
  })

  const listing = listingQuery.data
  if (!listing) return <AppCard className="p-8 text-center text-sm text-ink/50">Loading listing…</AppCard>

  const seller = sellerQuery.data
  const images = imagesQuery.data ?? []
  const milestoneCount = listing.template_payload?.milestones?.length ?? 0
  const taskCount = listing.template_payload?.tasks?.length ?? 0
  const avgRating = listing.review_count > 0 ? listing.rating_sum / listing.review_count : 0

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link to="/app/marketplace" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
        Marketplace
      </Link>

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* Left: gallery */}
        <AppCard>
          <PhotoGallery images={images} title={listing.title} />
        </AppCard>

        {/* Right: buy column */}
        <div className="space-y-4">
          <AppCard className="space-y-4">
            {/* Category + title */}
            <div>
              <p className="ui-eyebrow">{listing.kind} · {listing.category}</p>
              <h1 className="mt-1 text-2xl font-light tracking-tight text-ink leading-snug">{listing.title}</h1>
            </div>

            {/* Seller + rating */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/app/marketplace/seller/$sellerId" params={{ sellerId: listing.owner_id }}>
                <p className="text-sm font-medium text-ink hover:underline">
                  {seller?.businessName ?? 'Loading seller…'}
                </p>
              </Link>
              {listing.review_count > 0 ? (
                <span className="flex items-center gap-1 text-sm text-ink/65">
                  <StarDisplay rating={avgRating} />
                  <span className="text-xs">({listing.review_count})</span>
                </span>
              ) : null}
            </div>

            {/* Returns */}
            {listing.return_policy ? (
              <p className="flex items-center gap-1.5 text-sm text-ink/70">
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                {listing.return_policy}
              </p>
            ) : null}

            {/* Location */}
            {listing.location_label ? (
              <p className="flex items-center gap-1.5 text-xs text-ink/50">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {listing.location_label}
              </p>
            ) : null}

            {/* Price */}
            <p className="text-2xl font-semibold text-ink">{listing.price_label}</p>

            {/* Project link (optional) */}
            {projectsQuery.data?.length ? (
              <AppSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Link to a project (optional)</option>
                {(projectsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </AppSelect>
            ) : null}

            {/* CTA */}
            <AppButton
              disabled={!session || addToCartMutation.isPending}
              onClick={() => addToCartMutation.mutate()}
              className="w-full justify-center"
            >
              {addToCartMutation.isPending ? 'Adding…' : 'Add to cart'}
            </AppButton>

            {listing.kind === 'template' ? (
              <AppButton
                variant="secondary"
                disabled={!session || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                className="w-full justify-center"
              >
                Import template
              </AppButton>
            ) : null}

            {projectId ? (
              <AppButton
                variant="ghost"
                disabled={!session || attachMutation.isPending}
                onClick={() => attachMutation.mutate()}
                className="w-full justify-center"
              >
                Attach to project
              </AppButton>
            ) : null}

            <Link to="/app/marketplace/cart">
              <AppButton variant="ghost" className="w-full justify-center">
                Cart{cartCountQuery.data ? ` (${cartCountQuery.data})` : ''}
              </AppButton>
            </Link>
          </AppCard>

          {/* Accordion: item details */}
          <AppCard className="space-y-0">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 text-sm font-semibold text-ink"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <span>Item details</span>
              <span className="text-ink/40">{detailsOpen ? '▲' : '▼'}</span>
            </button>
            {detailsOpen ? (
              <div className="mt-3 space-y-3 text-sm text-ink/75">
                {listing.description ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{listing.description}</p>
                ) : listing.summary ? (
                  <p className="leading-relaxed">{listing.summary}</p>
                ) : null}
                {listing.whimsical_note ? (
                  <ul className="space-y-1 pl-4">
                    {listing.whimsical_note.split('\n').filter(Boolean).map((bullet: string, i: number) => (
                      <li key={i} className="list-disc list-outside">{bullet.replace(/^[-•*]\s*/, '')}</li>
                    ))}
                  </ul>
                ) : null}
                {listing.kind === 'template' && (milestoneCount > 0 || taskCount > 0) ? (
                  <div className="space-y-3 pt-1">
                    {milestoneCount > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-1.5">
                          {milestoneCount} timeline block{milestoneCount !== 1 ? 's' : ''}
                        </p>
                        <ul className="space-y-1">
                          {listing.template_payload!.milestones!.map((m, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-ink/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal/60 shrink-0" />
                              {m.title}
                              <span className="text-ink/35 text-xs">{m.lane}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {taskCount > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-1.5">
                          {taskCount} task{taskCount !== 1 ? 's' : ''}
                        </p>
                        <ul className="space-y-1">
                          {listing.template_payload!.tasks!.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-ink/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-ink/25 shrink-0" />
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </AppCard>

          {/* Accordion: delivery & policies */}
          <AppCard className="space-y-0">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 text-sm font-semibold text-ink"
              onClick={() => setDeliveryOpen((v) => !v)}
            >
              <span>Delivery &amp; policies</span>
              <span className="text-ink/40">{deliveryOpen ? '▲' : '▼'}</span>
            </button>
            {deliveryOpen ? (
              <div className="mt-3 space-y-2 text-sm text-ink/75">
                {listing.fulfillment_days_min != null ? (
                  <p className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 shrink-0 text-ink/40" />
                    Delivery in {listing.fulfillment_days_min}
                    {listing.fulfillment_days_max && listing.fulfillment_days_max !== listing.fulfillment_days_min
                      ? `–${listing.fulfillment_days_max}`
                      : ''} day{listing.fulfillment_days_min !== 1 ? 's' : ''}
                  </p>
                ) : null}
                {listing.fulfillment_notes ? <p>{listing.fulfillment_notes}</p> : null}
                {listing.return_policy ? (
                  <p className="flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0 text-ink/40" />
                    {listing.return_policy}
                  </p>
                ) : null}
                {!listing.fulfillment_days_min && !listing.fulfillment_notes && !listing.return_policy ? (
                  <p className="text-ink/40">No delivery details provided.</p>
                ) : null}
              </div>
            ) : null}
          </AppCard>
        </div>
      </div>

      {/* Reviews section */}
      <AppCard className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionHeading
            eyebrow="Reviews"
            title={`${listing.review_count} review${listing.review_count !== 1 ? 's' : ''}${listing.review_count > 0 ? ` · ${formatRating(listing.rating_sum, listing.review_count)} ★` : ''}`}
          />
        </div>
        <ReviewsList
          listingId={listingId}
          sellerId={listing.owner_id}
          showRespondButton={session?.user.id === listing.owner_id}
        />
      </AppCard>

      {/* Write review (purchase-gated) */}
      <WriteReviewSection listingId={listingId} sellerId={listing.owner_id} listingTitle={listing.title} />

      {/* More from seller */}
      <AppCard>
        <MoreFromSeller
          sellerId={listing.owner_id}
          excludeId={listingId}
          sellerName={seller?.businessName ?? 'this seller'}
        />
      </AppCard>
    </div>
  )
}

// ─── Seller profile ───────────────────────────────────────────────────────────

function SellerProfilePage() {
  const { sellerId } = sellerProfileRoute.useParams()
  const profileQuery = useQuery({
    queryKey: ['seller-profile', sellerId],
    queryFn: () => fetchSellerPublicProfile(sellerId),
  })
  const listingsQuery = useQuery({
    queryKey: ['business-listings', sellerId],
    queryFn: () => fetchBusinessListings(sellerId),
  })
  const reviewsQuery = useQuery({
    queryKey: ['seller-reviews', sellerId],
    queryFn: () => fetchSellerReviews(sellerId, 6),
  })

  const profile = profileQuery.data
  const listings = listingsQuery.data ?? []
  const reviews = reviewsQuery.data ?? []
  const avgRating = profile && profile.totalReviewCount > 0
    ? (profile.totalRatingSum / profile.totalReviewCount).toFixed(1)
    : null

  const yearsActive = profile?.memberSince
    ? Math.max(1, new Date().getFullYear() - new Date(profile.memberSince).getFullYear())
    : null

  return (
    <div className="space-y-4">
      <Link to="/app/marketplace" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
        Marketplace
      </Link>

      {/* Seller card */}
      <AppCard className="space-y-4">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="ui-avatar-badge h-16 w-16 shrink-0 text-xl">
            {(profile?.businessName ?? '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-ink">{profile?.businessName ?? 'Loading…'}</h1>
            {profile?.serviceArea ? (
              <p className="text-sm text-ink/55 flex items-center justify-center gap-1 sm:justify-start">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {profile.serviceArea}
              </p>
            ) : null}
            {/* Stats row */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm justify-center sm:justify-start">
              {avgRating ? (
                <span className="flex items-center gap-1 font-semibold">
                  <span className="text-ink">★ {avgRating}</span>
                  <span className="text-ink/50">({profile?.totalReviewCount})</span>
                </span>
              ) : null}
              {profile?.totalSales ? (
                <span className="text-ink/65">
                  <span className="font-semibold text-ink">{profile.totalSales.toLocaleString()}</span> sales
                </span>
              ) : null}
              {yearsActive ? (
                <span className="text-ink/65">
                  <span className="font-semibold text-ink">{yearsActive}</span> year{yearsActive !== 1 ? 's' : ''} on Flow
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Message seller — opens DM */}
            <Link to="/app/messages">
              <AppButton variant="secondary">Message seller</AppButton>
            </Link>
          </div>
        </div>

        {profile?.availabilityNotes ? (
          <AppPanel tone="butter" className="text-sm text-ink/70">
            {profile.availabilityNotes}
          </AppPanel>
        ) : null}
      </AppCard>

      {/* Reviews preview */}
      {reviews.length > 0 ? (
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Reviews" title={`All reviews from this shop (${profile?.totalReviewCount ?? 0})`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="ui-panel space-y-2">
                <StarDisplay rating={review.rating} />
                <p className="text-sm text-ink/80 line-clamp-4">{review.body}</p>
                <p className="text-xs text-ink/45">
                  {review.reviewerDisplayName || (review.reviewerHandle ? `@${review.reviewerHandle}` : 'Buyer')} · {formatDate(review.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </AppCard>
      ) : null}

      {/* Listings grid */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Listings from this shop</p>
        {listings.length === 0 ? (
          <AppCard className="text-sm text-ink/60">No active listings yet.</AppCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings
              .filter((l) => l.is_published)
              .map((listing) => (
                <Link key={listing.id} to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
                  <AppCard className="h-full hover:-translate-y-0.5 transition space-y-1.5 bg-cloud">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">{listing.kind}</p>
                    <h3 className="text-base font-medium text-ink">{listing.title}</h3>
                    <p className="text-sm text-ink/60 line-clamp-2">{listing.summary}</p>
                    <p className="text-sm font-semibold text-ink">{listing.price_label}</p>
                  </AppCard>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Legacy business profile redirect
function BusinessProfilePage() {
  const { ownerId } = businessProfileRoute.useParams()
  const navigate = useNavigate()
  void navigate({ to: '/app/marketplace/seller/$sellerId', params: { sellerId: ownerId }, replace: true })
  return null
}

// ─── Listings management ──────────────────────────────────────────────────────

function ListingsManagementPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const ownerId = session?.user.id ?? ''
  const listingsQuery = useQuery({
    queryKey: ['business-listings', ownerId],
    queryFn: () => fetchBusinessListings(ownerId),
    enabled: Boolean(ownerId),
  })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects, enabled: Boolean(ownerId) })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmListingId, setDeleteConfirmListingId] = useState<string | null>(null)
  const [kind, setKind] = useState<'template' | 'service' | 'product'>('service')
  const [newCategory, setNewCategory] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newPriceLabel, setNewPriceLabel] = useState('')
  const [newWorkspaceProjectId, setNewWorkspaceProjectId] = useState('')
  const [newTemplatePayload, setNewTemplatePayload] = useState(JSON.stringify(defaultTemplatePayload, null, 2))
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const [workspaceProjectId, setWorkspaceProjectId] = useState('')
  const [editingKind, setEditingKind] = useState<'template' | 'service' | 'product'>('service')
  const [templatePayloadText, setTemplatePayloadText] = useState(JSON.stringify(defaultTemplatePayload, null, 2))
  const [imageFiles, setImageFiles] = useState<FileList | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createMarketplaceListing({
        ownerId,
        kind,
        category: newCategory,
        title: newTitle,
        summary: newSummary,
        priceLabel: newPriceLabel,
        workspaceProjectId: newWorkspaceProjectId || null,
        whimsicalNote: 'Crafted from your business dashboard.',
        templatePayload: kind === 'template' ? parseTemplatePayload(newTemplatePayload) : undefined,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] }),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateListing({
        listingId: editingId!,
        kind: editingKind,
        title,
        summary,
        priceLabel,
        workspaceProjectId: workspaceProjectId || null,
        templatePayload: editingKind === 'template' ? parseTemplatePayload(templatePayloadText) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
      setEditingId(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ listingId, isPublished }: { listingId: string; isPublished: boolean }) =>
      updateListing({ listingId, isPublished }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] }),
  })

  const duplicateMutation = useMutation({
    mutationFn: (listingId: string) => duplicateListing(listingId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] }),
  })

  const deleteListingMutation = useMutation({
    mutationFn: (listingId: string) => deleteMarketplaceListing(listingId),
    onSuccess: () => {
      setDeleteConfirmListingId(null)
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
    },
  })

  async function handleUploadImages(listingId: string) {
    if (!imageFiles?.length) return
    setUploadingFor(listingId)
    try {
      for (let i = 0; i < imageFiles.length; i++) {
        await uploadListingImage(listingId, imageFiles[i], i)
      }
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
      void queryClient.invalidateQueries({ queryKey: ['listing-images', listingId] })
      setImageFiles(null)
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Business" title="Listings management" />
        <p className="text-sm text-ink/65">Create and manage your listings. Add images to make them stand out in the marketplace.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <AppSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="service">Service</option>
            <option value="product">Product</option>
            <option value="template">Template</option>
          </AppSelect>
          <AppInput value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" />
          <AppInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
          <AppInput value={newPriceLabel} onChange={(e) => setNewPriceLabel(e.target.value)} placeholder="Price (e.g. $120)" />
          <AppSelect value={newWorkspaceProjectId} onChange={(e) => setNewWorkspaceProjectId(e.target.value)}>
            <option value="">No workspace project</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </AppSelect>
          <AppTextarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} className="min-h-24 md:col-span-2" placeholder="Summary" />
          {kind === 'template' ? (
            <AppTextarea
              value={newTemplatePayload}
              onChange={(e) => setNewTemplatePayload(e.target.value)}
              className="min-h-48 font-mono text-sm md:col-span-2"
              aria-label="Template JSON"
            />
          ) : null}
          <div className="md:col-span-2">
            <AppButton onClick={() => createMutation.mutate()} disabled={!ownerId || createMutation.isPending || !newTitle.trim()}>
              Create listing
            </AppButton>
          </div>
        </div>
      </AppCard>

      {editingId ? (
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Edit" title="Update listing" />
          <AppInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <AppInput value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="Price label" />
          <AppSelect value={workspaceProjectId} onChange={(e) => setWorkspaceProjectId(e.target.value)}>
            <option value="">No workspace project</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </AppSelect>
          <AppTextarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-28" placeholder="Summary" />
          {editingKind === 'template' ? (
            <AppTextarea
              value={templatePayloadText}
              onChange={(e) => setTemplatePayloadText(e.target.value)}
              className="min-h-48 w-full font-mono text-sm"
              aria-label="Edit template JSON"
            />
          ) : null}
          <div className="flex gap-3">
            <AppButton onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save</AppButton>
            <AppButton variant="ghost" onClick={() => setEditingId(null)}>Cancel</AppButton>
          </div>
        </AppCard>
      ) : null}

      <div className="grid gap-3">
        {(listingsQuery.data ?? []).map((listing) => (
          <AppCard key={listing.id} className="bg-cloud space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{listing.title}</p>
                <p className="text-sm text-ink/60">{listing.kind} · {listing.category} · {listing.price_label}</p>
              </div>
              <AppPill tone={listing.is_published ? 'butter' : 'default'} className="py-1">
                {listing.is_published ? 'Active' : 'Draft'}
              </AppPill>
            </div>

            {/* Image upload for this listing */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="ui-upload-chip cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setImageFiles(e.target.files)}
                />
                Add images
              </label>
              {imageFiles?.length && uploadingFor !== listing.id ? (
                <AppButton
                  variant="secondary"
                  className="text-xs"
                  onClick={() => void handleUploadImages(listing.id)}
                >
                  Upload {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''}
                </AppButton>
              ) : null}
              {uploadingFor === listing.id ? <span className="text-xs text-ink/50">Uploading…</span> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <AppButton
                variant="ghost"
                onClick={() => {
                  setEditingId(listing.id)
                  setEditingKind(listing.kind)
                  setTitle(listing.title)
                  setSummary(listing.summary)
                  setPriceLabel(listing.price_label)
                  setWorkspaceProjectId(listing.workspace_project_id ?? '')
                  setTemplatePayloadText(JSON.stringify(listing.template_payload ?? defaultTemplatePayload, null, 2))
                }}
              >
                Edit
              </AppButton>
              <AppButton variant="ghost" onClick={() => toggleMutation.mutate({ listingId: listing.id, isPublished: !listing.is_published })}>
                {listing.is_published ? 'Pause' : 'Publish'}
              </AppButton>
              <AppButton variant="secondary" onClick={() => duplicateMutation.mutate(listing.id)}>Duplicate</AppButton>
              <Link to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
                <AppButton variant="ghost">View</AppButton>
              </Link>
              {deleteConfirmListingId === listing.id ? (
                <>
                  <span className="self-center text-xs font-bold text-berry">Delete listing?</span>
                  <AppButton variant="secondary" onClick={() => deleteListingMutation.mutate(listing.id)} disabled={deleteListingMutation.isPending}>
                    Yes, delete
                  </AppButton>
                  <AppButton variant="ghost" onClick={() => setDeleteConfirmListingId(null)}>Cancel</AppButton>
                </>
              ) : (
                <AppButton variant="ghost" onClick={() => setDeleteConfirmListingId(listing.id)}>Delete</AppButton>
              )}
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  )
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const listingDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/listings/$listingId',
  component: ListingDetailPage,
})

export const sellerProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/seller/$sellerId',
  component: SellerProfilePage,
})

export const businessProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/$ownerId',
  component: BusinessProfilePage,
})

export const listingsManagementRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/manage',
  component: ListingsManagementPage,
})

// Legacy route kept for compatibility
export const legacyListingsManagementRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/listings',
  component: ListingsManagementPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultTemplatePayload: TemplatePayload = {
  milestones: [
    { title: 'Kickoff', offsetDays: 0, durationDays: 1, lane: 'Planning' },
    { title: 'Execution window', offsetDays: 1, durationDays: 3, lane: 'Delivery' },
  ],
  tasks: [
    { title: 'Confirm scope', offsetDays: 0 },
    { title: 'Send prep checklist', offsetDays: 1 },
  ],
}

function parseTemplatePayload(value: string): TemplatePayload {
  const parsed = JSON.parse(value) as TemplatePayload
  return {
    durationDays: parsed.durationDays,
    milestones: parsed.milestones ?? [],
    tasks: parsed.tasks ?? [],
  }
}
