alter table public.posts
  add column if not exists content_kind text not null default 'update'
    check (content_kind in ('update', 'product', 'opinion', 'claim')),
  add column if not exists mislabel_flag_count integer not null default 0,
  add column if not exists review_state text not null default 'clear'
    check (review_state in ('clear', 'peer_review', 'under_review', 'resolved')),
  add column if not exists review_notice_sent_at timestamptz;

create table if not exists public.post_label_flags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  suggested_kind text not null check (suggested_kind in ('update', 'product', 'opinion', 'claim')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, user_id)
);

alter table public.post_label_flags enable row level security;

create policy "post_label_flags_read_visible_posts" on public.post_label_flags
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_label_flags.post_id
        and (
          posts.visibility = 'public'
          or posts.author_id = auth.uid()
          or (
            posts.visibility = 'followers'
            and exists (
              select 1 from public.social_follows
              where social_follows.followee_id = posts.author_id
                and social_follows.follower_id = auth.uid()
            )
          )
        )
    )
  );

create policy "post_label_flags_write_own" on public.post_label_flags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.refresh_post_label_review_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
  next_count integer;
  next_state text;
  post_author_id uuid;
  current_kind text;
  prior_notice_sent_at timestamptz;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  select count(*)::integer
    into next_count
  from public.post_label_flags
  where post_id = target_post_id;

  next_state := case
    when next_count >= 5 then 'under_review'
    when next_count >= 3 then 'peer_review'
    else 'clear'
  end;

  update public.posts
  set mislabel_flag_count = next_count,
      review_state = next_state
  where id = target_post_id;

  select author_id, content_kind, review_notice_sent_at
    into post_author_id, current_kind, prior_notice_sent_at
  from public.posts
  where id = target_post_id;

  if next_count >= 3 and prior_notice_sent_at is null then
    update public.posts
    set review_notice_sent_at = timezone('utc', now())
    where id = target_post_id;

    insert into public.notifications (profile_id, title, body, kind)
    values (
      post_author_id,
      'Post label needs another look',
      'This post has been flagged by other users as possibly mislabeled as ' || initcap(current_kind) || '. Please review the label. If further concerns are raised, our team may take a closer look. Thanks.',
      'post-label-review'
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists post_label_flags_refresh_post on public.post_label_flags;
create trigger post_label_flags_refresh_post
  after insert or update or delete on public.post_label_flags
  for each row execute function public.refresh_post_label_review_state();
