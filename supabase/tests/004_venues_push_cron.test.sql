-- Venues RPCs, moderation, push outbox and cron functions (ARCHITECTURE §5.1, §5.6, §5.7, §6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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
  ('11111111-1111-4111-8111-111111111111', 'basketball', 3), ('22222222-2222-4222-8222-222222222222', 'basketball', 3);
insert into private.moderators (user_id) values ('44444444-4444-4444-8444-444444444444');

-- ---------------------------------------------------------------- add_venue
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$select public.add_venue('Kraków court', 'pitch', 50.06, 19.94, array['basketball'])$$,
                 'P0001', 'outside_service_area', 'add_venue outside Warsaw rejected');
select throws_ok($$select public.add_venue('Route', 'running_route', 52.2, 21.0, array['running'])$$,
                 'P0001', 'invalid_input', 'users cannot add running routes');
select throws_ok($$select public.add_venue('Court', 'pitch', 52.2, 21.0, array['curling'])$$,
                 'P0001', 'invalid_input', 'unknown sport rejected');
select throws_ok($$select public.add_venue('Court', 'pitch', 52.2, 21.0, array['basketball'], 'moon_dust')$$,
                 'P0001', 'invalid_input', 'unknown surface class rejected');
select lives_ok($$select set_config('test.venue', public.add_venue('Test court', 'pitch', 52.20001, 21.00001,
                   array['basketball','basketball'], 'asphalt', true, true)::text, true)$$, 'add_venue');
select is((select district_key from public.venue_detail(current_setting('test.venue')::uuid)), 'mokotow',
          'district assigned by trigger from the OSM boundary/centre');
select is((select sport_ids from public.venue_detail(current_setting('test.venue')::uuid)), array['basketball'],
          'sports de-duplicated');
select is((select is_mine from public.venue_detail(current_setting('test.venue')::uuid)), true, 'is_mine for creator');
select throws_ok($$select public.add_venue('Same court', 'pitch', 52.20005, 21.00005, array['basketball'])$$,
                 'P0001', 'duplicate_venue', 'duplicate within 25 m sharing a sport');
select is((select count(*)::int from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['basketball'], 50)
            where id = current_setting('test.venue')::uuid), 1, 'venues_in_bbox finds it with a sport filter');
select is((select count(*)::int from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['tennis'], 50)
            where id = current_setting('test.venue')::uuid), 0, 'sport filter excludes it');
select throws_ok($$select * from public.venues_in_bbox(21.1, 52.19, 21.0, 52.21)$$, 'P0001', 'invalid_input',
                 'inverted bbox rejected');

-- ---------------------------------------------------------------- edits + moderation
select throws_ok($$select public.suggest_venue_edit(current_setting('test.venue')::uuid, 'update', '{"owner":"me"}')$$,
                 'P0001', 'invalid_input', 'non-whitelisted proposal key rejected');
select lives_ok($$select set_config('test.edit', public.suggest_venue_edit(current_setting('test.venue')::uuid, 'update',
                   '{"name":"Better name","is_lit":false,"sport_ids":["basketball","volleyball"]}', 'fix')::text, true)$$,
                'suggest_venue_edit');
select is((select has_pending_edit_by_me from public.venue_detail(current_setting('test.venue')::uuid)), true,
          'has_pending_edit_by_me');
select is((select previous->>'name' from public.venue_edits where id = current_setting('test.edit')::uuid), 'Test court',
          'previous snapshot stored');
select throws_ok($$select public.review_venue_edit(current_setting('test.edit')::uuid, true)$$, 'P0001', 'forbidden',
                 'non-moderator cannot review');
set local request.jwt.claims to '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select lives_ok($$select public.review_venue_edit(current_setting('test.edit')::uuid, true)$$, 'moderator approves');
select is((select name || '|' || is_lit::text || '|' || array_to_string(sport_ids, ',')
             from public.venue_detail(current_setting('test.venue')::uuid)),
          'Better name|false|basketball,volleyball', 'approved edit applied (name, is_lit, sports)');
select isnt((select locally_edited_at from public.venues where id = current_setting('test.venue')::uuid), null::timestamptz,
            'locally_edited_at set (re-import keeps attributes)');

-- ---------------------------------------------------------------- photos
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$select public.add_venue_photo(current_setting('test.venue')::uuid,
                   current_setting('test.venue') || '/11111111-1111-4111-8111-111111111111/0f2a6c1e-1111-4222-8333-444455556666.jpg')$$,
                 'P0001', 'invalid_input', 'photo path must be in the caller''s folder');
select throws_ok($$select public.add_venue_photo(current_setting('test.venue')::uuid,
                   current_setting('test.venue') || '/22222222-2222-4222-8222-222222222222/0f2a6c1e-1111-4222-8333-444455556666.jpg')$$,
                 'P0001', 'invalid_input', 'photo must exist in storage first');

-- ---------------------------------------------------------------- reports
select lives_ok($$select public.submit_report('venue', current_setting('test.venue')::uuid, 'fake', 'not here')$$,
                'submit_report');
select lives_ok($$select public.submit_report('venue', current_setting('test.venue')::uuid, 'wrong_info')$$,
                'submit_report is an upsert per (reporter, target)');
select is((select count(*)::int from public.reports), 1, 'one report row per reporter/target (own rows only visible)');

-- ---------------------------------------------------------------- push outbox (service role)
reset role;
insert into public.push_tokens (token, user_id, platform)
values ('ExponentPushToken[test-token-1]', '11111111-1111-4111-8111-111111111111', 'ios');
update public.profile_private set push_enabled = false where user_id = '22222222-2222-4222-8222-222222222222';
insert into public.notifications (id, user_id, type, payload, dedupe_key) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'match', '{"url":"/chat/x"}', 'test:1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'match', '{"url":"/chat/x"}', 'test:2');
set local role service_role;
select is((select array_agg(notification_id) from public.claim_push_batch(
             array['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002']::uuid[], 10)),
          array['aaaaaaaa-0000-4000-8000-000000000001']::uuid[],
          'claim returns only users with push enabled and tokens');
reset role;
select is((select push_status::text from public.notifications where id = 'aaaaaaaa-0000-4000-8000-000000000002'), 'skipped',
          'push-disabled user is skipped');
set local role service_role;
select lives_ok($$select public.complete_push_batch(
                  '[{"notification_id":"aaaaaaaa-0000-4000-8000-000000000001","status":"sent"}]',
                  array['ExponentPushToken[test-token-1]'])$$, 'complete_push_batch');
reset role;
select is((select push_status::text || ':' || (sent_at is not null)::text from public.notifications
            where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'sent:true', 'marked sent');
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[test-token-1]'), 0,
          'invalid tokens deleted');

-- ---------------------------------------------------------------- cron: complete past events
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total)
values ('eeeeeeee-0000-4000-8000-000000000009', 'basketball', current_setting('test.venue')::uuid,
        '11111111-1111-4111-8111-111111111111', now() + interval '1 hour', now() + interval '2 hours', 10);
insert into public.event_participants (event_id, user_id) values
  ('eeeeeeee-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222');
update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '2 hours'
 where id = 'eeeeeeee-0000-4000-8000-000000000009';
select lives_ok($$select private.complete_past_events()$$, 'complete_past_events runs');
select is((select status::text || ':' || exists (select 1 from public.notifications n
             where n.user_id = '11111111-1111-4111-8111-111111111111' and n.type = 'attendance_reminder'
               and n.dedupe_key = 'attend:eeeeeeee-0000-4000-8000-000000000009')::text
             from public.events where id = 'eeeeeeee-0000-4000-8000-000000000009'),
          'completed:true', 'past event completed + attendance reminder to organizer');

select * from finish();
rollback;
