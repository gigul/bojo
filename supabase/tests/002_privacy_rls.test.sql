-- RLS / location privacy (ARCHITECTURE §4.2, §8, §11.1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id::uuid, 'authenticated', 'authenticated', x.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from (values ('11111111-1111-4111-8111-111111111111', 't1@test.local'),
               ('22222222-2222-4222-8222-222222222222', 't2@test.local'),
               ('33333333-3333-4333-8333-333333333333', 't3@test.local'),
               ('44444444-4444-4444-8444-444444444444', 't4@test.local')) x(id, email);

update public.profiles set display_name = 'Tester ' || left(id::text, 1), onboarded_at = now()
 where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
              '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444');
insert into public.user_sports (user_id, sport_id, level) values
  ('11111111-1111-4111-8111-111111111111', 'football', 3), ('22222222-2222-4222-8222-222222222222', 'football', 4),
  ('33333333-3333-4333-8333-333333333333', 'football', 2), ('44444444-4444-4444-8444-444444444444', 'tennis', 2);

insert into public.venues (id, name, kind, location, source)
values ('99999999-9999-4999-8999-999999999999', 'Test pitch', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user');
insert into public.venue_sports (venue_id, sport_id) values ('99999999-9999-4999-8999-999999999999', 'football');

-- t1 organizes an event; t2 joins (event chat members: t1, t2). t3 is an outsider.
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total)
values ('eeeeeeee-0000-4000-8000-000000000001', 'football', '99999999-9999-4999-8999-999999999999',
        '11111111-1111-4111-8111-111111111111', now() + interval '1 day', now() + interval '1 day 90 minutes', 10);
insert into public.event_participants (event_id, user_id, status)
values ('eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'going');
select set_config('test.conv', (select c.id::text from public.conversations c
                                 where c.event_id = 'eeeeeeee-0000-4000-8000-000000000001'), true);

-- ---------------------------------------------------------------- set_home_location (t1)
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is((select district_key from public.set_home_location(52.19312, 21.02791)), 'mokotow',
          'set_home_location returns only the detected district (first change after onboarding is free)');
select is((select count(*)::int from information_schema.routines r
            where r.specific_schema = 'public' and r.routine_name = 'set_home_location'), 1, 'single set_home_location');
select ok(
  (select extensions.st_x(home_location::extensions.geometry) = 21.024
      and abs(extensions.st_y(home_location::extensions.geometry) - 52.195) < 1e-9
     from public.profile_private where user_id = '11111111-1111-4111-8111-111111111111'),
  'stored home point is snapped to the 0.005° × 0.008° grid (precise input never stored)');
select throws_ok($$select public.set_home_location(50.06, 19.94)$$, 'P0001', 'outside_service_area',
                 'home outside Warsaw service area is rejected');
select lives_ok($$select public.clear_home_location()$$, 'clear_home_location');
select throws_ok($$select public.set_home_location(52.22, 21.0)$$, 'P0001', 'rate_limited',
                 'second change within 7 days is rate limited (clear does not reset the limit)');
select is((select district_key from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'mokotow',
          'district auto-set from the first detected district');
reset role;  -- restore t1's home (cleared above) directly, as the server would have stored it
update public.profile_private set home_location = private.snap_home_point(52.22, 21.0)
 where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- t2 sets a home too
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok($$select public.set_home_location(52.2300, 21.0100)$$, 't2 sets a home location');

-- ---------------------------------------------------------------- profile_private is owner-only
select is((select count(*)::int from public.profile_private where user_id = '11111111-1111-4111-8111-111111111111'), 0,
          'profile_private of another user is not readable');
select is((select count(*)::int from public.profile_private), 1, 'only own profile_private row is visible');
select throws_ok($$update public.profile_private set home_location = null$$, '42501', null,
                 'home_location is not client-writable');

-- ---------------------------------------------------------------- no coordinates cross-user
select ok(
  pg_get_function_result('public.person_summary(uuid)'::regprocedure) !~* '(geograph|geometr|lat|lng|lon|home|location)'
  and pg_get_function_result('public.match_candidates(int, text)'::regprocedure) !~* '(geograph|geometr|lat|lng|lon|home|location)'
  and pg_get_function_result('public.event_participants_list(uuid)'::regprocedure) !~* '(geograph|geometr|lat|lng|lon|home|location)'
  and pg_get_function_result('public.my_conversations()'::regprocedure) !~* '(geograph|geometr|lat|lng|lon|home|location)'
  and pg_get_function_result('public.blocked_users()'::regprocedure) !~* '(geograph|geometr|lat|lng|lon|home|location)',
  'people-facing RPCs have no coordinate/location columns in their result types');
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and pg_get_function_result(p.oid) ~* '(geography|geometry)'),
  'no public RPC returns a geography/geometry value');

-- t2 → person_summary(t1): distance only as a bucket
select ok((select distance_km_approx in (3,5,10,15,25)
             from public.person_summary('11111111-1111-4111-8111-111111111111')),
          'person_summary exposes distance only as a bucket');
select is((select district_key from public.person_summary('11111111-1111-4111-8111-111111111111')), 'mokotow',
          'person_summary exposes the district');

-- match_candidates (t2 sees t1/t3 with bucketed distance; t4 has no common sport)
select ok((select bool_and(distance_km_approx is null or distance_km_approx in (3,5,10,15,25))
             from public.match_candidates(20, null)),
          'match_candidates exposes distance only as a bucket');
select is((select count(*)::int from public.match_candidates(20, null)
            where user_id = '44444444-4444-4444-8444-444444444444'), 0,
          'match_candidates requires a common sport');

-- ---------------------------------------------------------------- messages / membership
select lives_ok($$insert into public.messages (id, conversation_id, body)
                  select 'bbbbbbbb-0000-4000-8000-000000000001', c.id, 'hello from t2'
                    from public.conversations c where c.event_id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
                'a going participant can post to the event chat');
select throws_ok($$insert into public.messages (conversation_id, body, kind)
                   values (current_setting('test.conv')::uuid, 'x', 'system')$$,
                 '42501', null, 'clients cannot insert system messages (kind not granted)');

-- outsider t3
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is((select count(*)::int from public.messages m
            join public.conversations c on c.id = m.conversation_id
           where c.event_id = 'eeeeeeee-0000-4000-8000-000000000001'), 0,
          'a non-member cannot read messages');
select throws_ok($$insert into public.messages (conversation_id, body)
                   values (current_setting('test.conv')::uuid, 'intrusion')$$,
                 '42501', null, 'a non-member cannot post (conversation invisible → RLS violation)');
select is((select count(*)::int from public.event_participants
            where event_id = 'eeeeeeee-0000-4000-8000-000000000001'), 0,
          'others'' participant rows are not directly readable');

-- t1 (organizer) sees t2's message, then blocks t2 → t2's messages become invisible to t1
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.messages where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1,
          'member sees the message before blocking');
select lives_ok($$select public.block_user('22222222-2222-4222-8222-222222222222')$$, 't1 blocks t2');
select is((select count(*)::int from public.messages where sender_id = '22222222-2222-4222-8222-222222222222'), 0,
          'a blocked user''s messages are invisible');
select throws_ok($$select * from public.person_summary('22222222-2222-4222-8222-222222222222')$$, 'P0001', 'not_found',
                 'blocked users are reported as not_found');

reset role;
select * from finish();
rollback;
