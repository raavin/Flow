-- Stable identities, conversation privacy and optional source-linked actions.
alter table public.project_participants add column if not exists profile_id uuid references public.profiles(id) on delete set null;
update public.project_participants p set profile_id = s.id from public.social_profiles s
where p.profile_id is null and lower(p.contact_hint) = lower('@' || s.handle);
create index if not exists participants_profile_idx on public.project_participants(profile_id, project_id);
create or replace function public.user_can_access_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid())
 or exists(select 1 from public.project_participants where project_id=p_project_id and profile_id=auth.uid() and status='active'));
$$;
revoke all on function public.user_can_access_project(uuid) from public,anon;
grant execute on function public.user_can_access_project(uuid) to authenticated;
create policy projects_read_member on public.projects for select to authenticated using(public.user_can_access_project(id));
create policy participants_read_member on public.project_participants for select to authenticated using(profile_id=auth.uid() or public.user_can_access_project(project_id));

create table public.social_preferences (
 user_id uuid not null references public.profiles(id) on delete cascade,
 subject_id uuid not null references public.profiles(id) on delete cascade,
 muted boolean not null default false, blocked boolean not null default false,
 primary key(user_id,subject_id), check(user_id<>subject_id)
);
alter table public.social_preferences enable row level security;
grant select,insert,update,delete on public.social_preferences to authenticated;
create policy social_preferences_own on public.social_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.social_blocked(p_subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.social_preferences where blocked and
 ((user_id=auth.uid() and subject_id=p_subject) or (subject_id=auth.uid() and user_id=p_subject)));
$$;
revoke all on function public.social_blocked(uuid) from public,anon;
grant execute on function public.social_blocked(uuid) to authenticated;

-- Traverse the actual parent audience: follower-only replies belong to the
-- original author's audience, not an unrelated set of the replier's followers.
create function public.can_read_post(p_post_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.posts; steps integer:=0; cursor_id uuid:=p_post_id;
begin
 if auth.uid() is null then return false; end if;
 loop
  select * into p from public.posts where id=cursor_id;
  if not found or public.social_blocked(p.author_id) then return false; end if;
  steps:=steps+1;
  if steps>100 then return false; end if;
  if p.reply_to_post_id is null then exit; end if;
  cursor_id:=p.reply_to_post_id;
 end loop;
 return p.author_id=auth.uid()
 or (p.visibility='project' and public.user_can_access_project(p.linked_project_id))
 or (p.visibility='public' and (p.linked_project_id is null or p.is_promoted))
 or (p.visibility='followers' and p.linked_project_id is null and exists(select 1 from public.social_follows where follower_id=auth.uid() and followee_id=p.author_id));
end; $$;
revoke all on function public.can_read_post(uuid) from public,anon;
grant execute on function public.can_read_post(uuid) to authenticated;
drop policy if exists posts_read_visible on public.posts;
create policy posts_read_visible on public.posts for select to authenticated using((author_id=auth.uid() and (reply_to_post_id is null or public.can_read_post(reply_to_post_id))) or public.can_read_post(id));
-- The old ALL policy also granted SELECT and bypassed the parent check.
drop policy if exists posts_write_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check(author_id=auth.uid());
create policy posts_update_own on public.posts for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
create policy posts_delete_own on public.posts for delete to authenticated using(author_id=auth.uid());
create function public.inherit_reply_audience() returns trigger language plpgsql set search_path='' as $$
declare parent public.posts;
begin
 if tg_op='UPDATE' and (new.author_id<>old.author_id or new.reply_to_post_id is distinct from old.reply_to_post_id) then
  raise exception 'Post author and reply parent cannot be changed';
 end if;
 if new.reply_to_post_id is not null then
  if new.reply_to_post_id=new.id then raise exception 'A post cannot reply to itself'; end if;
  select * into parent from public.posts where id=new.reply_to_post_id;
  if not found then raise exception 'This conversation is unavailable'; end if;
  new.visibility:=parent.visibility; new.linked_project_id:=parent.linked_project_id; new.is_promoted:=parent.is_promoted;
 end if;
 if new.visibility='project' and (new.linked_project_id is null or not public.user_can_access_project(new.linked_project_id)) then
  raise exception 'Project access required';
 end if;
 return new;
end; $$;
revoke all on function public.inherit_reply_audience() from public,anon,authenticated;
create trigger posts_inherit_reply before insert or update on public.posts for each row execute function public.inherit_reply_audience();

create table public.post_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id),
 post_id uuid not null references public.posts(id) on delete cascade, reason text not null check(length(trim(reason)) between 1 and 2000),
 created_at timestamptz not null default now(), unique(reporter_id,post_id)
);
alter table public.post_reports enable row level security;
grant select,insert,update on public.post_reports to authenticated;
create policy reports_own on public.post_reports for all to authenticated using(reporter_id=auth.uid()) with check(reporter_id=auth.uid() and public.can_read_post(post_id));

-- Concurrent direct-message requests resolve to one thread, using account IDs.
create or replace function public.create_dm_thread(p_title text,p_thread_kind text,p_linked_project_id uuid,p_member_ids uuid[])
returns table(id uuid,title text,thread_kind text,linked_project_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); members uuid[]; chosen uuid; peer uuid;
begin
 if me is null then raise exception 'Authentication required'; end if;
 select array_agg(distinct x order by x) into members from unnest(array_append(coalesce(p_member_ids,'{}'),me)) x where x is not null;
 if p_thread_kind not in ('direct','group') or cardinality(members)<2 or cardinality(members)>50 then raise exception 'Choose at least one recipient'; end if;
 if exists(select 1 from unnest(members) x where public.social_blocked(x)) then raise exception 'Messaging is unavailable'; end if;
 if p_linked_project_id is not null and not public.user_can_access_project(p_linked_project_id) then raise exception 'Project access required'; end if;
 if p_thread_kind='direct' then
  if cardinality(members)<>2 then raise exception 'Direct messages need one recipient'; end if;
  perform pg_advisory_xact_lock(hashtextextended(array_to_string(members,','),0));
  select d.id into chosen from public.dm_threads d where d.thread_kind='direct' and
   (select array_agg(m.user_id order by m.user_id) from public.dm_thread_members m where m.thread_id=d.id)=members
   order by d.created_at limit 1;
  select x into peer from unnest(members) x where x<>me;
 end if;
 if chosen is null then
  insert into public.dm_threads(owner_id,title,thread_kind,linked_project_id)
  values(me,coalesce(nullif(trim(p_title),''),'Messages'),p_thread_kind,p_linked_project_id) returning dm_threads.id into chosen;
  insert into public.dm_thread_members(thread_id,user_id) select chosen,unnest(members);
 end if;
 return query select d.id,d.title,d.thread_kind,d.linked_project_id,d.created_at from public.dm_threads d where d.id=chosen;
end; $$;
revoke all on function public.create_dm_thread(text,text,uuid,uuid[]) from public,anon;
grant execute on function public.create_dm_thread(text,text,uuid,uuid[]) to authenticated;
alter table public.dm_messages add column if not exists client_id uuid;
create unique index dm_message_retry_idx on public.dm_messages(author_id,client_id) where client_id is not null;
create function public.check_dm_recipient_blocks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.author_id<>auth.uid() or not exists(select 1 from public.dm_thread_members where thread_id=new.thread_id and user_id=auth.uid()) then raise exception 'Conversation access required'; end if;
 if exists(select 1 from public.dm_thread_members where thread_id=new.thread_id and public.social_blocked(user_id)) then raise exception 'Messaging is unavailable'; end if;
 return new;
end; $$;
revoke all on function public.check_dm_recipient_blocks() from public,anon,authenticated;
create trigger dm_check_blocks before insert on public.dm_messages for each row execute function public.check_dm_recipient_blocks();

-- Source links never change a post's audience or edit someone else's post.
create table public.source_actions (
 id uuid primary key, owner_id uuid not null references public.profiles(id),
 source_post_id uuid references public.posts(id) on delete set null,
 source_message_id uuid references public.dm_messages(id) on delete set null,
 project_id uuid references public.projects(id) on delete cascade,
 object_id uuid references public.coordination_objects(id) on delete cascade,
 created_at timestamptz not null default now(), check(num_nonnulls(source_post_id,source_message_id)<=1)
);
alter table public.source_actions enable row level security;
grant select on public.source_actions to authenticated;
create policy source_actions_read on public.source_actions for select to authenticated using(
 owner_id=auth.uid() or (project_id is not null and public.user_can_access_project(project_id) and
 (source_post_id is not null and public.can_read_post(source_post_id)))
);
create index source_actions_post_idx on public.source_actions(source_post_id);
create index source_actions_project_idx on public.source_actions(project_id);
create function public.create_source_action(p_id uuid,p_post_id uuid,p_message_id uuid,p_kind text,p_title text,p_project_id uuid default null,p_date timestamptz default null)
returns public.source_actions language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); result public.source_actions; target uuid:=p_project_id; object uuid; event_id uuid;
begin
 if me is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into result from public.source_actions where id=p_id and owner_id=me;
 if found then return result; end if;
 if num_nonnulls(p_post_id,p_message_id)<>1 or length(trim(p_title))=0 or length(p_title)>300 then raise exception 'Choose a source and title'; end if;
 if p_post_id is not null and not public.can_read_post(p_post_id) then raise exception 'Post unavailable'; end if;
 if p_message_id is not null and not exists(select 1 from public.dm_messages m join public.dm_thread_members t on t.thread_id=m.thread_id where m.id=p_message_id and t.user_id=me) then raise exception 'Message unavailable'; end if;
 -- Creating work in someone else's project requires a future explicit editor role.
 if target is not null and not exists(select 1 from public.projects where id=target and owner_id=me) then raise exception 'Choose a project you own'; end if;
 if p_kind='project' then
  insert into public.projects(owner_id,title,category,target_date) values(me,trim(p_title),'General',p_date::date) returning id into target;
 elsif p_kind in ('task','event') then
  if p_kind='event' and p_date is null then raise exception 'Choose an event date and time'; end if;
  if p_kind='event' then
   insert into public.calendar_events(owner_id,project_id,title,starts_at,ends_at) values(me,target,trim(p_title),p_date,p_date+interval '1 hour') returning id into event_id;
  end if;
  insert into public.coordination_objects(owner_id,source_table,source_id,kind,display_kind,title,intent,state,starts_at,ends_at,due_at,linked_project_id,flexibility)
  values(me,case when p_kind='event' then 'calendar_events' else null end,event_id,p_kind,p_kind,trim(p_title),case when p_kind='task' then 'deliver' else 'attend' end,
    case when p_date is null then 'pending' else 'scheduled' end,case when p_kind='event' then p_date end,case when p_kind='event' then p_date+interval '1 hour' end,case when p_kind='task' then p_date end,target,'shiftable') returning id into object;
 elsif p_kind<>'link' or target is null then raise exception 'Unknown action';
 end if;
 insert into public.source_actions(id,owner_id,source_post_id,source_message_id,project_id,object_id) values(p_id,me,p_post_id,p_message_id,target,object) returning * into result;
 return result;
end; $$;
revoke all on function public.create_source_action(uuid,uuid,uuid,text,text,uuid,timestamptz) from public,anon;
grant execute on function public.create_source_action(uuid,uuid,uuid,text,text,uuid,timestamptz) to authenticated;
-- Child records use the same audience as the post, including replies.
drop policy if exists post_media_read_visible_posts on public.post_media;
create policy post_media_read_visible_posts on public.post_media for select to authenticated using(public.can_read_post(post_id));
drop policy if exists post_topics_read_visible_posts on public.post_topics;
create policy post_topics_read_visible_posts on public.post_topics for select to authenticated using(public.can_read_post(post_id));
drop policy if exists post_engagements_read_visible_posts on public.post_engagements;
create policy post_engagements_read_visible_posts on public.post_engagements for select to authenticated using(public.can_read_post(post_id));
drop policy if exists post_label_flags_read_visible_posts on public.post_label_flags;
create policy post_label_flags_read_visible_posts on public.post_label_flags for select to authenticated using(public.can_read_post(post_id));

alter table public.dm_thread_members add column if not exists last_read_at timestamptz;
create policy dm_members_read_receipt on public.dm_thread_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- A dedicated RPC updates only the read receipt, not membership identity.
create function public.mark_dm_read(p_thread_id uuid) returns void language sql security definer set search_path='' as $$
 update public.dm_thread_members set last_read_at=now() where thread_id=p_thread_id and user_id=auth.uid();
$$;
revoke all on function public.mark_dm_read(uuid) from public,anon;
grant execute on function public.mark_dm_read(uuid) to authenticated;
drop policy dm_members_read_receipt on public.dm_thread_members;
create function public.dm_inbox() returns table(id uuid,title text,thread_kind text,linked_project_id uuid,created_at timestamptz,last_body text,last_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 select d.id, case when d.thread_kind='direct' then coalesce((select string_agg(coalesce(nullif(s.display_name,''),s.handle),', ') from public.dm_thread_members m join public.social_profiles s on s.id=m.user_id where m.thread_id=d.id and m.user_id<>auth.uid()),d.title) else d.title end,
 d.thread_kind,d.linked_project_id,d.created_at,
 (select body from public.dm_messages where thread_id=d.id order by created_at desc,id desc limit 1),
 coalesce((select max(created_at) from public.dm_messages where thread_id=d.id),d.created_at),
 (select count(*) from public.dm_messages msg where msg.thread_id=d.id and msg.author_id<>auth.uid() and msg.created_at>coalesce((select last_read_at from public.dm_thread_members where thread_id=d.id and user_id=auth.uid()),'-infinity'::timestamptz))
 from public.dm_threads d order by 7 desc;
$$;
revoke all on function public.dm_inbox() from public,anon;
grant execute on function public.dm_inbox() to authenticated;

create function public.invite_project_person(p_project uuid,p_handle text,p_role text default 'collaborator') returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); recipient public.social_profiles; project public.projects; result uuid;
begin
 select * into project from public.projects where id=p_project and owner_id=me;
 if not found then raise exception 'Only the project owner can invite people'; end if;
 select * into recipient from public.social_profiles where lower(handle)=lower(ltrim(trim(p_handle),'@'));
 if not found then raise exception 'No account has that username'; end if;
 if recipient.id=me or public.social_blocked(recipient.id) then raise exception 'Choose another person'; end if;
 if p_role not in ('collaborator','helper','guest','provider','viewer') then raise exception 'Choose a valid role'; end if;
 if exists(select 1 from public.project_participants where project_id=p_project and profile_id=recipient.id and status<>'declined') then raise exception 'This person is already invited'; end if;
 update public.project_participants set status='invited',role=p_role,contact_hint='@'||recipient.handle,name=coalesce(nullif(recipient.display_name,''),recipient.handle)
 where project_id=p_project and profile_id=recipient.id and status='declined' returning id into result;
 if result is null then
  insert into public.project_participants(owner_id,project_id,profile_id,name,contact_hint,role,status)
  values(me,p_project,recipient.id,coalesce(nullif(recipient.display_name,''),recipient.handle),'@'||recipient.handle,p_role,'invited') returning id into result;
 end if;
 insert into public.notifications(profile_id,title,body,kind,link_url) values(recipient.id,'Project invitation',project.title,'projects','/app/projects');
 return result;
end; $$;
revoke all on function public.invite_project_person(uuid,text,text) from public,anon;
grant execute on function public.invite_project_person(uuid,text,text) to authenticated;
create function public.project_invitations() returns table(id uuid,project_id uuid,title text,role text) language sql stable security definer set search_path='' as $$
 select p.id,p.project_id,j.title,p.role from public.project_participants p join public.projects j on j.id=p.project_id where p.profile_id=auth.uid() and p.status='invited';
$$;
create function public.respond_project_invitation(p_id uuid,p_accept boolean) returns void language sql security definer set search_path='' as $$
 update public.project_participants set status=case when p_accept then 'active' else 'declined' end where id=p_id and profile_id=auth.uid() and status='invited';
$$;
revoke all on function public.project_invitations(),public.respond_project_invitation(uuid,boolean) from public,anon;
grant execute on function public.project_invitations(),public.respond_project_invitation(uuid,boolean) to authenticated;

create table public.template_applications (
 id uuid primary key, owner_id uuid not null references public.profiles(id),
 template_id uuid, definition jsonb not null, anchor_date date not null,
 project_id uuid references public.projects(id) on delete set null, object_id uuid references public.coordination_objects(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.template_applications enable row level security;
grant select,insert on public.template_applications to authenticated;
create policy template_applications_own on public.template_applications for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create function public.apply_task_template(p_id uuid,p_template_id uuid,p_title text,p_blocks jsonb,p_anchor date,p_timezone text,p_project_id uuid default null,p_new_project boolean default false)
returns public.template_applications language plpgsql security invoker set search_path='' as $$
declare me uuid:=auth.uid(); result public.template_applications; target uuid:=p_project_id; parent uuid; block jsonb; step_id uuid; start_day date; end_day date; offset_days integer; duration integer;
begin
 if me is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into result from public.template_applications where id=p_id;
 if found then return result; end if;
 if p_anchor is null or length(trim(p_title))=0 or jsonb_typeof(p_blocks)<>'array' or jsonb_array_length(p_blocks) not between 1 and 200 then raise exception 'Choose a date and at least one step'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid time zone'; end if;
 if target is not null and not exists(select 1 from public.projects where id=target and owner_id=me) then raise exception 'Choose a project you own'; end if;
 if p_new_project then
  insert into public.projects(owner_id,title,category,target_date) values(me,trim(p_title),'General',p_anchor) returning id into target;
 end if;
 insert into public.coordination_objects(owner_id,kind,display_kind,title,intent,state,linked_project_id,flexibility)
 values(me,'workflow','plan',trim(p_title),'coordinate','active',target,'shiftable') returning id into parent;
 for block in select value from jsonb_array_elements(p_blocks) loop
  offset_days:=coalesce((block->>'offsetDays')::integer,0); duration:=coalesce((block->>'durationDays')::integer,1);
  if length(trim(coalesce(block->>'title','')))=0 or abs(offset_days)>3650 or duration not between 1 and 3650 then raise exception 'Invalid template step'; end if;
  start_day:=p_anchor+offset_days;end_day:=start_day+duration-1;
  insert into public.coordination_objects(owner_id,kind,display_kind,title,summary,intent,state,starts_at,ends_at,due_at,is_all_day,flexibility,parent_id,linked_project_id,metadata)
  values(me,case when block->>'displayKind'='event' then 'event' else 'task' end,case when block->>'displayKind'='event' then 'event' else 'task' end,
    block->>'title',block->'metadata'->>'summary','deliver','scheduled',start_day::timestamp at time zone p_timezone,
    (end_day+time '23:59:59') at time zone p_timezone,(end_day+time '17:00') at time zone p_timezone,true,'shiftable',parent,target,
    jsonb_build_object('templateApplicationId',p_id,'templateOffset',offset_days,'templateVersion',1,'lane',coalesce(block->>'lane','Tasks')))
  returning id into step_id;
 end loop;
 insert into public.template_applications(id,owner_id,template_id,definition,anchor_date,project_id,object_id) values(p_id,me,p_template_id,jsonb_build_object('version',1,'title',p_title,'blocks',p_blocks),p_anchor,target,parent) returning * into result;
 return result;
end; $$;
revoke all on function public.apply_task_template(uuid,uuid,text,jsonb,date,text,uuid,boolean) from public,anon;
grant execute on function public.apply_task_template(uuid,uuid,text,jsonb,date,text,uuid,boolean) to authenticated;

create function public.feed_post_ids(p_mode text default 'following',p_project uuid default null,p_author uuid default null,p_topic text default null,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 40,p_post uuid default null)
returns table(id uuid,sort_at timestamptz) language sql stable security invoker set search_path='' as $$
 with visible as (
  select p.id,greatest(p.created_at,coalesce((select max(e.created_at) from public.post_engagements e where e.post_id=p.id and e.reposted and (e.user_id=auth.uid() or exists(select 1 from public.social_follows f where f.follower_id=auth.uid() and f.followee_id=e.user_id))),p.created_at)) sort_at
  from public.posts p
  where (case when p_post is not null then p.id=p_post else p.reply_to_post_id is null end)
  and (p_project is null or p.linked_project_id=p_project) and (p_author is null or p.author_id=p_author)
  and (p_topic is null or exists(select 1 from public.post_topics pt join public.topics t on t.id=pt.topic_id where pt.post_id=p.id and t.slug=p_topic))
  and (p_post is not null or p_author is not null or not exists(select 1 from public.social_preferences s where s.user_id=auth.uid() and s.subject_id=p.author_id and (s.muted or s.blocked)))
  and (p_post is not null or p_project is not null or p_author is not null or p_topic is not null or p_mode='discover'
   or (p_mode='bookmarks' and exists(select 1 from public.post_engagements e where e.post_id=p.id and e.user_id=auth.uid() and e.bookmarked))
   or (p_mode='following' and (p.author_id=auth.uid() or exists(select 1 from public.social_follows f where f.follower_id=auth.uid() and f.followee_id=p.author_id)
     or exists(select 1 from public.post_engagements e where e.post_id=p.id and e.reposted and exists(select 1 from public.social_follows f where f.follower_id=auth.uid() and f.followee_id=e.user_id)))))
 ) select v.id,v.sort_at from visible v where p_before is null or (v.sort_at,v.id)<(p_before,p_before_id)
 order by v.sort_at desc,v.id desc limit least(greatest(p_limit,1),100);
$$;
revoke all on function public.feed_post_ids(text,uuid,uuid,text,timestamptz,uuid,integer,uuid) from public,anon;
grant execute on function public.feed_post_ids(text,uuid,uuid,text,timestamptz,uuid,integer,uuid) to authenticated;
create index if not exists posts_reply_idx on public.posts(reply_to_post_id);
create index if not exists posts_author_date_idx on public.posts(author_id,created_at desc,id desc);

create table public.availability_slots(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,owner_id uuid not null references public.profiles(id),starts_at timestamptz not null,ends_at timestamptz not null,check(ends_at>starts_at));
create table public.availability_votes(slot_id uuid not null references public.availability_slots(id) on delete cascade,profile_id uuid not null references public.profiles(id),answer text not null check(answer in ('yes','maybe','no')),primary key(slot_id,profile_id));
alter table public.availability_slots enable row level security;alter table public.availability_votes enable row level security;
grant select,insert,update,delete on public.availability_slots,public.availability_votes to authenticated;
create policy slots_read on public.availability_slots for select to authenticated using(public.user_can_access_project(project_id));
create policy slots_owner on public.availability_slots for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and exists(select 1 from public.projects where id=project_id and owner_id=auth.uid()));
create policy votes_read on public.availability_votes for select to authenticated using(exists(select 1 from public.availability_slots where id=slot_id));
create policy votes_own on public.availability_votes for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid() and exists(select 1 from public.availability_slots where id=slot_id));
create index availability_project_idx on public.availability_slots(project_id);
-- Accepted members can read the work attached to their project. Financial
-- records retain their owner-only policies.
create policy coordination_project_read on public.coordination_objects for select to authenticated using(linked_project_id is not null and public.user_can_access_project(linked_project_id));
create policy tasks_project_read on public.tasks for select to authenticated using(public.user_can_access_project(project_id));
create policy milestones_project_read on public.milestones for select to authenticated using(public.user_can_access_project(project_id));
create policy notes_project_read on public.project_notes for select to authenticated using(public.user_can_access_project(project_id));
create policy events_project_read on public.calendar_events for select to authenticated using(project_id is not null and public.user_can_access_project(project_id));

-- Existing project membership never grants access to private DM projections.
drop policy coordination_project_read on public.coordination_objects;
create policy coordination_project_read on public.coordination_objects for select to authenticated using(kind not in ('message','dm_thread') and linked_project_id is not null and public.user_can_access_project(linked_project_id));
-- All membership changes go through checked RPCs; owners cannot add a third
-- account to an existing direct conversation through the table API.
drop policy if exists dm_thread_members_write_owner on public.dm_thread_members;

create function public.check_project_invitation_acceptance() returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_id is not null and new.status='active' and auth.uid() is distinct from new.profile_id then
  if tg_op='INSERT' then raise exception 'The invited account must accept'; end if;
  if old.status<>'active' or new.profile_id is distinct from old.profile_id then raise exception 'The invited account must accept'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.check_project_invitation_acceptance() from public,anon,authenticated;
create trigger participants_acceptance before insert or update on public.project_participants for each row execute function public.check_project_invitation_acceptance();

-- A caller cannot insert work into an unrelated project by guessing its UUID.
create function public.check_coordination_project_access() returns trigger language plpgsql set search_path='' as $$
begin
 if new.linked_project_id is not null and not public.user_can_access_project(new.linked_project_id) then raise exception 'Project access required'; end if;
 if new.parent_id is not null and not exists(select 1 from public.coordination_objects p where p.id=new.parent_id and p.linked_project_id is not distinct from new.linked_project_id) then raise exception 'Parent task unavailable'; end if;
 return new;
end; $$;
revoke all on function public.check_coordination_project_access() from public,anon,authenticated;
create trigger coordination_project_access before insert or update of linked_project_id,parent_id on public.coordination_objects for each row execute function public.check_coordination_project_access();

-- Project tasks share their discussion with accepted members. Private message
-- projections retain their original, narrower permissions.
create policy coordination_messages_project_read on public.coordination_messages for select to authenticated using(exists(select 1 from public.coordination_objects o where o.id=coordination_object_id and o.kind not in ('message','dm_thread') and o.linked_project_id is not null and public.user_can_access_project(o.linked_project_id)));
create policy coordination_messages_project_insert on public.coordination_messages for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.coordination_objects o where o.id=coordination_object_id and o.kind not in ('message','dm_thread') and o.linked_project_id is not null and public.user_can_access_project(o.linked_project_id)));
-- Project association is also checked on events created outside the task UI.
create function public.check_calendar_project_access() returns trigger language plpgsql set search_path='' as $$
begin
 if new.project_id is not null and not public.user_can_access_project(new.project_id) then raise exception 'Project access required'; end if;
 return new;
end; $$;
revoke all on function public.check_calendar_project_access() from public,anon,authenticated;
create trigger calendar_project_access before insert or update of project_id on public.calendar_events for each row execute function public.check_calendar_project_access();

-- Delete the post itself and any legacy automatic projection, atomically.
-- Explicit tasks created from a conversation remain with an empty source link.
create function public.delete_own_post(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.posts where id=p_id and author_id=auth.uid()) then raise exception 'Post unavailable or not yours'; end if;
 delete from public.coordination_objects where source_table='posts' and source_id=p_id and owner_id=auth.uid();
 delete from public.posts where id=p_id and author_id=auth.uid();
end; $$;
revoke all on function public.delete_own_post(uuid) from public,anon;
grant execute on function public.delete_own_post(uuid) to authenticated;

-- Search each entity on the server, through its RLS policies, with a bounded
-- result set. Older matching posts are no longer limited to the first feed page.
create function public.search_flow(p_query text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with needle as (select lower(left(trim(coalesce(p_query,'')),200)) q)
 select jsonb_build_object(
 'people',coalesce((select jsonb_agg(row_to_json(x)) from (select id,handle,display_name from public.social_profiles,needle where position(ltrim(q,'@') in lower(coalesce(display_name,'')||' '||handle))>0 and not public.social_blocked(id) order by handle limit 20)x),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(row_to_json(x)) from (select id,slug,label from public.topics,needle where position(ltrim(q,'#') in lower(label||' '||slug))>0 order by label limit 20)x),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(row_to_json(x)) from (select id,title from public.projects,needle where position(q in lower(title))>0 order by title limit 20)x),'[]'::jsonb),
 'listings',coalesce((select jsonb_agg(row_to_json(x)) from (select id,title from public.marketplace_listings,needle where position(q in lower(title))>0 order by title limit 20)x),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(row_to_json(x)) from (select id,title from public.jobs,needle where position(q in lower(title))>0 order by title limit 20)x),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(row_to_json(x)) from ((select id,left(body,200) title,'post'::text kind from public.posts,needle where position(q in lower(body))>0 order by created_at desc limit 20) union all (select id,title,'dm'::text kind from public.dm_inbox(),needle where position(q in lower(title||' '||coalesce(last_body,'')))>0 limit 20))x),'[]'::jsonb)
 );
$$;
revoke all on function public.search_flow(text) from public,anon;
grant execute on function public.search_flow(text) to authenticated;

create index source_actions_message_idx on public.source_actions(source_message_id);
create index source_actions_object_idx on public.source_actions(object_id);
create index source_actions_owner_idx on public.source_actions(owner_id);
create index social_preferences_subject_idx on public.social_preferences(subject_id);
create index post_reports_post_idx on public.post_reports(post_id);
create index template_applications_owner_idx on public.template_applications(owner_id);
create index template_applications_project_idx on public.template_applications(project_id);
create index template_applications_object_idx on public.template_applications(object_id);
create index availability_slots_owner_idx on public.availability_slots(owner_id);
create index availability_votes_profile_idx on public.availability_votes(profile_id);
