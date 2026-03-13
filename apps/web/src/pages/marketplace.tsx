import { createRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppCard, AppButton, AppInput, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { Pill } from '@/components/page-primitives'
import { createMarketplaceListing, fetchMarketplaceListings } from '@/lib/marketplace'
import { useAppStore } from '@/hooks/useAppStore'
import { useState } from 'react'

function TemplateMarketplacePage() {
  const { data } = useQuery({
    queryKey: ['marketplace', 'templates'],
    queryFn: () => fetchMarketplaceListings('template'),
  })
  const listings = data ?? []

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Marketplace" title="Template marketplace" action={<Pill tone="teal">Whimsical helpers</Pill>} />
        <div className="flex flex-wrap gap-3">
          <Link to="/app/marketplace/category/$category" params={{ category: 'moving' }}>
            <AppButton variant="ghost">Home / moving</AppButton>
          </Link>
          <Link to="/app/marketplace/category/$category" params={{ category: 'events' }}>
            <AppButton variant="ghost">Events</AppButton>
          </Link>
          <Link to="/app/marketplace/cart">
            <AppButton variant="secondary">Cart review</AppButton>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <Link key={listing.id} to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
              <AppCard className="bg-cloud">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-berry">{listing.category}</p>
                <h3 className="mt-2 text-xl font-extrabold text-ink">{listing.title}</h3>
                <p className="mt-2 text-sm text-ink/70">{listing.summary}</p>
                <p className="mt-3 text-sm font-bold text-teal">{listing.priceLabel}</p>
                <p className="mt-2 text-xs text-ink/55">{listing.whimsicalNote}</p>
              </AppCard>
            </Link>
          ))}
        </div>
        {!listings.length ? (
          <AppPanel className="text-sm text-ink/65">
            No templates are published yet. Create one from the business listings area and it will appear here.
          </AppPanel>
        ) : null}
      </AppCard>
    </div>
  )
}

function ServicesMarketplacePage() {
  const { session, profile } = useAppStore()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [summary, setSummary] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const { data } = useQuery({
    queryKey: ['marketplace', 'services'],
    queryFn: async () => {
      const serviceData = await fetchMarketplaceListings('service')
      const productData = await fetchMarketplaceListings('product')
      return [...serviceData, ...productData]
    },
  })
  const listings = data ?? []
  const mutation = useMutation({
    mutationFn: () =>
      createMarketplaceListing({
        ownerId: session!.user.id,
        kind: profile?.active_mode === 'business' ? 'service' : 'product',
        category,
        title,
        summary,
        priceLabel,
        whimsicalNote: 'Freshly published from your business nook.',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'services'] })
      setTitle('')
      setSummary('')
      setPriceLabel('')
    },
  })

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Marketplace" title="Products and services" action={<Link to="/app/marketplace/templates"><AppButton variant="ghost">Templates</AppButton></Link>} />
        <div className="flex flex-wrap gap-3">
          <Link to="/app/marketplace/category/$category" params={{ category: 'services' }}>
            <AppButton variant="ghost">Services</AppButton>
          </Link>
          <Link to="/app/marketplace/category/$category" params={{ category: 'products' }}>
            <AppButton variant="ghost">Products</AppButton>
          </Link>
          <Link to="/app/marketplace/cart">
            <AppButton variant="secondary">Cart review</AppButton>
          </Link>
        </div>
        {profile?.active_mode === 'business' ? (
          <AppPanel tone="butter" className="grid gap-3 md:grid-cols-2">
            <AppInput value={title} onChange={(event) => setTitle(event.target.value)} className="bg-white" placeholder="Listing title" />
            <AppInput value={category} onChange={(event) => setCategory(event.target.value)} className="bg-white" placeholder="Category" />
            <AppInput value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} className="bg-white" placeholder="Price label" />
            <AppInput value={summary} onChange={(event) => setSummary(event.target.value)} className="bg-white" placeholder="Summary" />
            <div className="md:col-span-2">
              <div className="flex flex-wrap gap-3">
                <AppButton onClick={() => mutation.mutate()} disabled={mutation.isPending || !session}>
                  Publish listing
                </AppButton>
                <Link to="/app/business/listings">
                  <AppButton variant="ghost">Manage listings</AppButton>
                </Link>
              </div>
            </div>
          </AppPanel>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <Link key={listing.id} to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
              <AppCard className="bg-cloud">
                <div className="flex items-center justify-between gap-3">
                  <Pill tone="peach">{listing.kind}</Pill>
                  <p className="text-sm font-bold text-teal">{listing.priceLabel}</p>
                </div>
                <h3 className="mt-3 text-xl font-extrabold text-ink">{listing.title}</h3>
                <p className="mt-2 text-sm text-ink/70">{listing.summary}</p>
                <p className="mt-3 text-xs text-ink/55">{listing.whimsicalNote}</p>
              </AppCard>
            </Link>
          ))}
        </div>
        {!listings.length ? (
          <AppPanel className="text-sm text-ink/65">
            No services or products are live yet. Published offers will appear here automatically.
          </AppPanel>
        ) : null}
      </AppCard>
    </div>
  )
}

export const templateMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/templates',
  component: TemplateMarketplacePage,
})

export const servicesMarketplaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/services',
  component: ServicesMarketplacePage,
})
