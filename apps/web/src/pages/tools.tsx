import { useEffect, useMemo, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { addToCart, fetchCartCount, fetchCartItems, placeOrderFromCart, removeCartItem, summarizeCart, updateCartItem } from '@/lib/cart'
import { formatCurrency, supportsCartQuantity } from '@/lib/commerce'
import { fetchConnectedIntegrations } from '@/lib/integrations'
import { fetchMarketplaceListings } from '@/lib/marketplace'
import { fetchProjects } from '@/lib/projects'
import { universalSearch } from '@/lib/search'
import { updateProfileSettings } from '@/lib/profile'
import { fetchSocialProfile } from '@/lib/social'

function CategoryBrowsePage() {
  const { category } = categoryBrowseRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const cartCountQuery = useQuery({
    queryKey: ['cart-count'],
    queryFn: fetchCartCount,
    enabled: Boolean(session),
  })
  const listingsQuery = useQuery({
    queryKey: ['category-browse', category],
    queryFn: async () => {
      const templates = await fetchMarketplaceListings('template')
      const services = await fetchMarketplaceListings('service')
      const products = await fetchMarketplaceListings('product')
      return [...(templates ?? []), ...(services ?? []), ...(products ?? [])].filter((item) =>
        item.category.toLowerCase().includes(category.toLowerCase()) ||
        item.kind.toLowerCase().includes(category.toLowerCase()),
      )
    },
  })
  const [projectId, setProjectId] = useState('')
  const addMutation = useMutation({
    mutationFn: (listingId: string) =>
      addToCart({
        ownerId: session!.user.id,
        listingId,
        linkedProjectId: projectId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart-count'] })
    },
  })

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading
          eyebrow="Browse"
          title={`Category: ${category}`}
          action={
            <Link to="/app/marketplace/cart">
              <AppButton variant="secondary">Cart{cartCountQuery.data ? ` (${cartCountQuery.data})` : ''}</AppButton>
            </Link>
          }
        />
        <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="max-w-sm">
          <option value="">No project context</option>
          {(projectsQuery.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </AppSelect>
      </AppCard>
      <div className="grid gap-4 md:grid-cols-2">
        {(listingsQuery.data ?? []).map((listing) => (
          <AppCard key={listing.id} className="bg-cloud">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-berry">{listing.kind}</p>
            <h3 className="mt-2 text-xl font-extrabold text-ink">{listing.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{listing.summary}</p>
            <p className="mt-3 text-sm font-bold text-teal">{listing.priceLabel}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
                <AppButton variant="ghost">Details</AppButton>
              </Link>
              <AppButton onClick={() => addMutation.mutate(listing.id)} disabled={!session || addMutation.isPending}>
                Add to cart
              </AppButton>
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  )
}

function CartReviewPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: () => fetchCartItems({ status: 'draft' }) })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const integrationsQuery = useQuery({
    queryKey: ['connected-integrations'],
    queryFn: fetchConnectedIntegrations,
    enabled: Boolean(session),
  })

  // Whether the seller has Stripe connected is checked server-side by create-payment-intent.
  // The SPA can't query the seller's connected_integrations (RLS). Placeholder for Stripe.js wiring.
  void integrationsQuery
  const sellerHasStripe = false

  const checkoutMutation = useMutation({
    mutationFn: () => placeOrderFromCart({ cartItemIds: (cartQuery.data ?? []).map((item) => item.id) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart-count'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      void queryClient.invalidateQueries({ queryKey: ['seller-ledger'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const removeMutation = useMutation({
    mutationFn: (cartItemId: string) => removeCartItem(cartItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart-count'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: (input: {
      cartItemId: string
      quantity?: number
      linkedProjectId?: string | null
      bookingDate?: string | null
      bookingNote?: string | null
    }) => updateCartItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const summary = useMemo(() => summarizeCart(cartQuery.data ?? []), [cartQuery.data])
  const orders = checkoutMutation.data ?? []

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Cart" title="Review your draft order" />
        <div className="grid gap-3">
          {(cartQuery.data ?? []).map((item) => {
            const listing = item.listing
            return (
              <AppPanel key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink">{listing?.title ?? 'Listing'}</p>
                    <p className="text-sm text-ink/65">
                      {listing ? `${listing.kind} · ${listing.priceLabel}` : '$0'} · {item.linkedProjectId ? 'linked to project' : 'no project yet'}
                    </p>
                    {listing?.sku ? <p className="text-xs text-ink/50">Code: {listing.sku}</p> : null}
                  </div>
                  <p className="text-lg font-extrabold text-ink">
                    {formatCurrency((listing?.priceCents ?? 0) * item.quantity, listing?.currencyCode ?? 'AUD')}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <AppSelect
                    value={item.linkedProjectId ?? ''}
                    onChange={(event) =>
                      updateMutation.mutate({
                        cartItemId: item.id,
                        linkedProjectId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">No linked project</option>
                    {(projectsQuery.data ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </AppSelect>
                  <AppInput
                    type="date"
                    value={item.bookingDate ? item.bookingDate.slice(0, 10) : ''}
                    onChange={(event) =>
                      updateMutation.mutate({
                        cartItemId: item.id,
                        bookingDate: event.target.value ? `${event.target.value}T09:00:00.000Z` : null,
                      })
                    }
                  />
                  <AppInput
                    className="md:col-span-2"
                    value={item.bookingNote ?? ''}
                    onChange={(event) =>
                      updateMutation.mutate({
                        cartItemId: item.id,
                        bookingNote: event.target.value,
                      })
                    }
                    placeholder="Booking or delivery note"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {supportsCartQuantity(listing?.kind ?? 'template') ? (
                    <>
                      <AppButton
                        variant="ghost"
                        onClick={() =>
                          updateMutation.mutate({
                            cartItemId: item.id,
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                      >
                        -
                      </AppButton>
                      <span className="min-w-10 text-center text-sm font-bold text-ink">{item.quantity}</span>
                      <AppButton
                        variant="ghost"
                        onClick={() =>
                          updateMutation.mutate({
                            cartItemId: item.id,
                            quantity: item.quantity + 1,
                          })
                        }
                      >
                        +
                      </AppButton>
                    </>
                  ) : (
                    <span className="text-sm text-ink/55">Quantity fixed to 1 for this item</span>
                  )}
                  <div className="ml-auto">
                    <AppButton variant="ghost" onClick={() => removeMutation.mutate(item.id)}>
                      Remove
                    </AppButton>
                  </div>
                </div>
              </AppPanel>
            )
          })}
          {!cartQuery.data?.length ? <p className="text-sm text-ink/60">Your selected services and products will appear here while you shop.</p> : null}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Checkout" title={sellerHasStripe ? 'Payment' : 'Mock payment confirmation'} />
        <AppPanel tone="butter">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-ink/50">Subtotal</p>
            <p className="text-lg font-extrabold text-ink">{formatCurrency(summary.subtotalCents, summary.currencyCode)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-ink/50">Tax</p>
            <p className="text-lg font-extrabold text-ink">{formatCurrency(summary.taxCents, summary.currencyCode)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <p className="text-xs font-bold uppercase text-ink/50">Total</p>
            <p className="text-2xl font-extrabold text-ink">{formatCurrency(summary.totalCents, summary.currencyCode)}</p>
          </div>
        </AppPanel>
        <p className="text-sm text-ink/70">
          {sellerHasStripe
            ? 'Stripe is connected — payment will be confirmed with Stripe before the order is placed.'
            : 'Checkout is mocked for now, but it follows the real pattern: cart draft to placed order, then buyer transaction and seller financial entry.'}
        </p>
        <AppButton disabled={!session || !(cartQuery.data ?? []).length || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
          {checkoutMutation.isPending ? 'Placing order...' : 'Place order'}
        </AppButton>
        {orders.length ? (
          <AppPanel tone="teal" className="space-y-2 text-sm text-ink">
            <p className="font-extrabold">Order placed</p>
            {orders.map((order) => (
              <p key={order.order_id}>
                {order.order_number} · {formatCurrency(order.total_cents)}
              </p>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/app/wallet" search={{ highlight: orders[0]?.order_id ?? undefined }}>
                <AppButton variant="ghost">View transactions</AppButton>
              </Link>
              <Link to="/app/marketplace/services">
                <AppButton variant="ghost">Keep shopping</AppButton>
              </Link>
            </div>
          </AppPanel>
        ) : null}
      </AppCard>
    </div>
  )
}

function SearchPage() {
  const { session } = useAppStore()
  const [query, setQuery] = useState('')
  const searchQuery = useQuery({
    queryKey: ['search', query, session?.user.id],
    queryFn: () => universalSearch(query, session?.user.id),
  })

  const projectItems = (searchQuery.data?.projects ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: `/app/projects/${item.id}` as const,
  }))
  const listingItems = (searchQuery.data?.listings ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: `/app/marketplace/listings/${item.id}` as const,
  }))
  const messageItems = (searchQuery.data?.messages ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: (item.kind === 'post' ? `/app/messages/post/${item.id}` : '/app/messages') as string,
  }))
  const jobItems = (searchQuery.data?.jobs ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: `/app/jobs/${item.id}` as const,
  }))
  const supportItems = (searchQuery.data?.support ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: '/app/support' as const,
  }))

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Search" title="Universal command" />
        <AppInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="py-4 text-base"
          placeholder="plan a move next month, find cleaner, who hasn't replied?"
        />
      </AppCard>
      <div className="grid gap-4 md:grid-cols-2">
        <ResultCard title="Projects" items={projectItems} />
        <ResultCard title="Listings" items={listingItems} />
        <ResultCard title="Messages" items={messageItems} />
        <ResultCard title="Jobs" items={jobItems} />
        <ResultCard title="Support" items={supportItems} />
      </div>
    </div>
  )
}

function SettingsPage() {
  const { session, profile } = useAppStore()
  const isBusiness = profile?.active_mode === 'business'
  const queryClient = useQueryClient()
  const socialProfileQuery = useQuery({
    queryKey: ['social-profile', session?.user.id, session?.user.id],
    queryFn: () => fetchSocialProfile(session!.user.id, session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [timeZone, setTimeZone] = useState(profile?.time_zone ?? 'Australia/Sydney')
  const [integrations, setIntegrations] = useState<string[]>(profile?.integrations ?? [])
  const [bio, setBio] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    setBio(socialProfileQuery.data?.profile?.bio ?? '')
    setHandle(socialProfileQuery.data?.profile?.handle ?? '')
  }, [socialProfileQuery.data?.profile?.bio, socialProfileQuery.data?.profile?.handle])
  const mutation = useMutation({
    mutationFn: () => {
      const handleError = settingsValidateHandle(handle)
      if (handleError) throw new Error(handleError)
      return updateProfileSettings({
        userId: session!.user.id,
        firstName,
        lastName,
        location,
        timeZone,
        integrations,
        bio,
        handle: handle.trim() || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      void queryClient.invalidateQueries({ queryKey: ['social-profile', session?.user.id, session?.user.id] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow={isBusiness ? 'Profile & Admin' : 'Profile'} title={isBusiness ? 'Business profile and defaults' : 'Profile and defaults'} />
        <AppInput value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
        <AppInput value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
        <AppInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
        <AppInput value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Time zone" />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">@</span>
          <AppInput
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30))}
            style={{ paddingLeft: '1.75rem' }}
            placeholder="yourhandle"
          />
        </div>
        <AppTextarea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-24" placeholder="Bio" />
        <div className="flex flex-wrap gap-2">
          {['calendar', 'contacts', 'notifications', 'payments'].map((item) => (
            <button
              key={item}
              onClick={() =>
                setIntegrations((current) =>
                  current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
                )
              }
              className={integrations.includes(item) ? 'ui-chip-toggle ui-chip-toggle--active' : 'ui-chip-toggle ui-chip-toggle--inactive'}
            >
              {item}
            </button>
          ))}
        </div>
        <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
          Save settings
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow={isBusiness ? 'Admin' : 'Integrations'} title={isBusiness ? 'Current setup and controls' : 'Current setup'} />
        <div className="grid gap-3">
          <AppPanel>Connected calendars: {integrations.includes('calendar') ? 'enabled' : 'not yet'}</AppPanel>
          <AppPanel>Contacts permission: {integrations.includes('contacts') ? 'enabled' : 'not yet'}</AppPanel>
          <AppPanel>Notifications: {integrations.includes('notifications') ? 'enabled' : 'not yet'}</AppPanel>
          <AppPanel>Payment methods: {integrations.includes('payments') ? 'connected later' : 'not connected'}</AppPanel>
        </div>
        {isBusiness ? (
          <AppPanel tone="surface" className="text-sm text-ink/65">
            Business mode collects the profile, integration defaults, and light admin controls in one place for now.
          </AppPanel>
        ) : null}
      </AppCard>
    </div>
  )
}

function settingsValidateHandle(handle: string) {
  if (!handle) return null
  if (handle.length < 3) return 'Handle must be at least 3 characters.'
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(handle)) return 'Only lowercase letters, numbers, underscores, hyphens and dots.'
  return null
}

function ResultCard({ title, items }: { title: string; items: Array<{ id: string; label: string; href: string }> }) {
  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Results" title={title} />
      <div className="grid gap-2">
        {items.map((item) => (
          <Link key={item.id} to={item.href as never}>
            <AppPanel className="rounded-control p-3 text-sm transition hover:-translate-y-0.5 hover:shadow-md">
              {item.label}
            </AppPanel>
          </Link>
        ))}
        {!items.length ? <p className="text-sm text-ink/55">No matches yet.</p> : null}
      </div>
    </AppCard>
  )
}

export const categoryBrowseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/category/$category',
  component: CategoryBrowsePage,
})

export const cartRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/cart',
  component: CartReviewPage,
})

export const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'search',
  component: SearchPage,
})

export const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: SettingsPage,
})
