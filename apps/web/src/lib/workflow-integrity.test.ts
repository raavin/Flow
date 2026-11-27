// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
const db = new PGlite()
const a = '00000000-0000-0000-0000-000000000001',
  b = '00000000-0000-0000-0000-000000000002',
  c = '00000000-0000-0000-0000-000000000003'
const post = '10000000-0000-0000-0000-000000000001',
  project = '20000000-0000-0000-0000-000000000001'
async function as(user: string) {
  await db.exec('reset role')
  await db.query<Record<string, unknown>>("select set_config('request.jwt.claim.sub',$1,false)", [user])
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated,anon;
 create table profiles(id uuid primary key);
 create table social_profiles(id uuid primary key references profiles,handle text,display_name text);
 create table projects(id uuid primary key default gen_random_uuid(),owner_id uuid,title text,category text,target_date date);
 create table project_participants(id uuid primary key default gen_random_uuid(),project_id uuid,owner_id uuid,name text,contact_hint text,role text,status text);
 create table posts(id uuid primary key default gen_random_uuid(),author_id uuid,body text,visibility text,reply_to_post_id uuid,linked_project_id uuid,is_promoted boolean default false,created_at timestamptz default now());
 create table social_follows(follower_id uuid,followee_id uuid);
 create table dm_threads(id uuid primary key default gen_random_uuid(),owner_id uuid,title text,thread_kind text,linked_project_id uuid,created_at timestamptz default now());
 create table dm_thread_members(thread_id uuid,user_id uuid,primary key(thread_id,user_id));
 create table dm_messages(id uuid primary key default gen_random_uuid(),thread_id uuid,author_id uuid,body text,created_at timestamptz default now());
 create table calendar_events(id uuid primary key default gen_random_uuid(),owner_id uuid,project_id uuid,title text,starts_at timestamptz,ends_at timestamptz);
 create table coordination_objects(parent_id uuid,summary text,metadata jsonb,is_all_day boolean,id uuid primary key default gen_random_uuid(),owner_id uuid,source_table text,source_id uuid,kind text,display_kind text,title text,intent text,state text,starts_at timestamptz,ends_at timestamptz,due_at timestamptz,linked_project_id uuid,flexibility text);
 create table coordination_messages(coordination_object_id uuid,author_id uuid,body text);
 create table tasks(project_id uuid);create table milestones(project_id uuid);create table project_notes(project_id uuid);
 create table notifications(profile_id uuid,title text,body text,kind text,link_url text);
 create table post_media(post_id uuid);create table post_topics(post_id uuid,topic_id uuid);create table topics(id uuid,slug text,label text);create table marketplace_listings(id uuid,title text);create table jobs(id uuid,title text);create table post_engagements(post_id uuid,user_id uuid,reposted boolean,bookmarked boolean,created_at timestamptz);create table post_label_flags(post_id uuid);
 alter table coordination_objects enable row level security;alter table coordination_messages enable row level security;create policy coordination_owner on coordination_objects for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 alter table posts enable row level security; alter table projects enable row level security; alter table project_participants enable row level security;
 create policy projects_owner on projects for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 grant select,insert,update,delete on all tables in schema public to authenticated;
 `)
  await db.exec(
    readFileSync(
      new URL(
        '../../../../supabase/migrations/20261127031320_social_workflow_integrity.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await db.query<Record<string, unknown>>('insert into profiles values($1),($2),($3)', [a, b, c])
  await db.query<Record<string, unknown>>(
    "insert into social_profiles values($1,'alice','Alice'),($2,'bob','Bob'),($3,'carol','Carol')",
    [a, b, c],
  )
  await db.query<Record<string, unknown>>("insert into projects(id,owner_id,title) values($1,$2,'Party')", [
    project,
    a,
  ])
  await as(a)
  await db.query<Record<string, unknown>>(
    "insert into posts(id,author_id,body,visibility) values($1,$2,'Private followers discussion','followers')",
    [post, a],
  )
  await db.exec('reset role')
  await db.query<Record<string, unknown>>('insert into social_follows values($1,$2)', [b, a])
}, 30000)
afterAll(() => db.close())
it('inherits a parent audience and blocks publishing replies to unrelated followers', async () => {
  await as(b)
  const r = await db.query<Record<string, unknown>>(
    "insert into posts(author_id,body,visibility,reply_to_post_id) values($1,'Reply','public',$2) returning id,visibility",
    [b, post],
  )
  expect(r.rows[0].visibility).toBe('followers')
  await as(c)
  expect((await db.query<Record<string, unknown>>('select id from posts')).rows).toEqual([])
  await expect(
    db.query<Record<string, unknown>>(
      "insert into posts(author_id,body,reply_to_post_id) values($1,'Leak',$2)",
      [c, post],
    ),
  ).rejects.toThrow('unavailable')
  await as(a)
  expect((await db.query<Record<string, unknown>>('select id from posts')).rows.length).toBe(2)
})
it('reuses direct threads by member IDs even if names or titles change', async () => {
  await as(a)
  const x = await db.query<Record<string, unknown>>(
    "select id from create_dm_thread('Bob','direct',null,array[$1::uuid])",
    [b],
  )
  await as(b)
  const y = await db.query<Record<string, unknown>>(
    "select id from create_dm_thread('Alice renamed','direct',null,array[$1::uuid])",
    [a],
  )
  expect(y.rows[0].id).toBe(x.rows[0].id)
  await expect(
    db.query<Record<string, unknown>>(
      "select * from create_dm_thread('Bad','direct',null,array[$1::uuid,$2::uuid])",
      [a, c],
    ),
  ).rejects.toThrow('one recipient')
})
it('creates optional tasks atomically and does not duplicate on retry or edit the source', async () => {
  const id = '30000000-0000-0000-0000-000000000001'
  await as(b)
  const args = [id, post]
  const x = await db.query<Record<string, unknown>>(
    "select * from create_source_action($1,$2,null,'task','Buy food',null,null)",
    args,
  )
  const y = await db.query<Record<string, unknown>>(
    "select * from create_source_action($1,$2,null,'task','Buy food',null,null)",
    args,
  )
  expect(x.rows[0].object_id).toBe(y.rows[0].object_id)
  expect(
    (
      await db.query<Record<string, unknown>>('select visibility,linked_project_id from posts where id=$1', [
        post,
      ])
    ).rows,
  ).toEqual([{ visibility: 'followers', linked_project_id: null }])
  await expect(
    db.query<Record<string, unknown>>(
      "select * from create_source_action(gen_random_uuid(),$1,null,'task','Other project',$2,null)",
      [post, project],
    ),
  ).rejects.toThrow('own')
})
it('invites the actual account and requires acceptance; renaming cannot transfer membership', async () => {
  await as(a)
  const invite = await db.query<Record<string, unknown>>(
    "select invite_project_person($1,'@bob','viewer') id",
    [project],
  )
  await as(b)
  expect(
    (await db.query<Record<string, unknown>>('select user_can_access_project($1) allowed', [project])).rows,
  ).toEqual([{ allowed: false }])
  await db.query<Record<string, unknown>>('select respond_project_invitation($1,true)', [invite.rows[0].id])
  expect(
    (await db.query<Record<string, unknown>>('select user_can_access_project($1) allowed', [project])).rows,
  ).toEqual([{ allowed: true }])
  await db.exec('reset role')
  await db.query<Record<string, unknown>>("update social_profiles set handle='new-bob' where id=$1", [b])
  await db.query<Record<string, unknown>>("update social_profiles set handle='bob' where id=$1", [c])
  await as(c)
  expect(
    (await db.query<Record<string, unknown>>('select user_can_access_project($1) allowed', [project])).rows,
  ).toEqual([{ allowed: false }])
  await as(b)
  expect(
    (await db.query<Record<string, unknown>>('select user_can_access_project($1) allowed', [project])).rows,
  ).toEqual([{ allowed: true }])
})
it('blocks posts and new messages in both directions', async () => {
  await as(c)
  await db.query<Record<string, unknown>>(
    'insert into social_preferences(user_id,subject_id,blocked) values($1,$2,true)',
    [c, a],
  )
  await as(a)
  await expect(
    db.query<Record<string, unknown>>(
      "select * from create_dm_thread('Carol','direct',null,array[$1::uuid])",
      [c],
    ),
  ).rejects.toThrow('unavailable')
  await as(c)
  expect((await db.query<Record<string, unknown>>('select can_read_post($1) allowed', [post])).rows).toEqual([
    { allowed: false },
  ])
})
it('denies anonymous calls to private workflow APIs', async () => {
  await db.exec('reset role;set role anon')
  await expect(db.query<Record<string, unknown>>('select project_invitations()')).rejects.toThrow(
    /permission denied/,
  )
  await expect(db.query<Record<string, unknown>>('select can_read_post($1)', [post])).rejects.toThrow(
    /permission denied/,
  )
  await db.exec('reset role')
})
it('applies a chosen template atomically with local dates and duplicate-safe retries', async () => {
  await as(a)
  const id = '40000000-0000-0000-0000-000000000001'
  const template = '40000000-0000-0000-0000-000000000002'
  const blocks = JSON.stringify([
    {
      title: 'Buy present',
      offsetDays: -7,
      durationDays: 1,
      displayKind: 'task',
    },
    { title: 'Party', offsetDays: 0, durationDays: 1, displayKind: 'event' },
  ])
  const result = await db.query<Record<string, unknown>>(
    "select * from apply_task_template($1,$2,'Birthday',$3,'2027-01-02','Australia/Melbourne',null,true)",
    [id, template, blocks],
  )
  const retry = await db.query<Record<string, unknown>>(
    "select * from apply_task_template($1,$2,'Birthday',$3,'2027-01-02','Australia/Melbourne',null,true)",
    [id, template, blocks],
  )
  expect(retry.rows[0].project_id).toBe(result.rows[0].project_id)
  const rows = await db.query(
    "select title,(starts_at at time zone 'Australia/Melbourne')::date::text as date_value from coordination_objects where parent_id=$1 order by starts_at",
    [result.rows[0].object_id],
  )
  expect(rows.rows).toEqual([
    { title: 'Buy present', date_value: '2026-12-26' },
    { title: 'Party', date_value: '2027-01-02' },
  ])
  const before = (await db.query('select count(*) n from projects')).rows
  await expect(
    db.query(
      "select * from apply_task_template(gen_random_uuid(),$1,'Bad','[{\"title\":\"\",\"offsetDays\":0}]','2027-01-02','Australia/Melbourne',null,true)",
      [template],
    ),
  ).rejects.toThrow('Invalid template step')
  expect((await db.query('select count(*) n from projects')).rows).toEqual(before)
})
it('paginates Following by stable activity and id rather than loading the entire feed', async () => {
  await as(a)
  for (let i = 0; i < 3; i++)
    await db.query(
      "insert into posts(author_id,body,visibility,created_at) values($1,'Public','public','2026-11-27T12:00:00Z')",
      [a],
    )
  const first = await db.query<{ id: string; sort_at: string }>(
    "select * from feed_post_ids('following',null,null,null,null,null,2,null)",
  )
  const next = await db.query<{ id: string; sort_at: string }>(
    "select * from feed_post_ids('following',null,null,null,$1,$2,2,null)",
    [first.rows[1].sort_at, first.rows[1].id],
  )
  expect(first.rows).toHaveLength(2)
  expect(next.rows).toHaveLength(2)
  expect(new Set([...first.rows, ...next.rows].map((r) => r.id)).size).toBe(4)
})

it('requires the invited account to accept and rejects guessed project links', async () => {
  await as(a)
  await expect(
    db.query(
      "insert into project_participants(project_id,owner_id,profile_id,name,status) values($1,$2,$3,'Carol','active')",
      [project, a, c],
    ),
  ).rejects.toThrow('must accept')
  await as(c)
  await expect(
    db.query("insert into coordination_objects(owner_id,title,linked_project_id) values($1,'Unrelated',$2)", [
      c,
      project,
    ]),
  ).rejects.toThrow('Project access required')
  await expect(
    db.query("insert into calendar_events(owner_id,title,project_id) values($1,'Unrelated',$2)", [
      c,
      project,
    ]),
  ).rejects.toThrow('Project access required')
})

it('deletes the owned post, preserves an explicit task and rejects another author', async () => {
  await as(a)
  const row = await db.query<{ id: string }>(
    "insert into posts(author_id,body,visibility) values($1,'Delete me','public') returning id",
    [a],
  )
  const id = row.rows[0].id
  const task = await db.query<{ object_id: string }>(
    "select * from create_source_action(gen_random_uuid(),$1,null,'task','Keep task',null,null)",
    [id],
  )
  await as(b)
  await expect(db.query('select delete_own_post($1)', [id])).rejects.toThrow('not yours')
  await as(a)
  await db.query('select delete_own_post($1)', [id])
  expect((await db.query('select id from posts where id=$1', [id])).rows).toEqual([])
  expect(
    (await db.query('select id from coordination_objects where id=$1', [task.rows[0].object_id])).rows,
  ).toHaveLength(1)
  expect(
    (await db.query('select source_post_id from source_actions where object_id=$1', [task.rows[0].object_id]))
      .rows,
  ).toEqual([{ source_post_id: null }])
})

it('searches older matching posts while keeping private conversations out of results', async () => {
  await as(a)
  await db.query(
    "insert into posts(author_id,body,visibility,created_at) values($1,'Old searchable memory','public','2020-01-01')",
    [a],
  )
  await as(b)
  const result = await db.query<{ data: { messages: { title: string }[] } }>(
    "select search_flow('searchable') data",
  )
  expect(result.rows[0].data.messages.map((m) => m.title)).toContain('Old searchable memory')
  await as(c)
  const hidden = await db.query<{ data: { messages: unknown[] } }>(
    "select search_flow('Private followers discussion') data",
  )
  expect(hidden.rows[0].data.messages).toEqual([])
})

it('shares task discussions with accepted members without exposing old DM projections', async () => {
  await as(a)
  const normal = await db.query<{ id: string }>(
    "insert into coordination_objects(owner_id,title,kind,linked_project_id) values($1,'Shared task','task',$2) returning id",
    [a, project],
  )
  const privateItem = await db.query<{ id: string }>(
    "insert into coordination_objects(owner_id,title,kind,linked_project_id) values($1,'Private DM','dm_thread',$2) returning id",
    [a, project],
  )
  await as(b)
  expect(
    (await db.query('select id from coordination_objects where id=$1', [normal.rows[0].id])).rows,
  ).toHaveLength(1)
  expect(
    (await db.query('select id from coordination_objects where id=$1', [privateItem.rows[0].id])).rows,
  ).toEqual([])
  await db.query(
    "insert into coordination_messages(coordination_object_id,author_id,body) values($1,$2,'Comment')",
    [normal.rows[0].id, b],
  )
  await expect(
    db.query(
      "insert into coordination_messages(coordination_object_id,author_id,body) values($1,$2,'Guess')",
      [privateItem.rows[0].id, b],
    ),
  ).rejects.toThrow(/row-level security/)
})
