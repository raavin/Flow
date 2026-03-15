import type { ListingReview } from '@superapp/types'
import { supabase } from './supabase'

type ReviewRow = {
  id: string
  listing_id: string
  order_id: string | null
  reviewer_id: string
  seller_id: string
  rating: number
  body: string
  response_body: string | null
  response_at: string | null
  conversation_thread_id: string | null
  conversation_message_id: string | null
  is_visible: boolean
  created_at: string
  updated_at: string
  social_profiles?: {
    handle: string | null
    display_name: string | null
    avatar_path: string | null
  } | null
}

function rowToReview(row: ReviewRow): ListingReview {
  return {
    id: row.id,
    listingId: row.listing_id,
    orderId: row.order_id,
    reviewerId: row.reviewer_id,
    sellerId: row.seller_id,
    rating: row.rating,
    body: row.body,
    responseBody: row.response_body,
    responseAt: row.response_at,
    conversationThreadId: row.conversation_thread_id,
    conversationMessageId: row.conversation_message_id,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewerHandle: row.social_profiles?.handle ?? null,
    reviewerDisplayName: row.social_profiles?.display_name ?? null,
    reviewerAvatarPath: row.social_profiles?.avatar_path ?? null,
  }
}

const REVIEW_SELECT = `
  id, listing_id, order_id, reviewer_id, seller_id, rating, body,
  response_body, response_at, conversation_thread_id, conversation_message_id,
  is_visible, created_at, updated_at,
  social_profiles!reviewer_id ( handle, display_name, avatar_path )
`

export async function fetchListingReviews(listingId: string): Promise<ListingReview[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('listing_reviews')
    .select(REVIEW_SELECT)
    .eq('listing_id', listingId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data as unknown as ReviewRow[]) ?? []).map(rowToReview)
}

export async function fetchSellerReviews(sellerId: string, limit = 6): Promise<ListingReview[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('listing_reviews')
    .select(REVIEW_SELECT)
    .eq('seller_id', sellerId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data as unknown as ReviewRow[]) ?? []).map(rowToReview)
}

export async function checkCanReview(
  listingId: string,
  buyerId: string,
): Promise<{ canReview: boolean; orderId: string | null; alreadyReviewed: boolean }> {
  if (!supabase) return { canReview: false, orderId: null, alreadyReviewed: false }

  // Check for existing review first
  const { data: existing } = await supabase
    .from('listing_reviews')
    .select('id')
    .eq('listing_id', listingId)
    .eq('reviewer_id', buyerId)
    .maybeSingle()

  if (existing) return { canReview: false, orderId: null, alreadyReviewed: true }

  // Check for a fulfilled order containing this listing
  const { data: orderItem } = await supabase
    .from('order_items')
    .select('order_id, commerce_orders!inner(id, buyer_profile_id, status)')
    .eq('listing_id', listingId)
    .eq('commerce_orders.buyer_profile_id', buyerId)
    .eq('commerce_orders.status', 'fulfilled')
    .maybeSingle()

  if (!orderItem) return { canReview: false, orderId: null, alreadyReviewed: false }

  const order = (orderItem as Record<string, unknown>).commerce_orders as Record<string, unknown>
  return { canReview: true, orderId: order.id as string, alreadyReviewed: false }
}

export async function createReview(input: {
  listingId: string
  orderId: string
  sellerId: string
  reviewerId: string
  rating: number
  body: string
  listingTitle?: string | null
  threadId?: string | null
}): Promise<ListingReview> {
  if (!supabase) throw new Error('Supabase not configured')

  // Insert the review
  const { data: reviewData, error: reviewError } = await supabase
    .from('listing_reviews')
    .insert({
      listing_id: input.listingId,
      order_id: input.orderId,
      reviewer_id: input.reviewerId,
      seller_id: input.sellerId,
      rating: input.rating,
      body: input.body,
    })
    .select(REVIEW_SELECT)
    .single()

  if (reviewError) throw reviewError
  const review = rowToReview(reviewData as unknown as ReviewRow)

  // Create a social post so the review appears in the main feed
  const stars = '★'.repeat(input.rating) + '☆'.repeat(5 - input.rating)
  const listingLabel = input.listingTitle ? ` for "${input.listingTitle}"` : ''
  const postBody = `${stars}${listingLabel}\n\n${input.body}`
  await supabase.from('posts').insert({
    author_id: input.reviewerId,
    body: postBody,
    content_kind: 'review',
    visibility: 'public',
    metadata: {
      review_id: review.id,
      listing_id: input.listingId,
      listing_title: input.listingTitle ?? null,
      rating: input.rating,
    },
  })

  // Post a message to the conversation thread if one is provided
  if (input.threadId) {
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .insert({
        thread_id: input.threadId,
        author_id: input.reviewerId,
        body: input.body,
        message_type: 'review',
        metadata: {
          rating: input.rating,
          listing_id: input.listingId,
          review_id: review.id,
        },
      })
      .select('id')
      .single()

    if (!msgError && msgData) {
      const { id: messageId } = msgData as { id: string }
      await supabase
        .from('listing_reviews')
        .update({ conversation_thread_id: input.threadId, conversation_message_id: messageId })
        .eq('id', review.id)
      review.conversationThreadId = input.threadId
      review.conversationMessageId = messageId
    }
  }

  return review
}

export async function respondToReview(reviewId: string, responseBody: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('listing_reviews')
    .update({
      response_body: responseBody,
      response_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
  if (error) throw error
}

export function formatRating(ratingSum: number, reviewCount: number): string {
  if (reviewCount === 0) return '—'
  return (ratingSum / reviewCount).toFixed(1)
}

export function ratingToStars(rating: number): { full: number; half: boolean; empty: number } {
  const full = Math.floor(rating)
  const half = rating - full >= 0.4 && rating - full < 0.9
  const empty = 5 - full - (half ? 1 : 0)
  return { full, half, empty }
}
