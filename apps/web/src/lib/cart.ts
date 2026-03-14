import type { CartItem } from '@superapp/types'
import { supabase } from './supabase'
import { computeCheckoutSummary } from './commerce'

type CartItemRow = {
  id: string
  listing_id: string
  linked_project_id: string | null
  order_id: string | null
  quantity: number
  booking_note: string | null
  booking_date: string | null
  split_with: string[]
  status: 'draft' | 'ordered' | 'removed'
  marketplace_listings:
    | {
        id: string
        owner_id: string | null
        title: string
        kind: 'template' | 'service' | 'product'
        category: string
        price_label: string
        price_cents: number
        currency_code: string
        sku: string | null
        tax_rate_basis_points: number
        workspace_project_id: string | null
      }
    | {
        id: string
        owner_id: string | null
        title: string
        kind: 'template' | 'service' | 'product'
        category: string
        price_label: string
        price_cents: number
        currency_code: string
        sku: string | null
        tax_rate_basis_points: number
        workspace_project_id: string | null
      }[]
    | null
}

type OrderResultRow = {
  order_id: string
  order_number: string
  seller_profile_id: string | null
  total_cents: number
}

export async function fetchCartItems(options?: { status?: CartItem['status'] }) {
  if (!supabase) return []
  let query = supabase
    .from('cart_items')
    .select(
      'id, listing_id, linked_project_id, order_id, quantity, booking_note, booking_date, split_with, status, marketplace_listings(id, owner_id, title, kind, category, price_label, price_cents, currency_code, sku, tax_rate_basis_points, workspace_project_id)',
    )
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data as CartItemRow[]) ?? []).map(mapCartItem)
}

export async function fetchCartCount() {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('cart_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft')
  if (error) throw error
  return count ?? 0
}

export async function addToCart(input: {
  ownerId: string
  listingId: string
  linkedProjectId?: string | null
  bookingDate?: string | null
  bookingNote?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('id, kind')
    .eq('id', input.listingId)
    .single<{ id: string; kind: 'template' | 'service' | 'product' }>()
  if (listingError) throw listingError

  if (listing.kind === 'product') {
    const { data: existingItem, error: existingError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('owner_id', input.ownerId)
      .eq('listing_id', input.listingId)
      .eq('linked_project_id', input.linkedProjectId ?? null)
      .eq('status', 'draft')
      .maybeSingle<{ id: string; quantity: number }>()
    if (existingError) throw existingError

    if (existingItem) {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id)
      if (updateError) throw updateError
      return
    }
  }

  const { error } = await supabase.from('cart_items').insert({
    owner_id: input.ownerId,
    listing_id: input.listingId,
    linked_project_id: input.linkedProjectId ?? null,
    booking_date: input.bookingDate ?? null,
    booking_note: input.bookingNote ?? null,
    quantity: 1,
    status: 'draft',
  })
  if (error) throw error
}

export async function updateCartItem(input: {
  cartItemId: string
  quantity?: number
  linkedProjectId?: string | null
  bookingDate?: string | null
  bookingNote?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (typeof input.quantity === 'number') payload.quantity = Math.max(1, Math.floor(input.quantity))
  if (input.linkedProjectId !== undefined) payload.linked_project_id = input.linkedProjectId
  if (input.bookingDate !== undefined) payload.booking_date = input.bookingDate
  if (input.bookingNote !== undefined) payload.booking_note = input.bookingNote
  const { error } = await supabase.from('cart_items').update(payload).eq('id', input.cartItemId)
  if (error) throw error
}

export async function removeCartItem(cartItemId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('cart_items').update({ status: 'removed' }).eq('id', cartItemId)
  if (error) throw error
}

export async function placeOrderFromCart(input?: { cartItemIds?: string[] }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('place_order_from_cart', {
    cart_item_ids: input?.cartItemIds?.length ? input.cartItemIds : null,
  })
  if (error) throw error
  return (data as OrderResultRow[]) ?? []
}

export function summarizeCart(items: CartItem[]) {
  return computeCheckoutSummary(
    items
      .filter((item) => item.status === 'draft' && item.listing)
      .map((item) => ({
        unitPriceCents: item.listing?.priceCents ?? 0,
        quantity: item.quantity,
        taxRateBasisPoints: item.listing?.taxRateBasisPoints ?? 1000,
      })),
    items[0]?.listing?.currencyCode ?? 'AUD',
  )
}

function mapCartItem(item: CartItemRow): CartItem {
  const listing = Array.isArray(item.marketplace_listings) ? item.marketplace_listings[0] ?? null : item.marketplace_listings
  return {
    id: item.id,
    listingId: item.listing_id,
    linkedProjectId: item.linked_project_id,
    orderId: item.order_id,
    quantity: item.quantity,
    bookingNote: item.booking_note,
    bookingDate: item.booking_date,
    splitWith: item.split_with ?? [],
    status: item.status,
    listing: listing
      ? {
          id: listing.id,
          ownerId: listing.owner_id,
          title: listing.title,
          kind: listing.kind,
          category: listing.category,
          priceLabel: listing.price_label,
          priceCents: listing.price_cents,
          currencyCode: listing.currency_code,
          sku: listing.sku,
          taxRateBasisPoints: listing.tax_rate_basis_points,
          workspaceProjectId: listing.workspace_project_id,
        }
      : null,
  }
}
