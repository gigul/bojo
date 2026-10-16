-- Privileges, RLS coverage, anon access, realtime publication (ARCHITECTURE §4, §7, §11.1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------- structure
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'RLS is enabled on every table in public');

select is(
  (select array_agg(t.table_name::text order by t.table_name) from (
     select distinct table_name from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public') t),
  array['districts', 'sports', 'venue_sports'],
  'anon has table privileges only on the reference tables');

select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and table_name = 'districts'),
  array['SELECT'], 'anon privilege on reference tables is SELECT only');

select is(
  (select array_agg(tablename::text order by tablename) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'),
  array['events', 'messages', 'notifications'],
  'realtime publishes exactly messages, events, notifications');

select ok(
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = 'public'
                 and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
                 and table_name not in ('runner_profiles', 'runs', 'venue_photos')),
  'authenticated has no table-level write privileges outside runner_profiles/runs/venue_photos');

select ok(
  not exists (select 1 from information_schema.column_privileges
               where grantee = 'authenticated' and table_schema = 'public' and table_name = 'events'
                 and privilege_type in ('INSERT', 'UPDATE')),
  'authenticated cannot insert/update any column of events (incl. spots_taken)');

select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and table_name = 'messages'
      and privilege_type = 'INSERT'),
  array['body', 'conversation_id', 'id'],
  'messages INSERT is limited to (id, conversation_id, body)');

select ok(
  not exists (select 1 from information_schema.column_privileges
               where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profile_private'
                 and privilege_type in ('UPDATE', 'INSERT') and column_name like 'home_location%'),
  'home_location* columns are not client-writable');

select ok(
  not exists (select 1 from information_schema.column_privileges
               where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profiles'
                 and privilege_type = 'UPDATE'
                 and column_name in ('is_verified', 'attended_count', 'no_show_count', 'reliability_score',
                                     'onboarded_at', 'is_mock', 'id', 'created_at')),
  'server-only profile columns are not client-updatable');

select ok(
  not has_function_privilege('authenticated', 'public.claim_push_batch(uuid[], int)', 'execute')
  and not has_function_privilege('anon', 'public.complete_push_batch(jsonb, text[])', 'execute')
  and has_function_privilege('service_role', 'public.claim_push_batch(uuid[], int)', 'execute'),
  'push batch RPCs are service_role only');

select ok(
  has_function_privilege('anon', 'public.venues_in_bbox(float8, float8, float8, float8, text[], int)', 'execute')
  and has_function_privilege('anon', 'public.events_feed(float8, float8, float8, text[], text, text, uuid, boolean, int, timestamptz, uuid)', 'execute')
  and has_function_privilege('anon', 'public.event_detail(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.join_event(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.person_summary(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.match_candidates(int, text)', 'execute'),
  'anon can execute only the anon-callable RPCs');

select ok(
  not has_function_privilege('anon', 'private.snap_home_point(float8, float8)', 'execute')
  and not has_function_privilege('authenticated', 'private.snap_home_point(float8, float8)', 'execute')
  and not has_function_privilege('authenticated', 'private.cancel_event_internal(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.complete_past_events()', 'execute'),
  'private helpers/cron functions are not executable by clients');

select ok(
  (select bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not like 'st\_%' and p.proname not like 'postgis%'),
  'every public function is SECURITY DEFINER');

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'private') and p.prosecdef
                 and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'every SECURITY DEFINER function pins search_path');

select ok(
  not exists (select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' group by proname having count(*) > 1),
  'no public function is overloaded');

-- ---------------------------------------------------------------- anon behaviour
set local role anon;
select throws_ok('select 1 from public.profiles limit 1', '42501', null, 'anon cannot select profiles');
select throws_ok('select 1 from public.messages limit 1', '42501', null, 'anon cannot select messages');
select throws_ok('select 1 from public.event_participants limit 1', '42501', null, 'anon cannot select event_participants');
select throws_ok('select 1 from public.profile_private limit 1', '42501', null, 'anon cannot select profile_private');
select throws_ok('select 1 from public.events limit 1', '42501', null, 'anon cannot select events directly');
select throws_ok('select 1 from public.notifications limit 1', '42501', null, 'anon cannot select notifications');
select lives_ok('select count(*) from public.districts, public.sports', 'anon can read districts and sports');
select lives_ok('select * from public.venues_in_bbox(20.9, 52.1, 21.1, 52.3, null, 10)', 'anon can call venues_in_bbox');
select throws_ok($$select public.join_event('00000000-0000-4000-8000-000000000000')$$, '42501', null,
                 'anon cannot call join_event');
reset role;

select * from finish();
rollback;
