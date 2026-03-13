import { useEffect, useMemo, useState } from 'react'
import { Link, createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { addToCart, confirmCartItem, fetchCartItems } from '@/lib/cart'
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
    },
  })

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Browse" title={`Category: ${category}`} />
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
              <AppButton onClick={() => addMutation.mutate(listing.id)} disabled={!session}>
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
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: fetchCartItems })
  const [bookingNote, setBookingNote] = useState('')
  const [splitWith, setSplitWith] = useState('')
  const confirmMutation = useMutation({
    mutationFn: (item: {
      id: string
      linked_project_id: string | null
      marketplace_listings: { title: string; price_label: string }[] | { title: string; price_label: string } | null
    }) => {
      const listing = Array.isArray(item.marketplace_listings)
        ? item.marketplace_listings[0]
        : item.marketplace_listings
      return confirmCartItem({
        cartItemId: item.id,
        ownerId: session!.user.id,
        linkedProjectId: item.linked_project_id,
        title: listing?.title ?? 'Marketplace item',
        priceLabel: listing?.price_label ?? '$0',
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const total = useMemo(() => {
    return (cartQuery.data ?? []).reduce((sum, item) => {
      const listing = Array.isArray(item.marketplace_listings) ? item.marketplace_listings[0] : item.marketplace_listings
      const raw = listing?.price_label ?? '$0'
      const match = raw.match(/(\d+(?:\.\d+)?)/)
      return sum + (match ? Number(match[1]) : 0)
    }, 0)
  }, [cartQuery.data])

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Review" title="Cart and booking review" />
        <div className="grid gap-3">
          {(cartQuery.data ?? []).map((item) => {
            const listing = Array.isArray(item.marketplace_listings) ? item.marketplace_listings[0] : item.marketplace_listings
            return (
              <AppPanel key={item.id}>
                <p className="font-extrabold text-ink">{listing?.title ?? 'Listing'}</p>
                <p className="text-sm text-ink/65">
                  {listing?.price_label ?? '$0'} · {item.linked_project_id ? 'linked to project' : 'not linked'}
                </p>
                <p className="mt-1 text-xs text-ink/55">{item.booking_note || bookingNote}</p>
                <p className="mt-1 text-xs text-ink/55">Split with: {item.split_with?.join(', ') || splitWith}</p>
                <div className="mt-3 flex gap-2">
                  <AppButton variant="secondary" onClick={() => confirmMutation.mutate(item)} disabled={item.status === 'confirmed'}>
                    {item.status === 'confirmed' ? 'Confirmed' : 'Confirm'}
                  </AppButton>
                </div>
              </AppPanel>
            )
          })}
          {!cartQuery.data?.length ? <p className="text-sm text-ink/60">Your selected services and products will appear here before confirmation.</p> : null}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Summary" title="Checkout snapshot" />
        <AppInput value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Notes to provider" />
        <AppInput value={splitWith} onChange={(event) => setSplitWith(event.target.value)} placeholder="Who is splitting this?" />
        <AppPanel tone="butter">
          <p className="text-xs font-bold uppercase text-ink/50">Total cost</p>
          <p className="text-2xl font-extrabold text-ink">${total.toFixed(2)}</p>
        </AppPanel>
        <p className="text-sm text-ink/70">
          Confirmed cart items automatically create budget entries and activity updates for linked projects.
        </p>
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
        <ResultCard title="Projects" items={(searchQuery.data?.projects ?? []).map((item) => item.title)} />
        <ResultCard title="Listings" items={(searchQuery.data?.listings ?? []).map((item) => item.title)} />
        <ResultCard title="Messages" items={(searchQuery.data?.messages ?? []).map((item) => item.title)} />
        <ResultCard title="Jobs" items={(searchQuery.data?.jobs ?? []).map((item) => item.title)} />
        <ResultCard title="Support" items={(searchQuery.data?.support ?? []).map((item) => item.title)} />
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
    mutationFn: () =>
      updateProfileSettings({
        userId: session!.user.id,
        firstName,
        lastName,
        location,
        timeZone,
        integrations,
        bio,
      }),
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
        <AppInput value={handle} readOnly className="bg-cloud/80 text-ink/55" placeholder="@handle" />
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

function ResultCard({ title, items }: { title: string; items: string[] }) {
  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Results" title={title} />
      <div className="grid gap-2">
        {items.map((item) => (
          <AppPanel key={item} className="rounded-control p-3 text-sm">
            {item}
          </AppPanel>
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
