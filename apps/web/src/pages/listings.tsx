import { useState } from 'react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import type { TemplatePayload } from '@superapp/types'
import { appRoute } from '@/components/layout'
import { createProjectFromTemplate, fetchProjects, attachListingToProject } from '@/lib/projects'
import {
  createMarketplaceListing,
  duplicateListing,
  fetchBusinessListings,
  fetchPublicBusinessProfile,
  fetchListingDetail,
  updateListing,
} from '@/lib/marketplace'
import { useAppStore } from '@/hooks/useAppStore'
import { addToCart } from '@/lib/cart'

function ListingDetailPage() {
  const { listingId } = listingDetailRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const listingQuery = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => fetchListingDetail(listingId),
  })
  const providerQuery = useQuery({
    queryKey: ['business-profile', listingQuery.data?.owner_id],
    queryFn: () => fetchPublicBusinessProfile(listingQuery.data!.owner_id),
    enabled: Boolean(listingQuery.data?.owner_id),
  })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [projectId, setProjectId] = useState('')
  const addToCartMutation = useMutation({
    mutationFn: () =>
      addToCart({
        ownerId: session!.user.id,
        listingId,
        linkedProjectId: projectId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
  const attachMutation = useMutation({
    mutationFn: () => attachListingToProject(projectId, listingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
    },
  })
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!session || !listingQuery.data?.template_payload) throw new Error('Template is missing its plan payload.')
      const project = await createProjectFromTemplate({
        ownerId: session.user.id,
        title: listingQuery.data.title,
        category: listingQuery.data.category,
        startDate: new Date().toISOString().slice(0, 10),
        templatePayload: listingQuery.data.template_payload,
      })
      return project
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void navigate({ to: '/app/projects/$projectId', params: { projectId: project.id } })
    },
  })

  const listing = listingQuery.data
  if (!listing) return <AppCard>Loading listing...</AppCard>

  const provider = providerQuery.data
  const milestoneCount = listing.template_payload?.milestones?.length ?? 0
  const taskCount = listing.template_payload?.tasks?.length ?? 0

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow={listing.kind} title={listing.title} />
        <p className="text-sm text-ink/65">
          {listing.category} · {listing.price_label}
        </p>
        <div className="grid gap-3 rounded-[28px] bg-sprinkles p-6 md:grid-cols-3">
          <div className="rounded-[24px] bg-white/85 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-berry/70">Kind</p>
            <p className="mt-2 text-lg font-extrabold text-ink capitalize">{listing.kind}</p>
          </div>
          <div className="rounded-[24px] bg-white/85 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-berry/70">Price</p>
            <p className="mt-2 text-lg font-extrabold text-ink">{listing.price_label}</p>
          </div>
          <div className="rounded-[24px] bg-white/85 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-berry/70">Includes</p>
            <p className="mt-2 text-lg font-extrabold text-ink">
              {listing.kind === 'template' ? `${milestoneCount} milestones · ${taskCount} tasks` : provider?.business_name ?? 'Marketplace listing'}
            </p>
          </div>
        </div>
        <p className="text-sm text-ink/75">{listing.summary}</p>
        <AppPanel tone="butter" className="text-sm">
          {listing.whimsical_note}
        </AppPanel>
        {listing.kind === 'template' && listing.template_payload ? (
          <AppPanel>
            <p className="text-sm font-extrabold text-ink">Included milestones</p>
            <ul className="mt-2 space-y-2 text-sm text-ink/70">
              {(
                listing.template_payload.milestones as Array<{
                  title: string
                  durationDays: number
                  offsetDays: number
                  lane: string
                }> | undefined
              )?.map((milestone) => (
                <li key={milestone.title}>
                  {milestone.title} · starts day {milestone.offsetDays + 1} · {milestone.durationDays} day · {milestone.lane}
                </li>
              )) ?? null}
            </ul>
            <p className="mt-4 text-sm font-extrabold text-ink">Included tasks</p>
            <ul className="mt-2 space-y-2 text-sm text-ink/70">
              {(
                listing.template_payload.tasks as Array<{
                  title: string
                }> | undefined
              )?.map((task) => (
                <li key={task.title}>{task.title}</li>
              )) ?? null}
            </ul>
          </AppPanel>
        ) : null}
        {provider ? (
          <AppPanel className="text-sm text-ink/70">
            <p className="font-extrabold text-ink">{provider.business_name}</p>
            <p>
              {provider.category} · {provider.service_area}
            </p>
            <p className="mt-2">Offerings: {provider.offerings.join(', ') || 'No offerings listed yet.'}</p>
          </AppPanel>
        ) : null}
        {listing.owner_id ? (
          <Link to="/app/business/$ownerId" params={{ ownerId: listing.owner_id }} className="inline-flex text-sm font-bold text-teal">
            View business profile
          </Link>
        ) : null}
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Actions" title="Use this listing" />
        <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Select a project to attach</option>
          {(projectsQuery.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </AppSelect>
        <AppButton disabled={!session || !projectId || attachMutation.isPending} onClick={() => attachMutation.mutate()}>
          Attach to project
        </AppButton>
        {listing.kind === 'template' ? (
          <AppButton variant="secondary" disabled={!session || importMutation.isPending} onClick={() => importMutation.mutate()}>
            Import template
          </AppButton>
        ) : null}
        <AppButton variant="secondary" disabled={!session} onClick={() => addToCartMutation.mutate()}>
          Book / add to cart
        </AppButton>
        {listing.kind === 'template' ? (
          <p className="text-xs text-ink/60">Imported templates create real milestones and tasks in your project timeline.</p>
        ) : (
          <p className="text-xs text-ink/60">Bookings stay connected to project budget, calendar, and activity once attached or confirmed.</p>
        )}
      </AppCard>
    </div>
  )
}

function BusinessProfilePage() {
  const { ownerId } = businessProfileRoute.useParams()
  const profileQuery = useQuery({
    queryKey: ['business-profile', ownerId],
    queryFn: () => fetchPublicBusinessProfile(ownerId),
  })
  const listingsQuery = useQuery({
    queryKey: ['business-listings', ownerId],
    queryFn: () => fetchBusinessListings(ownerId),
  })
  const profile = profileQuery.data

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Business" title={profile?.business_name ?? 'Provider profile'} />
        <p className="text-sm text-ink/65">
          {profile ? `${profile.category} serving ${profile.service_area}` : 'Loading business details...'}
        </p>
        {profile ? (
          <div className="grid gap-3 md:grid-cols-3">
            <AppPanel className="text-sm">
              <p className="font-extrabold text-ink">Offerings</p>
              <p className="mt-2 text-ink/70">{profile.offerings.join(', ') || 'No offerings listed yet.'}</p>
            </AppPanel>
            <AppPanel className="text-sm">
              <p className="font-extrabold text-ink">Booking model</p>
              <p className="mt-2 text-ink/70">{profile.booking_model}</p>
            </AppPanel>
            <AppPanel className="text-sm">
              <p className="font-extrabold text-ink">Visibility</p>
              <p className="mt-2 text-ink/70">{profile.visibility_mode}</p>
            </AppPanel>
          </div>
        ) : null}
      </AppCard>
      <div className="grid gap-4 md:grid-cols-2">
        {(listingsQuery.data ?? []).map((listing) => (
          <Link key={listing.id} to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
            <AppCard className="h-full bg-cloud">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-berry">{listing.kind}</p>
              <h3 className="mt-2 text-xl font-extrabold text-ink">{listing.title}</h3>
              <p className="mt-2 text-sm text-ink/70">{listing.summary}</p>
              <p className="mt-3 text-sm font-bold text-teal">{listing.price_label}</p>
            </AppCard>
          </Link>
        ))}
      </div>
      {!(listingsQuery.data ?? []).length ? (
        <AppCard className="text-sm text-ink/65">This business has not published any listings yet.</AppCard>
      ) : null}
    </div>
  )
}

function ListingsManagementPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const ownerId = session?.user.id ?? ''
  const listingsQuery = useQuery({
    queryKey: ['business-listings', ownerId],
    queryFn: () => fetchBusinessListings(ownerId),
    enabled: Boolean(ownerId),
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<'template' | 'service' | 'product'>('service')
  const [newCategory, setNewCategory] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newPriceLabel, setNewPriceLabel] = useState('')
  const [newTemplatePayload, setNewTemplatePayload] = useState(JSON.stringify(defaultTemplatePayload, null, 2))
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const [editingKind, setEditingKind] = useState<'template' | 'service' | 'product'>('service')
  const [templatePayloadText, setTemplatePayloadText] = useState(JSON.stringify(defaultTemplatePayload, null, 2))
  const createMutation = useMutation({
    mutationFn: () =>
      createMarketplaceListing({
        ownerId,
        kind,
        category: newCategory,
        title: newTitle,
        summary: newSummary,
        priceLabel: newPriceLabel,
        whimsicalNote: 'Crafted from your business dashboard.',
        templatePayload: kind === 'template' ? parseTemplatePayload(newTemplatePayload) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      updateListing({
        listingId: editingId!,
        title,
        summary,
        priceLabel,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
    },
  })
  const duplicateMutation = useMutation({
    mutationFn: (listingId: string) => duplicateListing(listingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-listings', ownerId] })
    },
  })

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Business" title="Listings management" />
        <p className="text-sm text-ink/65">Pause, duplicate, and lightly edit services, products, and templates from one board.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <AppSelect value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="service">Service</option>
            <option value="product">Product</option>
            <option value="template">Template</option>
          </AppSelect>
          <AppInput value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Category" />
          <AppInput value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Title" />
          <AppInput value={newPriceLabel} onChange={(event) => setNewPriceLabel(event.target.value)} placeholder="Price" />
          <AppTextarea value={newSummary} onChange={(event) => setNewSummary(event.target.value)} className="min-h-24 md:col-span-2" placeholder="Summary" />
          {kind === 'template' ? (
            <AppTextarea
              value={newTemplatePayload}
              onChange={(event) => setNewTemplatePayload(event.target.value)}
              className="min-h-48 font-mono text-sm md:col-span-2"
              aria-label="Template JSON"
            />
          ) : null}
          <div className="md:col-span-2">
            <AppButton onClick={() => createMutation.mutate()} disabled={!ownerId || createMutation.isPending}>
              Create listing
            </AppButton>
          </div>
        </div>
      </AppCard>

      {editingId ? (
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Edit" title="Update listing" />
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <AppInput value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} placeholder="Price label" />
          <AppTextarea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-28" placeholder="Summary" />
          {editingKind === 'template' ? (
            <AppTextarea
              value={templatePayloadText}
              onChange={(event) => setTemplatePayloadText(event.target.value)}
              className="min-h-48 w-full font-mono text-sm"
              aria-label="Edit template JSON"
            />
          ) : null}
          <div className="flex gap-3">
            <AppButton onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save
            </AppButton>
            <AppButton variant="ghost" onClick={() => setEditingId(null)}>
              Cancel
            </AppButton>
          </div>
        </AppCard>
      ) : null}

      <div className="grid gap-3">
        {(listingsQuery.data ?? []).map((listing) => (
          <AppCard key={listing.id} className="bg-cloud">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold text-ink">{listing.title}</p>
                <p className="text-sm text-ink/65">
                  {listing.kind} · {listing.category} · {listing.price_label}
                </p>
              </div>
              <AppPill tone={listing.is_published ? 'butter' : 'default'} className="py-1">
                {listing.is_published ? 'Active' : 'Inactive'}
              </AppPill>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AppButton
                variant="ghost"
                onClick={() => {
                  setEditingId(listing.id)
                  setEditingKind(listing.kind)
                  setTitle(listing.title)
                  setSummary(listing.summary)
                  setPriceLabel(listing.price_label)
                  setTemplatePayloadText(JSON.stringify(listing.template_payload ?? defaultTemplatePayload, null, 2))
                }}
              >
                Edit
              </AppButton>
              <AppButton variant="ghost" onClick={() => toggleMutation.mutate({ listingId: listing.id, isPublished: !listing.is_published })}>
                {listing.is_published ? 'Pause' : 'Publish'}
              </AppButton>
              <AppButton variant="secondary" onClick={() => duplicateMutation.mutate(listing.id)}>
                Duplicate
              </AppButton>
              <Link to="/app/marketplace/listings/$listingId" params={{ listingId: listing.id }}>
                <AppButton variant="ghost">Open</AppButton>
              </Link>
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  )
}

export const listingDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/listings/$listingId',
  component: ListingDetailPage,
})

export const businessProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/$ownerId',
  component: BusinessProfilePage,
})

export const listingsManagementRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'business/listings',
  component: ListingsManagementPage,
})

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
