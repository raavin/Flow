-- ── Seller stats ─────────────────────────────────────────────────────────────
-- Denormalised onto business_profiles for fast seller card rendering.
-- avg_rating = total_rating_sum / nullif(total_review_count, 0)

alter table public.business_profiles
  add column if not exists total_sales         integer not null default 0,
  add column if not exists total_review_count  integer not null default 0,
  add column if not exists total_rating_sum    integer not null default 0,
  add column if not exists member_since        date;

-- Back-fill member_since from profiles.created_at
update public.business_profiles bp
set member_since = p.created_at::date
from public.profiles p
where p.id = bp.id
  and bp.member_since is null;

-- ── Storage bucket for listing images ────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Anyone can read listing images"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "Authenticated users can upload listing images"
  on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.uid() is not null);

create policy "Owners can delete their listing images"
  on storage.objects for delete
  using (bucket_id = 'listing-images' and auth.uid() = owner);
