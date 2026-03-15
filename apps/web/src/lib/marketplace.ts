import type { BrowseListing, BusinessProfileRecord, ListingImage, MarketplaceKind, MarketplaceListing, SellerPublicProfile, TemplatePayload } from '@superapp/types'
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

export type ListingDetail = {
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
  created_at: string
  template_payload: TemplatePayload | null
  // Extended fields from migration
  cover_image_path: string | null
  location_label: string
  description: string
  return_policy: string
  fulfillment_days_min: number | null
  fulfillment_days_max: number | null
  review_count: number
  rating_sum: number
}

export async function fetchListingDetail(listingId: string): Promise<ListingDetail | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      `id, owner_id, title, summary, kind, category, price_label, price_cents, currency_code, sku,
       tax_rate_basis_points, workspace_project_id, fulfillment_notes, whimsical_note, is_published,
       created_at, template_payload, cover_image_path, location_label, description, return_policy,
       fulfillment_days_min, fulfillment_days_max, review_count, rating_sum`,
    )
    .eq('id', listingId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    owner_id: r.owner_id as string,
    title: r.title as string,
    summary: (r.summary as string) ?? '',
    kind: r.kind as MarketplaceKind,
    category: (r.category as string) ?? '',
    price_label: (r.price_label as string) ?? '',
    price_cents: (r.price_cents as number) ?? 0,
    currency_code: (r.currency_code as string) ?? 'AUD',
    sku: r.sku as string | null,
    tax_rate_basis_points: (r.tax_rate_basis_points as number) ?? 1000,
    workspace_project_id: r.workspace_project_id as string | null,
    fulfillment_notes: (r.fulfillment_notes as string) ?? '',
    whimsical_note: (r.whimsical_note as string) ?? '',
    is_published: r.is_published as boolean,
    created_at: r.created_at as string,
    template_payload: r.template_payload as TemplatePayload | null,
    cover_image_path: r.cover_image_path as string | null,
    location_label: (r.location_label as string) ?? '',
    description: (r.description as string) ?? '',
    return_policy: (r.return_policy as string) ?? '',
    fulfillment_days_min: r.fulfillment_days_min as number | null,
    fulfillment_days_max: r.fulfillment_days_max as number | null,
    review_count: (r.review_count as number) ?? 0,
    rating_sum: (r.rating_sum as number) ?? 0,
  }
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

export async function deleteMarketplaceListing(listingId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('marketplace_listings').delete().eq('id', listingId)
  if (error) throw error
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

export async function fetchMarketplaceListingsBrowse(filters: {
  kind?: MarketplaceKind
  category?: string
  sort?: 'newest' | 'rating' | 'price_asc' | 'price_desc'
} = {}): Promise<BrowseListing[]> {
  if (!supabase) return []

  // Select base columns — avoid joining to business_profiles (no direct FK from owner_id).
  // Seller names are fetched via a separate business_profiles query below.
  let query = supabase
    .from('marketplace_listings')
    .select(
      `id, owner_id, title, kind, category, price_label, price_cents, currency_code,
       cover_image_path, location_label, review_count, rating_sum, is_published`,
    )
    .eq('is_published', true)

  if (filters.kind) query = query.eq('kind', filters.kind)
  if (filters.category) query = query.eq('category', filters.category)

  if (filters.sort === 'price_asc') query = query.order('price_cents', { ascending: true })
  else if (filters.sort === 'price_desc') query = query.order('price_cents', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return []

  // Fetch business names for all owner IDs in one round-trip
  const ownerIds = [...new Set(data.map((r) => r.owner_id as string).filter(Boolean))]
  const { data: bpData } = ownerIds.length
    ? await supabase.from('business_profiles').select('id, business_name').in('id', ownerIds)
    : { data: [] as { id: string; business_name: string }[] }
  const bpMap = new Map((bpData ?? []).map((bp) => [bp.id, bp.business_name]))

  return (data as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      title: r.title as string,
      kind: r.kind as MarketplaceKind,
      category: r.category as string,
      priceCents: (r.price_cents as number) ?? 0,
      priceLabel: r.price_label as string,
      currencyCode: (r.currency_code as string) ?? 'AUD',
      coverImagePath: (r.cover_image_path as string | null) ?? null,
      locationLabel: (r.location_label as string | null) ?? '',
      reviewCount: (r.review_count as number) ?? 0,
      ratingSum: (r.rating_sum as number) ?? 0,
      sellerId: r.owner_id as string,
      sellerName: bpMap.get(r.owner_id as string) ?? 'Flow seller',
      isPublished: r.is_published as boolean,
    }
  })
}

export async function fetchListingImages(listingId: string): Promise<ListingImage[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('listing_images')
    .select('id, listing_id, storage_path, alt_text, sort_order, created_at')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      listingId: row.listing_id as string,
      storagePath: row.storage_path as string,
      altText: (row.alt_text as string) ?? '',
      sortOrder: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as string,
    }
  })
}

export async function fetchMoreFromSeller(sellerId: string, excludeListingId: string, limit = 4): Promise<BrowseListing[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, title, kind, category, price_label, price_cents, currency_code, cover_image_path, location_label, review_count, rating_sum, is_published',
    )
    .eq('owner_id', sellerId)
    .eq('is_published', true)
    .neq('id', excludeListingId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      title: row.title as string,
      kind: row.kind as MarketplaceKind,
      category: row.category as string,
      priceCents: (row.price_cents as number) ?? 0,
      priceLabel: row.price_label as string,
      currencyCode: (row.currency_code as string) ?? 'AUD',
      coverImagePath: (row.cover_image_path as string | null) ?? null,
      locationLabel: (row.location_label as string) ?? '',
      reviewCount: (row.review_count as number) ?? 0,
      ratingSum: (row.rating_sum as number) ?? 0,
      sellerId: row.owner_id as string,
      sellerName: 'Flow seller',
      isPublished: row.is_published as boolean,
    }
  })
}

export async function uploadListingImage(
  listingId: string,
  file: File,
  sortOrder: number,
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${listingId}/${Date.now()}-${sortOrder}.${ext}`
  const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file, { upsert: false })
  if (uploadError) throw uploadError

  const { error: insertError } = await supabase.from('listing_images').insert({
    listing_id: listingId,
    storage_path: path,
    alt_text: file.name.replace(/\.[^.]+$/, ''),
    sort_order: sortOrder,
  })
  if (insertError) throw insertError

  // Update cover_image_path if this is the first image
  if (sortOrder === 0) {
    await supabase.from('marketplace_listings').update({ cover_image_path: path }).eq('id', listingId)
  }

  return path
}

export async function deleteListingImage(imageId: string, storagePath: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.storage.from('listing-images').remove([storagePath])
  const { error } = await supabase.from('listing_images').delete().eq('id', imageId)
  if (error) throw error
}

export function getListingImageUrl(storagePath: string): string {
  if (!supabase) return ''
  const { data } = supabase.storage.from('listing-images').getPublicUrl(storagePath)
  return data.publicUrl
}

export async function fetchSellerPublicProfile(sellerId: string): Promise<SellerPublicProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('business_profiles')
    .select(
      'id, business_name, category, service_area, offerings, booking_model, availability_notes, total_sales, total_review_count, total_rating_sum, member_since, logo_path',
    )
    .eq('id', sellerId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    businessName: (r.business_name as string) ?? '',
    category: (r.category as string) ?? '',
    serviceArea: (r.service_area as string) ?? '',
    offerings: (r.offerings as string[]) ?? [],
    bookingModel: (r.booking_model as string) ?? '',
    availabilityNotes: (r.availability_notes as string) ?? '',
    totalSales: (r.total_sales as number) ?? 0,
    totalReviewCount: (r.total_review_count as number) ?? 0,
    totalRatingSum: (r.total_rating_sum as number) ?? 0,
    memberSince: (r.member_since as string | null) ?? null,
    logoPath: (r.logo_path as string | null) ?? null,
  }
}

export async function updateListingContent(input: {
  listingId: string
  description?: string
  returnPolicy?: string
  locationLabel?: string
  fulfillmentDaysMin?: number | null
  fulfillmentDaysMax?: number | null
}): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const payload: Record<string, unknown> = {}
  if (typeof input.description === 'string') payload.description = input.description
  if (typeof input.returnPolicy === 'string') payload.return_policy = input.returnPolicy
  if (typeof input.locationLabel === 'string') payload.location_label = input.locationLabel
  if (input.fulfillmentDaysMin !== undefined) payload.fulfillment_days_min = input.fulfillmentDaysMin
  if (input.fulfillmentDaysMax !== undefined) payload.fulfillment_days_max = input.fulfillmentDaysMax
  const { error } = await supabase.from('marketplace_listings').update(payload).eq('id', input.listingId)
  if (error) throw error
}

function toWorkspaceProjectKind(kind: MarketplaceKind) {
  if (kind === 'template') return 'template_workspace' as const
  if (kind === 'service') return 'service_workspace' as const
  return 'product_workspace' as const
}
