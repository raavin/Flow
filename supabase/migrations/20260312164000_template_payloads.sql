alter table public.marketplace_listings
add column if not exists template_payload jsonb not null default '{}'::jsonb;
