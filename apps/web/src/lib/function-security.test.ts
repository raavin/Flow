// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
const db = new PGlite()
const me = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const item = '00000000-0000-0000-0000-000000000003'
beforeAll(async () => {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 create table dm_thread_members(thread_id uuid,user_id uuid);
 create table coordination_object_participants(coordination_object_id uuid,profile_id uuid);
 create table calendar_event_guests(event_id uuid,profile_id uuid);
 create table calendar_events(id uuid,owner_id uuid);
 create function public.verify_integration_api_key(text) returns text language sql security definer as $$ select $1 $$;
 create function public.client_action() returns int language sql security definer as $$ select 42 $$;
 create function public.internal_trigger() returns trigger language plpgsql security definer as $$ begin return new; end $$;
 create function public.next_order_number() returns text language sql as $$ select 'order'::text $$;
 `)
 for (const name of ['handle_profile_updated_at','handle_social_profile_defaults','touch_coordination_updated_at','handle_updated_at','set_updated_at']) {
  await db.exec(`create function public.${name}() returns trigger language plpgsql as $$ begin return new; end $$;`)
 }
 await db.exec(readFileSync(new URL('../../../../supabase/migrations/20261126021445_harden_function_access.sql',import.meta.url),'utf8'))
 await db.exec(`insert into dm_thread_members values('${item}','${me}'); insert into calendar_event_guests values('${item}','${me}'); insert into calendar_events values('${item}','${me}'); insert into coordination_object_participants values('${item}','${me}');`)
},30000)
afterAll(()=>db.close())
it('blocks anonymous privileged calls and reserves key verification for the server',async()=>{
 await db.exec('set role anon')
 await expect(db.query('select client_action()')).rejects.toThrow(/permission denied/)
 await db.exec('reset role; set role authenticated')
 expect((await db.query('select client_action() as result')).rows).toEqual([{result:42}])
 await expect(db.query("select verify_integration_api_key('secret')")).rejects.toThrow(/permission denied/)
 await db.exec('reset role; set role service_role')
 expect((await db.query("select verify_integration_api_key('test') as result")).rows).toEqual([{result:'test'}])
 await db.exec('reset role')
})
it('allows own membership checks but blocks probing another user',async()=>{
 await db.exec('set role authenticated')
 for (const name of ['is_dm_thread_member','is_coordination_participant','is_calendar_event_guest','is_calendar_event_owner']) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[me])
  expect((await db.query(`select ${name}($1,$2) as allowed`,[item,me])).rows).toEqual([{allowed:true}])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other])
  expect((await db.query(`select ${name}($1,$2) as allowed`,[item,me])).rows).toEqual([{allowed:false}])
 }
 await db.exec('reset role')
})
it('removes direct trigger access and fixes mutable search paths',async()=>{
 const result=await db.query("select has_function_privilege('authenticated','internal_trigger()','execute') as exposed, proconfig from pg_proc where proname='handle_updated_at'")
 expect(result.rows).toEqual([{exposed:false,proconfig:['search_path=""']}])
})
