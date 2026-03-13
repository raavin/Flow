import { supabase } from './supabase'
import { createActivity, createNotification } from './coordination'
import { createExpense } from './planning'

export async function fetchCartItems() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, listing_id, linked_project_id, quantity, booking_note, booking_date, split_with, status, marketplace_listings(title, kind, price_label)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addToCart(input: {
  ownerId: string
  listingId: string
  linkedProjectId?: string | null
  bookingDate?: string | null
  bookingNote?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('cart_items').insert({
    owner_id: input.ownerId,
    listing_id: input.listingId,
    linked_project_id: input.linkedProjectId ?? null,
    booking_date: input.bookingDate ?? null,
    booking_note: input.bookingNote ?? null,
  })
  if (error) throw error
}

export async function confirmCartItem(input: {
  cartItemId: string
  ownerId: string
  linkedProjectId?: string | null
  title: string
  priceLabel: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('cart_items').update({ status: 'confirmed' }).eq('id', input.cartItemId)
  if (error) throw error

  if (input.linkedProjectId) {
    const amount = parsePrice(input.priceLabel)
    await createExpense({
      ownerId: input.ownerId,
      projectId: input.linkedProjectId,
      category: 'services',
      title: input.title,
      estimateCents: amount,
      actualCents: amount,
      paymentStatus: 'pending',
    })
    await createActivity({
      ownerId: input.ownerId,
      projectId: input.linkedProjectId,
      activityType: 'booking_confirmed',
      title: 'Booking confirmed',
      detail: `${input.title} added from marketplace review.`,
    })
  }

  await createNotification({
    profileId: input.ownerId,
    title: 'Cart item confirmed',
    body: input.title,
    kind: 'bookings',
  })
}

function parsePrice(priceLabel: string) {
  const match = priceLabel.match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  return Math.round(Number(match[1]) * 100)
}
