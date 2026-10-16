-- participants_preview on event cards + common_slots on person cards (migration 20261015000018).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('51000000-0000-4000-8000-00000000000' || n)::uuid, 'authenticated',
       'authenticated', 'p' || n || '@test.local', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from generate_series(1, 6) n;
update public.profiles set display_name = 'Player ' || right(id::text, 1), onboarded_at = now(),
       avatar_path = id::text || '/a.jpg'
 where id::text like '51000000-%';
insert into public.user_sports (user_id, sport_id, level)
select id, 'football', 3 from public.profiles where id::text like '51000000-%';

-- availability: p1 Tue+Thu evening, Sat morning; p2 Mon morning, Tue evening, Thu evening, Sun afternoon; p3 Fri morning
insert into public.availability_slots (user_id, weekday, day_part) values
  ('51000000-0000-4000-8000-000000000001', 4, 'evening'), ('51000000-0000-4000-8000-000000000001', 2, 'evening'),
  ('51000000-0000-4000-8000-000000000001', 6, 'morning'),
  ('51000000-0000-4000-8000-000000000002', 1, 'morning'), ('51000000-0000-4000-8000-000000000002', 4, 'evening'),
  ('51000000-0000-4000-8000-000000000002', 2, 'evening'), ('51000000-0000-4000-8000-000000000002', 7, 'afternoon'),
  ('51000000-0000-4000-8000-000000000003', 5, 'morning');

insert into public.venues (id, name, kind, location, source)
values ('59999999-9999-4999-8999-999999999999', 'Preview pitch', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user');
insert into public.venue_sports (venue_id, sport_id) values ('59999999-9999-4999-8999-999999999999', 'football');

-- p2 organizes; p3, p1, p4, p5, p6 join in that order (joined_at strictly increasing)
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total)
values ('5eeeeeee-0000-4000-8000-000000000001', 'football', '59999999-9999-4999-8999-999999999999',
        '51000000-0000-4000-8000-000000000002', now() + interval '1 day', now() + interval '1 day 90 minutes', 10);
insert into public.event_participants (event_id, user_id, status, joined_at)
select '5eeeeeee-0000-4000-8000-000000000001', ('51000000-0000-4000-8000-00000000000' || x.n)::uuid, 'going',
       now() + make_interval(secs => x.ord)
  from (values (3, 1), (1, 2), (4, 3), (5, 4), (6, 5)) x(n, ord);

-- ---------------------------------------------------------------- participants_preview (authenticated p1)
set local role authenticated;
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select jsonb_array_length(participants_preview) from public.events_feed(p_date_range := 'week')
            where id = '5eeeeeee-0000-4000-8000-000000000001'), 4, 'preview is limited to 4 of 6 going');
select is((select participants_preview -> 0 ->> 'user_id' from public.events_feed(p_date_range := 'week')
            where id = '5eeeeeee-0000-4000-8000-000000000001'), '51000000-0000-4000-8000-000000000002',
          'organizer comes first');
select is((select array(select x ->> 'user_id' from jsonb_array_elements(participants_preview) x)
             from public.events_feed(p_date_range := 'week') where id = '5eeeeeee-0000-4000-8000-000000000001'),
          array['51000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000003',
                '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004'],
          'then participants by joined_at');
select is((select array(select k from jsonb_object_keys(participants_preview -> 0) k order by k)
             from public.events_feed(p_date_range := 'week') where id = '5eeeeeee-0000-4000-8000-000000000001'),
          array['avatar_path', 'display_name', 'user_id'], 'preview objects carry only user_id, display_name, avatar_path');
select is((select jsonb_array_length(participants_preview) from public.event_detail('5eeeeeee-0000-4000-8000-000000000001')), 4,
          'event_detail has the preview');
select is((select jsonb_array_length(participants_preview) from public.my_events('upcoming')
            where id = '5eeeeeee-0000-4000-8000-000000000001'), 4, 'my_events has the preview');

-- p1 blocks p3 → p3 disappears from p1's preview (p5 moves in)
select lives_ok($$select public.block_user('51000000-0000-4000-8000-000000000003')$$, 'p1 blocks p3');
select ok((select not (participants_preview @> '[{"user_id":"51000000-0000-4000-8000-000000000003"}]'::jsonb)
             from public.events_feed(p_date_range := 'week') where id = '5eeeeeee-0000-4000-8000-000000000001'),
          'a blocked user is absent from the preview');
select is((select array(select x ->> 'user_id' from jsonb_array_elements(participants_preview) x)
             from public.event_detail('5eeeeeee-0000-4000-8000-000000000001')),
          array['51000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001',
                '51000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000005'],
          'blocked user excluded from event_detail preview too');

-- p3's own view still contains p3 (the block hides p1 instead)
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}';
select ok((select participants_preview @> '[{"user_id":"51000000-0000-4000-8000-000000000003"}]'::jsonb
              and not (participants_preview @> '[{"user_id":"51000000-0000-4000-8000-000000000001"}]'::jsonb)
             from public.event_detail('5eeeeeee-0000-4000-8000-000000000001')),
          'blocking is symmetric for the preview');

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.events_feed(p_date_range := 'week')
            where id = '5eeeeeee-0000-4000-8000-000000000001' and participants_preview is null
              and spots_taken = 6), 1, 'anon feed: participants_preview is NULL (counts still present)');
select is((select participants_preview from public.event_detail('5eeeeeee-0000-4000-8000-000000000001')), null::jsonb,
          'anon event_detail: participants_preview is NULL');
reset role;

-- ---------------------------------------------------------------- common_slots
set local role authenticated;
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select common_slots from public.person_summary('51000000-0000-4000-8000-000000000002')),
          array['2:evening', '4:evening'], 'person_summary.common_slots = sorted intersection');
select is((select common_slots from public.match_candidates(50, null) where user_id = '51000000-0000-4000-8000-000000000002'),
          array['2:evening', '4:evening'], 'match_candidates.common_slots = sorted intersection');
select ok((select not (common_slots && array['1:morning', '7:afternoon', '6:morning'])
             from public.person_summary('51000000-0000-4000-8000-000000000002')),
          'neither the target''s nor the caller''s non-overlapping slots are returned');
select is((select common_slots from public.match_candidates(50, null) where user_id = '51000000-0000-4000-8000-000000000004'),
          '{}'::text[], 'no availability on one side → empty array');
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select common_slots from public.person_summary('51000000-0000-4000-8000-000000000001')),
          array['2:evening', '4:evening'], 'symmetric from the other side');
select ok(pg_get_function_result('public.match_candidates(int, text)'::regprocedure) ~ 'common_slots text\[\]'
          and pg_get_function_result('public.person_summary(uuid)'::regprocedure) ~ 'common_slots text\[\]',
          'common_slots is text[] in both RPC result types');

reset role;
select * from finish();
rollback;
