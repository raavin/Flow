import type { BusinessProfileRecord, MarketplaceKind, MarketplaceListing, TemplatePayload } from '@superapp/types'
import { supabase } from './supabase'
import { buildListingSku, parsePriceLabelToCents } from './commerce'
import { setProjectKind } from './projects'

type MarketplaceRow = {
  id: string
  owner_id: string
  title: string
  summary: string
  kind: MarketplaceKind
  category: string
  price_label: string
  price_cents: number
  currency_code: string
  sku: string | null
  tax_rate_basis_points: number
  workspace_project_id: string | null
  fulfillment_notes: string
  whimsical_note: string
  is_published: boolean
  template_payload?: TemplatePayload
}

type PublicBusinessProfile = Pick<
  BusinessProfileRecord,
  'id' | 'business_name' | 'category' | 'service_area' | 'offerings' | 'booking_model' | 'availability_notes' | 'visibility_mode'
>

export async function fetchMarketplaceListings(kind: MarketplaceKind): Promise<MarketplaceListing[]> {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, title, summary, kind, category, price_label, price_cents, currency_code, sku, tax_rate_basis_points, workspace_project_id, fulfillment_notes, whimsical_note, is_published, template_payload',
    )
    .eq('kind', kind)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as MarketplaceRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    category: row.category,
    priceLabel: row.price_label,
    priceCents: row.price_cents,
    currencyCode: row.currency_code,
    sku: row.sku,
    taxRateBasisPoints: row.tax_rate_basis_points,
    workspaceProjectId: row.workspace_project_id,
    fulfillmentNotes: row.fulfillment_notes,
    whimsicalNote: row.whimsical_note,
    ownerId: row.owner_id,
    isPublished: row.is_published,
    templatePayload: row.template_payload,
  }))
}

export async function createMarketplaceListing(input: {
  ownerId: string
  kind: MarketplaceKind
  category: string
  title: string
  summary: string
  priceLabel: string
  whimsicalNote: string
  workspaceProjectId?: string | null
  currencyCode?: string
  sku?: string | null
  taxRateBasisPoints?: number
  fulfillmentNotes?: string
  templatePayload?: TemplatePayload
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const priceCents = parsePriceLabelToCents(input.priceLabel)
  const sku = input.sku ?? buildListingSku({ title: input.title, kind: input.kind })
  const { error } = await supabase.from('marketplace_listings').insert({
    owner_id: input.ownerId,
    kind: input.kind,
    category: input.category,
    title: input.title,
    summary: input.summary,
    price_label: input.priceLabel,
    price_cents: priceCents,
    currency_code: input.currencyCode ?? 'AUD',
    sku,
    tax_rate_basis_points: input.taxRateBasisPoints ?? 1000,
    workspace_project_id: input.workspaceProjectId ?? null,
    fulfillment_notes: input.fulfillmentNotes ?? '',
    whimsical_note: input.whimsicalNote,
    template_payload: input.templatePayload ?? {},
    is_published: true,
  })

  if (error) throw error

  if (input.workspaceProjectId) {
    await setProjectKind(input.workspaceProjectId, toWorkspaceProjectKind(input.kind))
  }
}

export async function fetchListingDetail(listingId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, title, summary, kind, category, price_label, price_cents, currency_code, sku, tax_rate_basis_points, workspace_project_id, fulfillment_notes, whimsical_note, is_published, created_at, template_payload',
    )
    .eq('id', listingId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPublicBusinessProfile(ownerId: string): Promise<PublicBusinessProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id, business_name, category, service_area, offerings, booking_model, availability_notes, visibility_mode')
    .eq('id', ownerId)
    .maybeSingle<PublicBusinessProfile>()
  if (error) throw error
  return data
}

export async function fetchBusinessListings(ownerId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, title, summary, kind, category, price_label, price_cents, currency_code, sku, tax_rate_basis_points, workspace_project_id, fulfillment_notes, whimsical_note, is_published, created_at, template_payload',
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateListing(input: {
  listingId: string
  title?: string
  summary?: string
  category?: string
  priceLabel?: string
  whimsicalNote?: string
  isPublished?: boolean
  workspaceProjectId?: string | null
  currencyCode?: string
  sku?: string | null
  taxRateBasisPoints?: number
  fulfillmentNotes?: string
  kind?: MarketplaceKind
  templatePayload?: TemplatePayload
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (typeof input.title === 'string') payload.title = input.title
  if (typeof input.summary === 'string') payload.summary = input.summary
  if (typeof input.category === 'string') payload.category = input.category
  if (typeof input.priceLabel === 'string') {
    payload.price_label = input.priceLabel
    payload.price_cents = parsePriceLabelToCents(input.priceLabel)
  }
  if (typeof input.whimsicalNote === 'string') payload.whimsical_note = input.whimsicalNote
  if (typeof input.isPublished === 'boolean') payload.is_published = input.isPublished
  if (input.workspaceProjectId !== undefined) payload.workspace_project_id = input.workspaceProjectId
  if (typeof input.currencyCode === 'string') payload.currency_code = input.currencyCode
  if (input.sku !== undefined) payload.sku = input.sku
  if (typeof input.taxRateBasisPoints === 'number') payload.tax_rate_basis_points = input.taxRateBasisPoints
  if (typeof input.fulfillmentNotes === 'string') payload.fulfillment_notes = input.fulfillmentNotes
  if (input.templatePayload) payload.template_payload = input.templatePayload

  const { error } = await supabase.from('marketplace_listings').update(payload).eq('id', input.listingId)
  if (error) throw error

  if (input.workspaceProjectId && input.kind) {
    await setProjectKind(input.workspaceProjectId, toWorkspaceProjectKind(input.kind))
  }
}

export async function duplicateListing(listingId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const detail = await fetchListingDetail(listingId)
  if (!detail) throw new Error('Listing not found.')
  const { error } = await supabase.from('marketplace_listings').insert({
    owner_id: detail.owner_id,
    kind: detail.kind,
    category: detail.category,
    title: `${detail.title} Copy`,
    summary: detail.summary,
    price_label: detail.price_label,
    price_cents: detail.price_cents ?? parsePriceLabelToCents(detail.price_label),
    currency_code: detail.currency_code ?? 'AUD',
    sku: detail.sku ? `${detail.sku}-COPY` : buildListingSku({ title: `${detail.title} Copy`, kind: detail.kind }),
    tax_rate_basis_points: detail.tax_rate_basis_points ?? 1000,
    workspace_project_id: detail.workspace_project_id ?? null,
    fulfillment_notes: detail.fulfillment_notes ?? '',
    whimsical_note: detail.whimsical_note,
    template_payload: detail.template_payload ?? {},
    is_published: false,
  })
  if (error) throw error
}

function toWorkspaceProjectKind(kind: MarketplaceKind) {
  if (kind === 'template') return 'template_workspace' as const
  if (kind === 'service') return 'service_workspace' as const
  return 'product_workspace' as const
}
