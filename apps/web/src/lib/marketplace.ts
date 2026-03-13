import type { BusinessProfileRecord, MarketplaceKind, MarketplaceListing, TemplatePayload } from '@superapp/types'
import { supabase } from './supabase'

type MarketplaceRow = {
  id: string
  owner_id: string
  title: string
  summary: string
  kind: MarketplaceKind
  category: string
  price_label: string
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
    .select('id, owner_id, title, summary, kind, category, price_label, whimsical_note, is_published, template_payload')
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
  templatePayload?: TemplatePayload
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase.from('marketplace_listings').insert({
    owner_id: input.ownerId,
    kind: input.kind,
    category: input.category,
    title: input.title,
    summary: input.summary,
    price_label: input.priceLabel,
    whimsical_note: input.whimsicalNote,
    template_payload: input.templatePayload ?? {},
    is_published: true,
  })

  if (error) throw error
}

export async function fetchListingDetail(listingId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('id, owner_id, title, summary, kind, category, price_label, whimsical_note, is_published, created_at, template_payload')
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
    .select('id, owner_id, title, summary, kind, category, price_label, whimsical_note, is_published, created_at, template_payload')
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
  templatePayload?: TemplatePayload
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (typeof input.title === 'string') payload.title = input.title
  if (typeof input.summary === 'string') payload.summary = input.summary
  if (typeof input.category === 'string') payload.category = input.category
  if (typeof input.priceLabel === 'string') payload.price_label = input.priceLabel
  if (typeof input.whimsicalNote === 'string') payload.whimsical_note = input.whimsicalNote
  if (typeof input.isPublished === 'boolean') payload.is_published = input.isPublished
  if (input.templatePayload) payload.template_payload = input.templatePayload

  const { error } = await supabase.from('marketplace_listings').update(payload).eq('id', input.listingId)
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
    whimsical_note: detail.whimsical_note,
    template_payload: detail.template_payload ?? {},
    is_published: false,
  })
  if (error) throw error
}
