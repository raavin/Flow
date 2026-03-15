-- ── Listing images ──────────────────────────────────────────────────────────
-- Gives each marketplace listing a proper multi-image gallery.
-- cover_image_path is denormalised onto marketplace_listings for fast card renders.

create table if not exists public.listing_images (
  id             uuid        primary key default gen_random_uuid(),
  listing_id     uuid        not null references public.marketplace_listings (id) on delete cascade,
  storage_path   text        not null,
  alt_text       text        not null default '',
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists idx_listing_images_listing_id on public.listing_images (listing_id, sort_order);

-- Extend marketplace_listings with richer content fields
alter table public.marketplace_listings
  add column if not exists cover_image_path   text,
  add column if not exists location_label     text   not null default '',
  add column if not exists description        text   not null default '',
  add column if not exists return_policy      text   not null default '',
  add column if not exists fulfillment_days_min integer,
  add column if not exists fulfillment_days_max integer,
  add column if not exists review_count       integer not null default 0,
  add column if not exists rating_sum         integer not null default 0;

-- RLS
alter table public.listing_images enable row level security;

create policy "Public can read listing images"
  on public.listing_images for select
  using (true);

create policy "Owner can manage listing images"
  on public.listing_images for all
  using (
    exists (
      select 1 from public.marketplace_listings ml
      where ml.id = listing_id and ml.owner_id = auth.uid()
    )
  );
