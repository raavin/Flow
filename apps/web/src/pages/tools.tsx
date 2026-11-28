import { categoryBrowseRoute, searchRoute } from '@/route-definitions'
import { MarketplaceViews } from '@/components/section-views'
import { PrivacySettings } from '@/components/privacy-settings'
import { BusinessSettings } from '@/components/business-settings'
import { QueryFeedback, MutationFeedback } from '@/components/request-feedback'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppButton,
  AppCard,
  AppInput,
  AppPanel,
  AppSelect,
  AppTextarea,
  FieldLabel,
  SectionHeading,
} from '@superapp/ui'

import { useAppStore } from '@/hooks/useAppStore'
import {
  addToCart,
  fetchCartCount,
  fetchCartItems,
  removeCartItem,
  summarizeCart,
  updateCartItem,
} from '@/lib/cart'
import { formatCurrency, supportsCartQuantity } from '@/lib/commerce'
import { fetchMarketplaceListings } from '@/lib/marketplace'
import { fetchProjects } from '@/lib/projects'
import { universalSearch } from '@/lib/search'
import { updateProfileSettings } from '@/lib/profile'
import { fetchSocialProfile } from '@/lib/social'

export function CategoryBrowsePage() {
  const { category } = categoryBrowseRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })
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
      return [...(templates ?? []), ...(services ?? []), ...(products ?? [])].filter(
        (item) =>
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
              <AppButton variant="secondary">
                Saved items
                {cartCountQuery.data ? ` (${cartCountQuery.data})` : ''}
              </AppButton>
            </Link>
          }
        />
        <FieldLabel>
          Project
          <AppSelect
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="max-w-sm"
          >
            <option value="">No project context</option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </AppSelect>
        </FieldLabel>
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
              <AppButton
                onClick={() => addMutation.mutate(listing.id)}
                disabled={!session || addMutation.isPending}
              >
                Save item
              </AppButton>
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  )
}

export function CartReviewPage() {
  const queryClient = useQueryClient()
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: () => fetchCartItems({ status: 'draft' }),
  })
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
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

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="xl:col-span-2">
        <MarketplaceViews active="saved" />
      </div>
      <AppCard className="space-y-4">
        <SectionHeading title="Saved items" />
        <div className="grid gap-3">
          {(cartQuery.data ?? []).map((item) => {
            const listing = item.listing
            return (
              <AppPanel key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink">{listing?.title ?? 'Listing'}</p>
                    <p className="text-sm text-ink/65">
                      {listing ? `${listing.kind} · ${listing.priceLabel}` : '$0'} ·{' '}
                      {item.linkedProjectId ? 'linked to project' : 'no project yet'}
                    </p>
                    {listing?.sku ? <p className="text-xs text-ink/50">Code: {listing.sku}</p> : null}
                  </div>
                  <p className="text-lg font-extrabold text-ink">
                    {formatCurrency(
                      (listing?.priceCents ?? 0) * item.quantity,
                      listing?.currencyCode ?? 'AUD',
                    )}
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
          {!cartQuery.data?.length ? (
            <p className="text-sm text-ink/60">
              Your selected services and products will appear here while you shop.
            </p>
          ) : null}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading title="Estimated cost" />
        <AppPanel tone="butter">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-ink/50">Subtotal</p>
            <p className="text-lg font-extrabold text-ink">
              {formatCurrency(summary.subtotalCents, summary.currencyCode)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-ink/50">Tax</p>
            <p className="text-lg font-extrabold text-ink">
              {formatCurrency(summary.taxCents, summary.currencyCode)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <p className="text-xs font-bold uppercase text-ink/50">Total</p>
            <p className="text-2xl font-extrabold text-ink">
              {formatCurrency(summary.totalCents, summary.currencyCode)}
            </p>
          </div>
        </AppPanel>
        <p className="text-sm text-ink/70">
          These items are saved for planning. Contact the supplier to arrange a purchase.
        </p>
        <Link
          to="/app/marketplace/requests"
          search={{}}
          className="inline-flex min-h-11 items-center underline"
        >
          Requests and quotes
        </Link>
      </AppCard>
    </div>
  )
}

export function SearchPage() {
  const { session } = useAppStore()
  const { q } = searchRoute.useSearch()
  const query = q ?? ''
  const navigate = useNavigate({ from: searchRoute.fullPath })
  const setQuery = (q: string) => void navigate({ search: { q: q || undefined }, replace: true })
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(timer)
  }, [query])
  const searchQuery = useQuery({
    queryKey: ['search', debounced, session?.user.id],
    queryFn: () => universalSearch(debounced),
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
    href: (item.kind === 'post' ? `/app/messages/post/${item.id}` : `/app/messages/dm/${item.id}`) as string,
  }))
  const jobItems = (searchQuery.data?.jobs ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: `/app/jobs/${item.id}` as const,
  }))
  const supportItems = (searchQuery.data?.support ?? []).map((item) => ({
    id: item.id,
    label: item.title,
    href: `/app/support#${item.id}`,
  }))

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading title="Search" />
        <AppInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="py-4 text-base"
          aria-label="Search Flow"
          placeholder="Search people, topics, posts or projects"
        />
      </AppCard>
      <QueryFeedback query={searchQuery} />
      <div className="grid gap-4 md:grid-cols-2">
        <ResultCard
          title="People"
          items={(searchQuery.data?.people ?? []).map((p) => ({
            id: p.id,
            label: `${p.display_name || p.handle} · @${p.handle}`,
            href: `/app/messages/profile/${p.id}`,
          }))}
        />
        <ResultCard
          title="Topics"
          items={(searchQuery.data?.topics ?? []).map((t) => ({
            id: t.id,
            label: `#${t.label}`,
            href: `/app/messages/topics/${t.slug}`,
          }))}
        />
        <ResultCard title="Projects" items={projectItems} />
        <ResultCard title="Listings" items={listingItems} />
        <ResultCard title="Messages" items={messageItems} />
        <ResultCard title="Jobs" items={jobItems} />
        <ResultCard title="Support" items={supportItems} />
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { session, profile } = useAppStore()
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
      void queryClient.invalidateQueries({
        queryKey: ['social-profile', session?.user.id, session?.user.id],
      })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <AppCard className="space-y-4">
        <SectionHeading title="Profile" />
        <FieldLabel>
          First name
          <AppInput
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
          />
        </FieldLabel>
        <FieldLabel>
          Last name
          <AppInput
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
          />
        </FieldLabel>
        <FieldLabel>
          Location
          <AppInput
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location"
          />
        </FieldLabel>
        <FieldLabel>
          Time zone
          <AppInput
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            placeholder="Time zone"
          />
        </FieldLabel>
        <FieldLabel>
          Username
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">
              @
            </span>
            <AppInput
              value={handle}
              onChange={(event) =>
                setHandle(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_.-]/g, '')
                    .slice(0, 30),
                )
              }
              style={{ paddingLeft: '1.75rem' }}
              placeholder="yourhandle"
            />
          </div>
        </FieldLabel>
        <FieldLabel>
          Bio
          <AppTextarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="min-h-24"
            placeholder="Bio"
          />
        </FieldLabel>
        <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save profile'}
        </AppButton>
        <MutationFeedback mutation={mutation} success="Profile saved." />
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading title="Preferences" />
        <p className="text-sm text-ink/65">Features you want to use. Save changes with your profile.</p>
        <div className="flex flex-wrap gap-2">
          {['calendar', 'contacts', 'notifications'].map((item) => (
            <button
              key={item}
              aria-pressed={integrations.includes(item)}
              onClick={() =>
                setIntegrations((current) =>
                  current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
                )
              }
              className={
                integrations.includes(item)
                  ? 'ui-chip-toggle ui-chip-toggle--active'
                  : 'ui-chip-toggle ui-chip-toggle--inactive'
              }
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {
          <AppPanel tone="surface" className="text-sm text-ink/65">
            These preferences do not connect external accounts. Manage external accounts in Connections.
            <Link to="/app/integrations" className="mt-2 block underline">
              Manage connections
            </Link>
          </AppPanel>
        }
      </AppCard>
      <BusinessSettings />
      <PrivacySettings />
    </div>
  )
}

function settingsValidateHandle(handle: string) {
  if (!handle) return null
  if (handle.length < 3) return 'Handle must be at least 3 characters.'
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(handle))
    return 'Only lowercase letters, numbers, underscores, hyphens and dots.'
  return null
}

function ResultCard({
  title,
  items,
}: {
  title: string
  items: Array<{ id: string; label: string; href: string }>
}) {
  return (
    <AppCard className="space-y-4">
      <SectionHeading title={title} />
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
