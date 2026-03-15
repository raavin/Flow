-- ── Listing reviews ──────────────────────────────────────────────────────────
-- Purchase-gated reviews with conversation integration.
-- Each review also inserts a message into the buyer↔seller thread so the
-- seller can respond to it like any other message.

create table if not exists public.listing_reviews (
  id                      uuid        primary key default gen_random_uuid(),
  listing_id              uuid        not null references public.marketplace_listings (id) on delete cascade,
  order_id                uuid        references public.commerce_orders (id) on delete set null,
  reviewer_id             uuid        not null references public.profiles (id) on delete cascade,
  seller_id               uuid        not null references public.profiles (id) on delete cascade,
  rating                  smallint    not null check (rating between 1 and 5),
  body                    text        not null default '',
  -- Seller response stored inline (simple; no separate table needed for v1)
  response_body           text,
  response_at             timestamptz,
  -- Link to the conversation message this review created
  conversation_thread_id  uuid        references public.conversation_threads (id) on delete set null,
  conversation_message_id uuid        references public.messages (id) on delete set null,
  is_visible              boolean     not null default true,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

create index if not exists idx_listing_reviews_listing_id  on public.listing_reviews (listing_id)  where is_visible = true;
create index if not exists idx_listing_reviews_seller_id   on public.listing_reviews (seller_id)   where is_visible = true;
create index if not exists idx_listing_reviews_reviewer_id on public.listing_reviews (reviewer_id);

-- One review per buyer per listing (prevents spam)
create unique index if not exists uniq_listing_reviews_reviewer_listing
  on public.listing_reviews (reviewer_id, listing_id);

-- ── Aggregate trigger ─────────────────────────────────────────────────────────
-- Keeps review_count + rating_sum on marketplace_listings in sync automatically.

create or replace function public.refresh_listing_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
begin
  v_listing_id := coalesce(new.listing_id, old.listing_id);

  update public.marketplace_listings
  set
    review_count = (
      select count(*) from public.listing_reviews
      where listing_id = v_listing_id and is_visible = true
    ),
    rating_sum = (
      select coalesce(sum(rating), 0) from public.listing_reviews
      where listing_id = v_listing_id and is_visible = true
    )
  where id = v_listing_id;

  return coalesce(new, old);
end;
$$;

create trigger trg_refresh_listing_rating
  after insert or update or delete on public.listing_reviews
  for each row execute function public.refresh_listing_rating();

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function public.touch_listing_review_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_listing_review_updated_at
  before update on public.listing_reviews
  for each row execute function public.touch_listing_review_updated_at();

-- ── messages: add 'review' message_type ──────────────────────────────────────
-- Allow reviews to appear in conversation threads as native messages.

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'structured_update', 'payment_request', 'task_request', 'review'));

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.listing_reviews enable row level security;

create policy "Public can read visible reviews"
  on public.listing_reviews for select
  using (is_visible = true);

create policy "Reviewer can insert own review"
  on public.listing_reviews for insert
  with check (reviewer_id = auth.uid());

create policy "Seller can update response on their reviews"
  on public.listing_reviews for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Reviewer can update own review before response"
  on public.listing_reviews for update
  using (reviewer_id = auth.uid() and response_body is null);
