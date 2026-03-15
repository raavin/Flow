# Marketplace Redesign Plan
*Flow Market — real things from real people*

## Vision

A local-first ecommerce experience for products, services, and experiences. No algorithmic noise, no race to the bottom. Quality over volume. Reviews are conversations — they live in both the marketplace and the messaging feed. Sellers respond to reviews the same way they respond to messages.

---

## Reference Screenshots

- **Browse page**: Etsy-style 4-column image grid, square photos, title below, seller name (coloured link), star rating + count, price. Clean, image-first, no chrome.
- **Listing detail**: Left = photo gallery (thumbnail strip + main image). Right = scarcity signal, price + sale, CTA button, item details accordion, highlights with icons.
- **Reviews**: Full list with star display, reviewer name + date, "This item" badge, optional review photo, separated by dividers. Delivery/policies in right sidebar accordion.
- **Seller card**: Round avatar, shop name, owner name + location, aggregate rating + sales count + years active, "Message seller" + "Follow shop" CTAs, response time note, preview of latest reviews.

---

## 1. Database Migrations

### Migration A: `20260315_marketplace_listing_images.sql`
```sql
create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_path text not null,           -- Supabase Storage object path
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.marketplace_listings
  add column if not exists cover_image_path text,         -- denormalised fast access
  add column if not exists location_label text not null default '',  -- "Melbourne, VIC"
  add column if not exists description text not null default '',     -- long-form (summary stays as tagline)
  add column if not exists return_policy text not null default '',
  add column if not exists fulfillment_days_min integer,
  add column if not exists fulfillment_days_max integer;

-- RLS
alter table public.listing_images enable row level security;
create policy "Public can read listing images" on public.listing_images for select using (true);
create policy "Owner can manage listing images" on public.listing_images
  for all using (
    exists (
      select 1 from public.marketplace_listings ml
      where ml.id = listing_id and ml.owner_id = auth.uid()
    )
  );
```

### Migration B: `20260315_marketplace_reviews.sql`
```sql
create table if not exists public.listing_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  order_id uuid references public.commerce_orders(id) on delete set null,  -- purchase gate
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  -- seller response (stored inline, simple)
  response_body text,
  response_at timestamptz,
  -- conversation message link (the review also appears as a message)
  conversation_message_id uuid references public.messages(id) on delete set null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aggregate rating helper (materialised on listing)
alter table public.marketplace_listings
  add column if not exists review_count integer not null default 0,
  add column if not exists rating_sum integer not null default 0;
  -- avg_rating computed as: rating_sum / nullif(review_count, 0)

-- Trigger to keep review_count + rating_sum current
create or replace function public.refresh_listing_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.marketplace_listings
  set
    review_count = (select count(*) from public.listing_reviews where listing_id = coalesce(new.listing_id, old.listing_id) and is_visible = true),
    rating_sum   = (select coalesce(sum(rating), 0) from public.listing_reviews where listing_id = coalesce(new.listing_id, old.listing_id) and is_visible = true)
  where id = coalesce(new.listing_id, old.listing_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_refresh_listing_rating
  after insert or update or delete on public.listing_reviews
  for each row execute function public.refresh_listing_rating();

-- RLS
alter table public.listing_reviews enable row level security;
create policy "Public can read visible reviews" on public.listing_reviews for select using (is_visible = true);
create policy "Reviewer can insert" on public.listing_reviews for insert with check (reviewer_id = auth.uid());
create policy "Seller can update response" on public.listing_reviews
  for update using (seller_id = auth.uid())
  with check (seller_id = auth.uid());
```

### Migration C: `20260315_marketplace_seller_stats.sql`
```sql
-- Denormalised seller stats on business_profiles for fast seller card rendering
alter table public.business_profiles
  add column if not exists total_sales integer not null default 0,
  add column if not exists total_review_count integer not null default 0,
  add column if not exists total_rating_sum integer not null default 0,
  add column if not exists member_since date;
  -- avg_rating = total_rating_sum / nullif(total_review_count, 0)

-- member_since back-filled from profiles.created_at
update public.business_profiles bp
set member_since = p.created_at::date
from public.profiles p where p.id = bp.id;
```

---

## 2. Pages & Routes

### Existing routes (keep, modify)
| Route | Current | Change |
|-------|---------|--------|
| `marketplace/templates` | TemplateMarketplacePage | Fold into unified browse with kind filter |
| `marketplace/services` | ServicesMarketplacePage | Fold into unified browse |
| `marketplace/listings/$listingId` | ListingDetailPage | Full redesign |
| `business/$ownerId` | BusinessProfilePage | Redesign as seller profile |
| `business/listings` | ListingsManagementPage | Keep, add image upload + stats |

### New routes
| Route | Component | Purpose |
|-------|-----------|---------|
| `marketplace` | `MarketplaceBrowsePage` | Unified browse (replaces both current pages) |
| `marketplace/listings/$listingId` | `ListingDetailPage` | Redesigned detail |
| `marketplace/listings/$listingId/review` | `WriteReviewPage` | Post-purchase review form |
| `marketplace/seller/$sellerId` | `SellerProfilePage` | Seller card + listings + reviews |

---

## 3. Component Designs

### 3a. Browse Page (`MarketplaceBrowsePage`)

```
┌────────────────────────────────────────────────────────────┐
│  [Search bar]           [Cart (3)]  [Sell]                 │
│  [All] [Products] [Services] [Digital] [Experiences]       │
│  [Location: Melbourne ▼]  [Sort: Newest ▼]                 │
├────────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│  │image │ │image │ │image │ │image │   ← square, fills col │
│  └──────┘ └──────┘ └──────┘ └──────┘                      │
│  Title    Title    Title    Title                           │
│  Seller   Seller   Seller   Seller   ← coloured link       │
│  ★4.9(32) ★5.0(8)  ★4.7(19) ★4.2(6)                       │
│  $45.00   $120     $18/hr   $280                           │
└────────────────────────────────────────────────────────────┘
```

**Card data needed**: `cover_image_path`, `title`, seller name (join), `review_count`, `rating_sum`, `price_cents`, `price_label`, `location_label`, `kind`

**Quality signals on cards**:
- `Local` pill if `location_label` is set
- No card without an image is shown on the main browse grid (placeholder image fallback only in management)

### 3b. Listing Detail Page

**Layout**: Two-column on desktop, stacked on mobile.

**Left column**:
- Photo gallery: thumbnail strip (vertical, left of main image like Etsy) + large main image
- Uses `listing_images` table; falls back to a placeholder if none
- Image navigation: click thumbnail or prev/next arrows

**Right column** (sticky on scroll):
```
[Scarcity: "Only 3 left"]    ← only shown if stock tracking added later

Price: $311.87  ~~$346.53~~ 10% off
Sale ends 31 March

Title (full, larger)
Seller name ★ 4.5 (544)  → links to seller profile

✓ Returns accepted

[Add to cart]  ← full-width, prominent

Item details ▸  (accordion)
  • Description
  • Highlights list (whimsical_note split into bullet items)

Delivery & policies ▸ (accordion)
  • fulfillment_days_min–max days
  • return_policy
  • location_label (dispatched from)
```

**Below the fold**:
- Reviews section (see 3c)
- "More from this seller" grid (3–4 listings)

### 3c. Reviews Section

```
Reviews for this listing (19)                [Sort: Suggested ▼]

★★★★★ 5  [This item]           Sian Taylor  |  19 Jun 2025
In love with this camera, can't wait to get my first roll of film developed
─────────────────────────────────────────────────────────────
★★★★☆ 4  [This item]           Sasha Gabig  |  22 Mar 2025
Beautiful camera but was missing the top winder...
─────────────────────────────────────────────────────────────
  Seller response (5 Mar 2025):
  "So sorry about this — I've sent you a replacement part..."
```

- Only show if `is_visible = true`
- "This item" badge distinguishes listing-specific vs seller-aggregate reviews
- Seller response shown inline below the review

### 3d. Seller Profile Page

```
        [round avatar / logo]
        ShopName
        Owned by FirstName | Melbourne, VIC
        ★ 4.5 (544)   4.4k sales   2 years on Flow

        [Message seller]  [View listings]

─────────────────────────────────────────────────────────────
All reviews from this shop (544)              [Show all]

[review card]  [review card]  [review card]   ← 3-col preview

─────────────────────────────────────────────────────────────
Listings from this shop

[card grid — 3 cols]
```

---

## 4. Review Flow — Data & Conversation Integration

### How a review gets created

1. Buyer visits listing detail after completing an order (order status = `fulfilled`)
2. "Leave a review" button appears (check: `order_id` exists for `buyer_id` + `listing_id`)
3. `WriteReviewPage` — star picker + text body + optional photo (future)
4. On submit:
   - Insert into `listing_reviews` (with `order_id` FK — purchase gate enforced)
   - Insert a `message` into the conversation thread associated with the order:
     ```
     kind = 'review'
     content = { rating, body, listing_id, listing_title, reviewer_handle }
     conversation_id = order.linked_conversation_id (or buyer↔seller DM thread)
     ```
   - Store `messages.id` back on `listing_reviews.conversation_message_id`
   - Trigger fires → updates `review_count` + `rating_sum` on listing

### How seller responds

- Review appears in seller's message feed as a `kind = 'review'` message
- Seller clicks "Reply to review" on that message
- Reply inserts into `listing_reviews.response_body` + `response_at`
- Response also optionally creates a follow-up message in the same thread

### Conversation filter

- Messages feed shows `kind = 'review'` messages with a star-rating header component instead of plain text
- Toggle: "Hide review activity" in conversation settings → filters `kind = 'review'` messages from display
- Filter state stored in `localStorage` or profile preferences

### Messages `kind` values to add
Add `'review'` to the messages `kind` check constraint:
```sql
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'file', 'system', 'review', ...existing...));
```

---

## 5. Quality / Anti-trash Mechanics

| Mechanism | Implementation |
|-----------|----------------|
| **Purchase-gated reviews** | `order_id` FK required, UI checks order exists for buyer before showing review form |
| **No anonymous reviews** | `reviewer_id` FK required, must be signed in |
| **Real identity on cards** | Reviewer shown with handle + avatar (not anonymous) |
| **Images encourage quality** | Browse page prioritises listings with images; no-image listings shown in a "text" section below the fold |
| **Local framing** | `location_label` shown prominently; filter by location in browse |
| **No gaming** | `price_cents > 0` required for product/service (enforced in existing check constraint); templates can be free |
| **Seller response time** | Compute from order-to-first-message latency and show on seller card (future enhancement) |

---

## 6. Data Layer Changes (`marketplace.ts` + new `reviews.ts`)

### New functions needed in `marketplace.ts`
```ts
fetchMarketplaceListingsBrowse(filters: {
  kind?: MarketplaceKind
  category?: string
  location?: string
  sort?: 'newest' | 'rating' | 'price_asc' | 'price_desc'
}): Promise<BrowseListing[]>
// BrowseListing adds: cover_image_path, review_count, rating_sum, seller_name, location_label

fetchListingImages(listingId: string): Promise<ListingImage[]>

fetchMoreFromSeller(sellerId: string, excludeId: string, limit: number): Promise<BrowseListing[]>

uploadListingImage(listingId: string, file: File, sortOrder: number): Promise<string>
// uploads to Supabase Storage 'listing-images' bucket, inserts listing_images row, updates cover_image_path
```

### New file: `apps/web/src/lib/reviews.ts`
```ts
fetchListingReviews(listingId: string): Promise<ListingReview[]>
fetchSellerReviews(sellerId: string, limit?: number): Promise<ListingReview[]>
createReview(input: { listingId, orderId, rating, body }): Promise<void>
// → inserts listing_reviews + messages row
respondToReview(reviewId: string, responseBody: string): Promise<void>
// → updates listing_reviews.response_body
checkCanReview(listingId: string, buyerId: string): Promise<{ canReview: boolean; orderId: string | null }>
// → queries commerce_orders for fulfilled order
```

---

## 7. Storage Bucket

Add `listing-images` public bucket:
```sql
insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "Public read listing images" on storage.objects
  for select using (bucket_id = 'listing-images');
create policy "Owner upload listing images" on storage.objects
  for insert with check (bucket_id = 'listing-images' and auth.uid() is not null);
```

---

## 8. Build Order

| Step | What | Files | Status |
|------|------|-------|--------|
| 1 | **Migrations A + B + C** — images, reviews, seller stats | `supabase/migrations/20260315120000`, `130000`, `140000` | ✅ Done |
| 2 | **Storage bucket** migration | `20260315140000` (combined) | ✅ Done |
| 3 | **Data layer** — `fetchMarketplaceListingsBrowse`, `fetchListingImages`, new `reviews.ts` | `marketplace.ts`, `reviews.ts` | ✅ Done |
| 4 | **Browse page** — unified grid, category filter, image-first layout | `marketplace.tsx` | ✅ Done |
| 5 | **Listing detail** — photo gallery, sticky right column, accordion policies | `listings.tsx` | ✅ Done |
| 6 | **Reviews UI** — star display, reviewer row, seller response | `listings.tsx` | ✅ Done |
| 7 | **Seller profile page** — avatar, stats, review preview, listings grid | `listings.tsx` | ✅ Done |
| 8 | **Write review flow** — star picker, text, purchase gate | `listings.tsx` | ✅ Done |
| 9 | **Conversation integration** — `kind = 'review'` message render + filter toggle | `messages.tsx` | ⬜ Next |
| 10 | **Image upload** in listings management | `listings.tsx` | ✅ Done |
| 11 | **Tests** — `reviews.test.ts` (12 tests) | `reviews.test.ts` | ✅ Done |

---

## 9. Type System Changes (`packages/types/src/index.ts`)

Add:
```ts
export type ListingImage = {
  id: string
  listingId: string
  storagePath: string
  altText: string
  sortOrder: number
}

export type ListingReview = {
  id: string
  listingId: string
  orderId: string | null
  reviewerId: string
  sellerId: string
  rating: number
  body: string
  responseBody: string | null
  responseAt: string | null
  conversationMessageId: string | null
  reviewerHandle?: string
  reviewerDisplayName?: string
  isVisible: boolean
  createdAt: string
}

export type BrowseListing = {
  id: string
  title: string
  kind: MarketplaceKind
  category: string
  priceCents: number
  priceLabel: string
  currencyCode: string
  coverImagePath: string | null
  locationLabel: string
  reviewCount: number
  ratingSum: number           // avgRating = ratingSum / reviewCount
  sellerName: string
  sellerId: string
  isPublished: boolean
}
```

---

## 10. Notes & Decisions

- **`summary` stays as the tagline** (shown on cards). New `description` column holds the long-form text shown in the accordion.
- **Star display**: render as filled/half/empty SVGs. `avgRating = ratingSum / reviewCount`, displayed as e.g. ★4.5 (32).
- **Photo gallery**: thumbnails left of main image on desktop (like Etsy). On mobile: horizontal scroll strip below main image.
- **No "follow shop"** in v1 — too much infra. "Message seller" → opens DM thread.
- **No Klarna/payment splits** — existing cart/checkout flow unchanged.
- **Review photos** deferred to v2 — focus on text reviews first.
- **Location filter** deferred to v2 — `location_label` stored now, filter UI added later.
- **`whimsical_note`** repurposed as highlights bullet list (split by newline) in the "Highlights" accordion section.
