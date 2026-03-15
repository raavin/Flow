-- Add 'review' as a valid content_kind for social posts so that
-- marketplace reviews can appear in the main feed and be filtered.
alter table posts
  drop constraint if exists posts_content_kind_check;

alter table posts
  add constraint posts_content_kind_check
    check (content_kind in ('update', 'product', 'opinion', 'claim', 'review'));
