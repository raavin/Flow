import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MarketplaceViews } from '@/components/section-views'
import { AppCard, AppPanel } from '@superapp/ui'

import { useAppStore } from '@/hooks/useAppStore'
import { fetchMarketplaceListingsBrowse, getListingImageUrl } from '@/lib/marketplace'
import { addToCart, fetchCartCount } from '@/lib/cart'
import { formatRating } from '@/lib/reviews'
import type { BrowseListing, MarketplaceKind } from '@superapp/types'

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRating({
  ratingSum,
  reviewCount,
  size = 'sm',
}: {
  ratingSum: number
  reviewCount: number
  size?: 'sm' | 'xs'
}) {
  if (reviewCount === 0) return null
  const avg = ratingSum / reviewCount
  const full = Math.floor(avg)
  const hasHalf = avg - full >= 0.4 && avg - full < 0.9
  const empty = 5 - full - (hasHalf ? 1 : 0)
  const starSize = size === 'xs' ? 'text-[10px]' : 'text-xs'
  return (
    <span className={`inline-flex items-center gap-0.5 ${starSize} text-ink/70`}>
      {'★'.repeat(full)}
      {hasHalf ? '½' : ''}
      {'☆'.repeat(empty)}
      <span className="ml-1 tabular-nums text-ink/50">
        {formatRating(ratingSum, reviewCount)} ({reviewCount})
      </span>
    </span>
  )
}

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  onAddToCart,
  addingId,
}: {
  listing: BrowseListing
  onAddToCart: (id: string) => void
  addingId: string | null
}) {
  const imageUrl = listing.coverImagePath ? getListingImageUrl(listing.coverImagePath) : null

  return (
    <div className="group flex flex-col">
      {/* Image */}
      <Link to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
        <div className="relative aspect-square w-full overflow-hidden bg-cloud border border-border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={listing.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="p-6">
                <p className="text-sm font-semibold capitalize">{listing.kind}</p>
                <p className="mt-3 text-lg font-semibold">{listing.title}</p>
              </div>
            </div>
          )}
          {listing.locationLabel ? (
            <span className="absolute bottom-2 left-2 bg-surface/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink/70 border border-border">
              {listing.locationLabel}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Meta */}
      <div className="mt-2 space-y-0.5">
        <Link to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
          <p className="text-sm font-medium text-ink line-clamp-2 leading-snug hover:underline">
            {listing.title}
          </p>
        </Link>
        {listing.sellerId ? (
          <Link to="/app/marketplace/seller/$sellerId" params={{ sellerId: listing.sellerId }}>
            <p className="text-xs text-ink/55 hover:text-ink hover:underline">{listing.sellerName}</p>
          </Link>
        ) : (
          <p className="text-xs text-ink/60">Flow template</p>
        )}
        <StarRating ratingSum={listing.ratingSum} reviewCount={listing.reviewCount} size="xs" />
        <p className="text-sm font-semibold text-ink">{listing.priceLabel}</p>
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-2">
        <Link
          to="/app/marketplace/listings/$listingId"
          params={{ listingId: listing.id }}
          className="flex-1 border border-border py-1.5 text-center text-xs font-medium text-ink/70 hover:border-ink hover:text-ink transition"
        >
          {listing.kind === 'template'
            ? 'View template'
            : listing.kind === 'service'
              ? 'View service'
              : 'View item'}
        </Link>
        <button
          type="button"
          className="flex-1 border border-border py-1.5 text-xs font-medium text-ink/70 hover:border-ink hover:text-ink transition disabled:opacity-40"
          disabled={addingId === listing.id}
          onClick={() => onAddToCart(listing.id)}
        >
          {addingId === listing.id ? 'Adding…' : 'Save item'}
        </button>
      </div>
    </div>
  )
}

// ─── Kind/category filter chips ───────────────────────────────────────────────

type KindFilter = 'all' | MarketplaceKind

const KIND_LABELS: Record<KindFilter, string> = {
  all: 'All',
  template: 'Templates',
  service: 'Services',
  product: 'Products',
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`ui-chip-toggle min-h-11 min-w-0 !px-2 ${active ? 'ui-chip-toggle--active' : 'ui-chip-toggle--inactive'}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export function MarketplaceBrowsePage({ initialKind = 'all' }: { initialKind?: KindFilter } = {}) {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [kindFilter, setKindFilter] = useState<KindFilter>(initialKind)
  const [sort, setSort] = useState<'newest' | 'rating' | 'price_asc' | 'price_desc'>('newest')
  const [addingId, setAddingId] = useState<string | null>(null)

  const cartCountQuery = useQuery({
    queryKey: ['cart-count'],
    queryFn: fetchCartCount,
    enabled: Boolean(session),
  })

  const listingsQuery = useQuery({
    queryKey: ['marketplace-browse', kindFilter, sort],
    queryFn: () =>
      fetchMarketplaceListingsBrowse({
        kind: kindFilter === 'all' ? undefined : kindFilter,
        sort,
      }),
  })

  const addToCartMutation = useMutation({
    mutationFn: (listingId: string) => addToCart({ ownerId: session!.user.id, listingId }),
    onMutate: (listingId) => setAddingId(listingId),
    onSettled: () => setAddingId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart-count'] })
    },
  })

  const listings = listingsQuery.data ?? []

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <AppCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ui-eyebrow">Flow</p>
          <h1 className="ui-section-title">Marketplace</h1>
        </div>
      </AppCard>
      <MarketplaceViews active="browse" savedCount={cartCountQuery.data ?? 0} />

      {/* Filters */}
      <AppCard className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Listing type"
          className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto"
        >
          {(Object.keys(KIND_LABELS) as KindFilter[]).map((k) => (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
              {KIND_LABELS[k]}
            </FilterChip>
          ))}
        </div>
        <select
          aria-label="Sort listings"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="ui-input ui-select w-auto text-sm py-1.5"
        >
          <option value="newest">Newest</option>
          <option value="rating">Top rated</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </AppCard>

      {/* Grid */}
      <AppCard>
        {listingsQuery.isPending ? (
          <p className="text-sm text-ink/50 py-8 text-center">Loading listings…</p>
        ) : listingsQuery.isError ? (
          <AppPanel className="text-sm font-mono text-red-700">{String(listingsQuery.error)}</AppPanel>
        ) : listings.length === 0 ? (
          <AppPanel className="text-sm text-ink/60">
            No listings match these filters yet. Check back soon or{' '}
            {session ? (
              <button
                type="button"
                className="underline"
                onClick={() => void navigate({ to: '/app/marketplace/manage' })}
              >
                publish one yourself
              </button>
            ) : (
              'sign in to sell'
            )}
            .
          </AppPanel>
        ) : (
          <div className="grid gap-x-4 gap-y-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onAddToCart={(id) => {
                  if (session) addToCartMutation.mutate(id)
                }}
                addingId={addingId}
              />
            ))}
          </div>
        )}
      </AppCard>
    </div>
  )
}

// Keep legacy routes redirecting to the unified browse page
export function LegacyTemplatesPage() {
  return <MarketplaceBrowsePage initialKind="template" />
}
export function LegacyServicesPage() {
  return <MarketplaceBrowsePage initialKind="service" />
}
