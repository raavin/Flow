create or replace function public.user_can_access_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects
    where projects.id = p_project_id
      and projects.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_participants
    join public.social_profiles
      on social_profiles.id = auth.uid()
    where project_participants.project_id = p_project_id
      and project_participants.status in ('invited', 'active')
      and lower(coalesce(project_participants.contact_hint, '')) = lower('@' || social_profiles.handle)
  );
$$;

alter table public.posts
  drop constraint if exists posts_visibility_check;

alter table public.posts
  add constraint posts_visibility_check
  check (visibility in ('public', 'followers', 'private', 'project'));

update public.posts
set visibility = 'project'
where linked_project_id is not null
  and visibility <> 'public';

drop policy if exists "posts_read_visible" on public.posts;
create policy "posts_read_visible" on public.posts
  for select using (
    author_id = auth.uid()
    or (
      linked_project_id is not null
      and visibility = 'project'
      and public.user_can_access_project(linked_project_id)
    )
    or (
      linked_project_id is null
      and visibility = 'public'
    )
    or (
      linked_project_id is null
      and visibility = 'followers'
      and exists (
        select 1 from public.social_follows
        where social_follows.followee_id = posts.author_id
          and social_follows.follower_id = auth.uid()
      )
    )
  );

drop policy if exists "post_media_read_visible_posts" on public.post_media;
create policy "post_media_read_visible_posts" on public.post_media
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
        and (
          posts.author_id = auth.uid()
          or (
            posts.linked_project_id is not null
            and posts.visibility = 'project'
            and public.user_can_access_project(posts.linked_project_id)
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'public'
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'followers'
            and exists (
              select 1 from public.social_follows
              where social_follows.followee_id = posts.author_id
                and social_follows.follower_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "post_topics_read_visible_posts" on public.post_topics;
create policy "post_topics_read_visible_posts" on public.post_topics
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_topics.post_id
        and (
          posts.author_id = auth.uid()
          or (
            posts.linked_project_id is not null
            and posts.visibility = 'project'
            and public.user_can_access_project(posts.linked_project_id)
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'public'
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'followers'
            and exists (
              select 1 from public.social_follows
              where social_follows.followee_id = posts.author_id
                and social_follows.follower_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "post_engagements_read_visible_posts" on public.post_engagements;
create policy "post_engagements_read_visible_posts" on public.post_engagements
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_engagements.post_id
        and (
          posts.author_id = auth.uid()
          or (
            posts.linked_project_id is not null
            and posts.visibility = 'project'
            and public.user_can_access_project(posts.linked_project_id)
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'public'
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'followers'
            and exists (
              select 1 from public.social_follows
              where social_follows.followee_id = posts.author_id
                and social_follows.follower_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "post_label_flags_read_visible_posts" on public.post_label_flags;
create policy "post_label_flags_read_visible_posts" on public.post_label_flags
  for select using (
    exists (
      select 1 from public.posts
      where posts.id = post_label_flags.post_id
        and (
          posts.author_id = auth.uid()
          or (
            posts.linked_project_id is not null
            and posts.visibility = 'project'
            and public.user_can_access_project(posts.linked_project_id)
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'public'
          )
          or (
            posts.linked_project_id is null
            and posts.visibility = 'followers'
            and exists (
              select 1 from public.social_follows
              where social_follows.followee_id = posts.author_id
                and social_follows.follower_id = auth.uid()
            )
          )
        )
    )
  );
