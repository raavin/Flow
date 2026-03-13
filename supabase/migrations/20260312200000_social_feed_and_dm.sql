create table if not exists public.social_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  handle text not null unique,
  display_name text not null default '',
  bio text not null default '',
  is_private boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  visibility text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  reply_to_post_id uuid references public.posts (id) on delete cascade,
  quote_post_id uuid references public.posts (id) on delete set null,
  linked_project_id uuid references public.projects (id) on delete set null,
  linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  linked_job_id uuid references public.jobs (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.post_topics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  unique (post_id, topic_id)
);

create table if not exists public.post_engagements (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  liked boolean not null default false,
  reposted boolean not null default false,
  bookmarked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, user_id)
);

create table if not exists public.topic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (topic_id, user_id)
);

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  thread_kind text not null default 'direct' check (thread_kind in ('direct', 'group')),
  linked_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dm_thread_members (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (thread_id, user_id)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.social_profiles enable row level security;
alter table public.social_follows enable row level security;
alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_topics enable row level security;
alter table public.post_engagements enable row level security;
alter table public.topic_subscriptions enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_thread_members enable row level security;
alter table public.dm_messages enable row level security;

create policy "social_profiles_read_all" on public.social_profiles
  for select using (true);
create policy "social_profiles_write_own" on public.social_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "social_follows_read_own_network" on public.social_follows
  for select using (auth.uid() = follower_id or auth.uid() = followee_id);
create policy "social_follows_write_own" on public.social_follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

create policy "topics_read_all" on public.topics
  for select using (true);

create policy "posts_read_visible" on public.posts
  for select using (
    visibility = 'public'
    or author_id = auth.uid()
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.social_follows
        where social_follows.followee_id = posts.author_id
          and social_follows.follower_id = auth.uid()
      )
    )
  );
create policy "posts_write_own" on public.posts
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "post_media_read_visible_posts" on public.post_media
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
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
create policy "post_media_write_own" on public.post_media
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "post_topics_read_visible_posts" on public.post_topics
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_topics.post_id
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
create policy "post_topics_write_own_posts" on public.post_topics
  for all using (
    exists (
      select 1 from public.posts
      where posts.id = post_topics.post_id
        and posts.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_topics.post_id
        and posts.author_id = auth.uid()
    )
  );

create policy "post_engagements_read_visible_posts" on public.post_engagements
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_engagements.post_id
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
create policy "post_engagements_write_own" on public.post_engagements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "topic_subscriptions_read_own" on public.topic_subscriptions
  for select using (auth.uid() = user_id);
create policy "topic_subscriptions_write_own" on public.topic_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dm_threads_read_member" on public.dm_threads
  for select using (
    exists (
      select 1 from public.dm_thread_members
      where dm_thread_members.thread_id = dm_threads.id
        and dm_thread_members.user_id = auth.uid()
    )
  );
create policy "dm_threads_write_owner" on public.dm_threads
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "dm_thread_members_read_member" on public.dm_thread_members
  for select using (
    exists (
      select 1 from public.dm_thread_members as membership
      where membership.thread_id = dm_thread_members.thread_id
        and membership.user_id = auth.uid()
    )
  );
create policy "dm_thread_members_write_owner" on public.dm_thread_members
  for all using (
    exists (
      select 1 from public.dm_threads
      where dm_threads.id = dm_thread_members.thread_id
        and dm_threads.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dm_threads
      where dm_threads.id = dm_thread_members.thread_id
        and dm_threads.owner_id = auth.uid()
    )
  );

create policy "dm_messages_read_member" on public.dm_messages
  for select using (
    exists (
      select 1 from public.dm_thread_members
      where dm_thread_members.thread_id = dm_messages.thread_id
        and dm_thread_members.user_id = auth.uid()
    )
  );
create policy "dm_messages_write_member" on public.dm_messages
  for all using (
    exists (
      select 1 from public.dm_thread_members
      where dm_thread_members.thread_id = dm_messages.thread_id
        and dm_thread_members.user_id = auth.uid()
        and dm_messages.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dm_thread_members
      where dm_thread_members.thread_id = dm_messages.thread_id
        and dm_thread_members.user_id = auth.uid()
    )
    and dm_messages.author_id = auth.uid()
  );

create or replace function public.handle_social_profile_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.display_name = '' then
    select coalesce(first_name, '') into new.display_name
    from public.profiles
    where profiles.id = new.id;
  end if;

  if new.handle = '' then
    new.handle = 'user-' || replace(new.id::text, '-', '');
  end if;

  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger social_profiles_defaults
  before insert or update on public.social_profiles
  for each row execute function public.handle_social_profile_defaults();

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dm-media', 'dm-media', false)
on conflict (id) do nothing;

create policy "post_media_bucket_read_own" on storage.objects
  for select using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post_media_bucket_write_own" on storage.objects
  for insert with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post_media_bucket_update_own" on storage.objects
  for update using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post_media_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "dm_media_bucket_read_own" on storage.objects
  for select using (
    bucket_id = 'dm-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "dm_media_bucket_write_own" on storage.objects
  for insert with check (
    bucket_id = 'dm-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "dm_media_bucket_update_own" on storage.objects
  for update using (
    bucket_id = 'dm-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'dm-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "dm_media_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'dm-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
