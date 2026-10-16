-- Events, joining, matching and chat RPC behaviour (ARCHITECTURE §5.2–§5.6, §11.1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id::uuid, 'authenticated', 'authenticated', x.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from (values ('11111111-1111-4111-8111-111111111111', 't1@test.local'),
               ('22222222-2222-4222-8222-222222222222', 't2@test.local'),
               ('33333333-3333-4333-8333-333333333333', 't3@test.local'),
               ('44444444-4444-4444-8444-444444444444', 't4@test.local')) x(id, email);
insert into public.venues (id, name, kind, location, source)
values ('99999999-9999-4999-8999-999999999999', 'Test pitch', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user');
insert into public.venue_sports (venue_id, sport_id) values ('99999999-9999-4999-8999-999999999999', 'football');

-- ---------------------------------------------------------------- onboarding (t1)
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok($$select * from public.create_event('football', '99999999-9999-4999-8999-999999999999', now() + interval '1 day')$$,
                 'P0001', 'profile_incomplete', 'create_event requires onboarding');
select throws_ok($$select public.complete_onboarding()$$, 'P0001', 'profile_incomplete', 'onboarding needs name + sport');
update public.profiles set display_name = 'Tester One' where id = '11111111-1111-4111-8111-111111111111';
select throws_ok($$select public.set_user_sports('[{"sport_id":"curling","level":3}]')$$, 'P0001', 'invalid_input',
                 'unknown sport rejected');
select lives_ok($$select public.set_user_sports('[{"sport_id":"football","level":3},{"sport_id":"tennis","level":2}]')$$,
                'set_user_sports');
select lives_ok($$select public.set_availability('[{"weekday":2,"day_part":"evening"},{"weekday":4,"day_part":"evening"}]')$$,
                'set_availability');
select lives_ok($$select public.complete_onboarding()$$, 'complete_onboarding');
select throws_ok($$update public.profiles set is_verified = true where id = '11111111-1111-4111-8111-111111111111'$$,
                 '42501', null, 'is_verified is not client-updatable');

reset role;
-- t2, t3, t4 onboarded directly
update public.profiles set display_name = 'Tester ' || left(id::text, 1), onboarded_at = now()
 where id in ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
              '44444444-4444-4444-8444-444444444444');
insert into public.user_sports (user_id, sport_id, level) values
  ('22222222-2222-4222-8222-222222222222', 'football', 4), ('33333333-3333-4333-8333-333333333333', 'football', 2),
  ('44444444-4444-4444-8444-444444444444', 'football', 3);

-- ---------------------------------------------------------------- create + join (spots)
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$select * from public.create_event('football', '99999999-9999-4999-8999-999999999999', now() - interval '1 hour')$$,
                 'P0001', 'invalid_input', 'past start rejected');
select throws_ok($$select * from public.create_event('football', '99999999-9999-4999-8999-999999999999', now() + interval '1 day', null, 3, 2)$$,
                 'P0001', 'invalid_input', 'spots_reserved must be <= total - 2');
select lives_ok($$select set_config('test.ev', (select event_id::text from public.create_event(
                   'football', '99999999-9999-4999-8999-999999999999', now() + interval '1 day', 60, 3, 1, null, ' Small game ')), true)$$,
                'create_event: 3 total, 1 reserved (organizer + 1 free spot)');
select is((select spots_taken from public.events where id = current_setting('test.ev')::uuid), 1::smallint,
          'organizer counts as the first participant');
select is((select title from public.events where id = current_setting('test.ev')::uuid), 'Small game', 'title trimmed');
select throws_ok($$update public.events set spots_taken = 0 where id = current_setting('test.ev')::uuid$$, '42501', null,
                 'events.spots_taken is not client-updatable');
select throws_ok($$select public.leave_event(current_setting('test.ev')::uuid)$$, 'P0001', 'organizer_cannot_leave',
                 'organizer cannot leave');

set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select spots_taken from public.join_event(current_setting('test.ev')::uuid)), 2, 't2 joins → 2 taken');
select is((select spots_taken from public.join_event(current_setting('test.ev')::uuid)), 2, 'join is idempotent');
select isnt((select conversation_id from public.event_detail(current_setting('test.ev')::uuid)), null::uuid,
            'going participant gets the conversation id');

set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok($$select * from public.join_event(current_setting('test.ev')::uuid)$$, 'P0001', 'event_full',
                 'join_event cannot overfill');
select is((select can_join from public.event_detail(current_setting('test.ev')::uuid)), false, 'can_join false when full');
select is((select conversation_id from public.event_detail(current_setting('test.ev')::uuid)), null::uuid,
          'non-participant gets no conversation id');
select is((select count(*)::int from public.event_participants_list(current_setting('test.ev')::uuid)), 2,
          'participants list via RPC (organizer + t2)');
select throws_ok($$select public.get_or_create_event_conversation(current_setting('test.ev')::uuid)$$, 'P0001', 'not_participant',
                 'only going participants get the event chat');

-- t2 leaves → spot frees → t3 joins
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok($$select public.leave_event(current_setting('test.ev')::uuid)$$, 't2 leaves');
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is((select spots_taken from public.join_event(current_setting('test.ev')::uuid)), 2, 't3 takes the freed spot');

-- organizer removes t3; t3 cannot rejoin
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$select public.remove_participant(current_setting('test.ev')::uuid, '33333333-3333-4333-8333-333333333333')$$,
                'organizer removes t3');
select is((select spots_taken from public.events where id = current_setting('test.ev')::uuid), 1::smallint, 'spot freed');
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok($$select * from public.join_event(current_setting('test.ev')::uuid)$$, 'P0001', 'forbidden',
                 'removed user cannot rejoin');

-- ---------------------------------------------------------------- feed: anon sees no identities
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.events_feed(null, null, null, null, 'upcoming')
            where id = current_setting('test.ev')::uuid and organizer_id is null and organizer_name is null
              and my_status is null and not is_organizer), 1,
          'anon feed row has NULL organizer identity and my_status');
select throws_ok($$select * from public.events_feed(p_date_range := 'someday')$$, 'P0001', 'invalid_input',
                 'unknown date range rejected');
select is((select organizer_id from public.event_detail(current_setting('test.ev')::uuid)), null::uuid,
          'anon event_detail hides the organizer');
reset role;

-- ---------------------------------------------------------------- cancel → notifications
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select spots_taken from public.join_event(current_setting('test.ev')::uuid)), 2, 't4 joins');
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.notifications where type = 'event_joined'), 3,
          'organizer got event_joined notifications (t2, t3, t4)');
select lives_ok($$select public.cancel_event(current_setting('test.ev')::uuid, 'rain')$$, 'organizer cancels');
set local request.jwt.claims to '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.notifications where type = 'event_cancelled'
            and payload->>'url' = '/event/' || current_setting('test.ev')), 1, 'going participant notified of cancellation');
select throws_ok($$select * from public.join_event(current_setting('test.ev')::uuid)$$, 'P0001', 'event_not_joinable',
                 'cannot join a cancelled event');

-- ---------------------------------------------------------------- recurring series
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$select set_config('test.series', (select series_id::text from public.create_event(
                   'football', '99999999-9999-4999-8999-999999999999', now() + interval '2 hours', null, null, 0, null, null, null,
                   array[1,2,3,4,5,6,7], null)), true)$$, 'create a daily recurring series');
select ok((select count(*) from public.events where series_id = current_setting('test.series')::uuid) between 13 and 15,
          'series materialised for the 14-day horizon');

-- ---------------------------------------------------------------- swipe → match → chat → propose_meeting
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select match_id from public.swipe('33333333-3333-4333-8333-333333333333', true, 'football')), null::uuid,
          'one-sided like is not a match');
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok($$select set_config('test.match', (select match_id::text from public.swipe('22222222-2222-4222-8222-222222222222', true, 'football')), true)$$,
                'mutual like');
select isnt(nullif(current_setting('test.match', true), ''), null::text, 'mutual like creates a match');
select is((select count(*)::int from public.my_conversations() where kind = 'match'), 1, 'match conversation listed');
select lives_ok($$insert into public.messages (id, conversation_id, body)
                  select gen_random_uuid(), conversation_id, 'Hej!' from public.my_conversations() where kind = 'match'$$,
                'matched user can write');
select lives_ok($$select set_config('test.invite', (select event_id::text from public.propose_meeting(
                   current_setting('test.match')::uuid, 'football', '99999999-9999-4999-8999-999999999999',
                   now() + interval '3 days', null, 'Gramy?')), true)$$, 'propose_meeting');
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select my_status::text from public.event_detail(current_setting('test.invite')::uuid)), 'invited',
          'invitee sees the private event as invited');
select is((select spots_taken from public.join_event(current_setting('test.invite')::uuid)), 2, 'invitee accepts via join_event');
reset role;  -- everything above ran in one transaction (same now()); backdate membership so messages count as unread
update public.conversation_members set joined_at = now() - interval '1 hour'
 where user_id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select unread_count from public.my_conversations() where kind = 'match'), 2,
          'unread count includes text + invite messages');
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$select * from public.event_detail(current_setting('test.invite')::uuid)$$, 'P0001', 'not_found',
                 'private event is invisible to outsiders');

reset role;
select * from finish();
rollback;
