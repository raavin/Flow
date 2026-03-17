alter table public.posts
  drop constraint if exists posts_content_kind_check;
alter table public.posts
  add constraint posts_content_kind_check
    check (content_kind in ('note','text','link','image','video','review','product','opinion','fact_claim','update','claim'));
