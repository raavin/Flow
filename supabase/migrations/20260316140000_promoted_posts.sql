-- Add is_promoted flag to allow project posts to surface on the public feed
alter table public.posts
  add column if not exists is_promoted boolean not null default false;

-- Update the posts read policy to allow is_promoted=true posts to be visible publicly
-- even when they have a linked_project_id
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
      -- Public posts: no project link, OR promoted with a project link
      visibility = 'public'
      and (linked_project_id is null or is_promoted = true)
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
