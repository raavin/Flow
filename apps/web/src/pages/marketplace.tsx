import { useState } from 'react'
import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { AppButton, AppCard, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchMarketplaceListingsBrowse, getListingImageUrl } from '@/lib/marketplace'
import { addToCart, fetchCartCount } from '@/lib/cart'
import { formatRating } from '@/lib/reviews'
import type { BrowseListing, MarketplaceKind } from '@superapp/types'

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRating({ ratingSum, reviewCount, size = 'sm' }: { ratingSum: number; reviewCount: number; size?: 'sm' | 'xs' }) {
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
      <span className="ml-1 tabular-nums text-ink/50">{formatRating(ratingSum, reviewCount)} ({reviewCount})</span>
    </span>
  )
}

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, onAddToCart, addingId }: {
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
              <span className="text-xs text-ink/30 uppercase tracking-widest">No image</span>
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
          <p className="text-sm font-medium text-ink line-clamp-2 leading-snug hover:underline">{listing.title}</p>
        </Link>
        <Link to="/app/marketplace/seller/$sellerId" params={{ sellerId: listing.sellerId }}>
          <p className="text-xs text-ink/55 hover:text-ink hover:underline">{listing.sellerName}</p>
        </Link>
        <StarRating ratingSum={listing.ratingSum} reviewCount={listing.reviewCount} size="xs" />
        <p className="text-sm font-semibold text-ink">{listing.priceLabel}</p>
      </div>

      {/* Add to cart — visible on hover */}
      <button
        type="button"
        className="mt-2 w-full border border-border py-1.5 text-xs font-medium text-ink/70 opacity-0 transition group-hover:opacity-100 hover:border-ink hover:text-ink"
        disabled={addingId === listing.id}
        onClick={() => onAddToCart(listing.id)}
      >
        {addingId === listing.id ? 'Adding…' : 'Add to cart'}
      </button>
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`ui-chip-toggle ${active ? 'ui-chip-toggle--active' : 'ui-chip-toggle--inactive'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ─── Browse page ──────────────────────────────────────────────────────────────

function MarketplaceBrowsePage() {
  const { session } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
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
    <div className="space-y-0">
      {/* Header bar */}
      <AppCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ui-eyebrow">Flow</p>
          <h1 className="ui-section-title">Market</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session ? (
            <Link to="/app/marketplace/manage">
              <AppButton variant="ghost">Sell</AppButton>
            </Link>
          ) : null}
          <Link to="/app/marketplace/cart">
            <AppButton variant="secondary" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart{cartCountQuery.data ? ` (${cartCountQuery.data})` : ''}
            </AppButton>
          </Link>
        </div>
      </AppCard>

      {/* Filters */}
      <AppCard className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as KindFilter[]).map((k) => (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
              {KIND_LABELS[k]}
            </FilterChip>
          ))}
        </div>
        <select
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
              <button type="button" className="underline" onClick={() => void navigate({ to: '/app/marketplace/manage' })}>
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
                onAddToCart={(id) => { if (session) addToCartMutation.mutate(id) }}
                addingId={addingId}
              />
            ))}
          </div>
        )}
      </AppCard>
    </div>
  )
}

export const marketplaceBrowseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace',
  component: MarketplaceBrowsePage,
})

// Keep legacy routes redirecting to the unified browse page
function LegacyRedirect({ to }: { to: string }) {
  const navigate = useNavigate()
  void navigate({ to, replace: true })
  return null
}

function LegacyTemplatesPage() { return <LegacyRedirect to="/app/marketplace" /> }
function LegacyServicesPage() { return <LegacyRedirect to="/app/marketplace" /> }

export const templateMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/templates',
  component: LegacyTemplatesPage,
})

export const servicesMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/services',
  component: LegacyServicesPage,
})
