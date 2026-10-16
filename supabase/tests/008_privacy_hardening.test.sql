-- Privacy & abuse hardening (migration 20261015000021).
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- ---------------------------------------------------------------- fixtures (as postgres)
-- h01 caller · h02/h04 same coarse cell · h03 not discoverable · h05 not onboarded · h06 matched with h01
-- (not discoverable) · h07 > 30 km away · h08–h10 new reporters · h11–h13 established reporters
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('81000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'authenticated', 'authenticated', 'h' || n || '@test.local', now(), '{"provider":"email","providers":["email"]}',
       '{}', now(), now()
  from generate_series(1, 13) n;
update public.profiles set display_name = 'H' || right(id::text, 2), onboarded_at = now()
 where id::text like '81000000-%' and id <> '81000000-0000-4000-8000-000000000005';
update public.profiles set discoverable = false
 where id in ('81000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000006');
update public.profiles set district_key = 'srodmiescie' where id = '81000000-0000-4000-8000-000000000003';
update public.profiles set created_at = now() - interval '4 days'
 where id in ('81000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000012',
              '81000000-0000-4000-8000-000000000013');
insert into public.user_sports (user_id, sport_id, level)
select ('81000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'football', 3 from generate_series(1, 7) n;

update public.profile_private pp set home_location = private.snap_home_point(h.lat, h.lng)
  from (values ('01', 52.23, 21.01), ('02', 52.265, 21.095), ('03', 52.24, 21.02), ('04', 52.275, 21.115),
               ('06', 52.235, 21.02), ('07', 52.45, 21.40)) h(n, lat, lng)
 where pp.user_id = ('81000000-0000-4000-8000-0000000000' || h.n)::uuid;

insert into public.availability_slots (user_id, weekday, day_part)
select ('81000000-0000-4000-8000-0000000000' || u.n)::uuid, w, 'evening'
  from (values ('01'), ('02'), ('03'), ('06')) u(n), generate_series(1, 5) w;
insert into public.availability_slots (user_id, weekday, day_part)
values ('81000000-0000-4000-8000-000000000001', 6, 'morning');

insert into public.matches (id, user_a, user_b)
values ('8a000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000006');

insert into public.venues (id, name, kind, location, source, status, created_by) values
  ('89999999-0000-4000-8000-000000000001', 'Open court', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user', 'active',
   '81000000-0000-4000-8000-000000000002'),
  ('89999999-0000-4000-8000-000000000002', 'My hidden court', 'pitch', 'SRID=4326;POINT(21.01 52.23)', 'user', 'hidden',
   '81000000-0000-4000-8000-000000000001');
insert into public.venue_sports (venue_id, sport_id) values ('89999999-0000-4000-8000-000000000001', 'football');
insert into public.venue_photos (id, venue_id, external_url, uploaded_by) values
  ('8b000000-0000-4000-8000-000000000001', '89999999-0000-4000-8000-000000000001', 'https://example.org/a.jpg',
   '81000000-0000-4000-8000-000000000001'),
  ('8b000000-0000-4000-8000-000000000002', '89999999-0000-4000-8000-000000000001', 'https://example.org/b.jpg',
   '81000000-0000-4000-8000-000000000002');
insert into public.event_series (id, organizer_id, sport_id, venue_id, spots_total, weekdays, start_time, duration_min,
                                 starts_on, until_on)
values ('8f000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'football',
        '89999999-0000-4000-8000-000000000001', 10, array[2]::smallint[], '19:00', 90, current_date, current_date + 28);

-- ---------------------------------------------------------------- 1) buckets + coarse cells
select is(array[private.approx_distance_km(0), private.approx_distance_km(2.99), private.approx_distance_km(3),
                private.approx_distance_km(6.99), private.approx_distance_km(7), private.approx_distance_km(11.99),
                private.approx_distance_km(12), private.approx_distance_km(19.99), private.approx_distance_km(20),
                private.approx_distance_km(100)],
          array[3, 3, 5, 5, 10, 10, 15, 15, 25, 25], 'approx_distance_km: <3→3, <7→5, <12→10, <20→15, else 25');
select is((select extensions.st_astext(private.coarse_cell(a.home_location)::extensions.geometry)
             from public.profile_private a where a.user_id = '81000000-0000-4000-8000-000000000002'),
          (select extensions.st_astext(private.coarse_cell(b.home_location)::extensions.geometry)
             from public.profile_private b where b.user_id = '81000000-0000-4000-8000-000000000004'),
          'h02 and h04 share a coarse cell');

-- ---------------------------------------------------------------- 2) match_candidates (as h01)
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok((select bool_and(distance_km_approx in (3, 5, 10, 15, 25)) from public.match_candidates(50, null)),
          'every candidate distance is one of the coarse buckets');
select ok((select bool_and(abs(score_distance - exp(-distance_km_approx / 5.0)) < 1e-6)
             from public.match_candidates(50, null) where distance_km_approx is not null),
          'score_distance = exp(-bucket/5) — derived from the bucket only');
select ok((select bool_and(n = 1) from (select count(distinct score_distance) n from public.match_candidates(50, null)
                                        group by distance_km_approx) x),
          'candidates with the same bucket have the same score_distance');
select ok((select bool_and(round((-5 * ln(score_distance))::numeric, 3) in (3, 5, 10, 15, 25))
             from public.match_candidates(50, null)),
          'C1 regression: -5·ln(score_distance) yields only a bucket, not the real distance');
select is((select count(distinct (distance_km_approx, score_distance, score_level))::int from public.match_candidates(50, null)
            where user_id in ('81000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000004')), 1,
          'two homes in the same coarse cell are indistinguishable');
select is((select count(*)::int from public.match_candidates(50, null) where user_id = '81000000-0000-4000-8000-000000000007'), 0,
          '30 km pool filter (on coarse cells) excludes h07');
select is((select cardinality(common_slots) from public.match_candidates(50, null)
            where user_id = '81000000-0000-4000-8000-000000000002'), 3,
          'match_candidates caps common_slots at 3 (5 overlap)');
select lives_ok($$select set_config('t.d2', (select distance_km_approx || '/' || score_distance
                    from public.match_candidates(50, null) where user_id = '81000000-0000-4000-8000-000000000002'), true)$$,
                'remember h02 bucket/score');

-- h02 moves within its coarse cell → nothing observable changes
reset role;
update public.profile_private set home_location = private.snap_home_point(52.27, 21.104)
 where user_id = '81000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select distance_km_approx || '/' || score_distance from public.match_candidates(50, null)
            where user_id = '81000000-0000-4000-8000-000000000002'), current_setting('t.d2'),
          'moving within a coarse cell does not change distance or score');

-- ---------------------------------------------------------------- 4) person_summary visibility
select ok((select distance_km_approx in (3, 5, 10, 15, 25) and cardinality(common_slots) = 3
             from public.person_summary('81000000-0000-4000-8000-000000000002')),
          'discoverable, not matched: bucket distance + at most 3 common slots');
select ok((select distance_km_approx is null and common_slots = '{}' and district_key is not null
             from public.person_summary('81000000-0000-4000-8000-000000000003')),
          'not discoverable, not matched: NULL distance, no slots, district stays');
select ok((select distance_km_approx is not null and cardinality(common_slots) = 5 and match_id is not null
             from public.person_summary('81000000-0000-4000-8000-000000000006')),
          'active match: distance + full common slots (even if not discoverable)');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}';
select ok((select distance_km_approx is null and common_slots = '{}'
             from public.person_summary('81000000-0000-4000-8000-000000000002')),
          'caller not onboarded: NULL distance, no slots');

-- ---------------------------------------------------------------- 3) home moves
select lives_ok($$select public.set_home_location(52.20, 21.00); select public.set_home_location(52.21, 21.00)$$,
                'before onboarding the home can be changed freely');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_home_location(52.231, 21.011)$$, 'first change after onboarding is free');
select throws_ok($$select public.set_home_location(52.24, 21.02)$$, 'P0001', 'rate_limited',
                 'second change within 7 days is rate limited');
reset role;
update public.profile_private set home_location_updated_at = now() - interval '8 days'
 where user_id = '81000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_home_location(52.24, 21.02)$$, 'allowed again after 7 days');

-- ---------------------------------------------------------------- 5) M1 event_series_read + blocks
select is((select count(*)::int from public.event_series where id = '8f000000-0000-4000-8000-000000000001'), 1,
          'public series visible before blocking');
select lives_ok($$select public.block_user('81000000-0000-4000-8000-000000000002')$$, 'h01 blocks h02');
select is((select count(*)::int from public.event_series where id = '8f000000-0000-4000-8000-000000000001'), 0,
          'series of a blocked organizer is invisible');

-- ---------------------------------------------------------------- 6) M3 column grants
select throws_ok($$select created_by from public.venues limit 1$$, '42501', null, 'venues.created_by is not readable');
select throws_ok($$select uploaded_by from public.venue_photos limit 1$$, '42501', null,
                 'venue_photos.uploaded_by is not readable');
select throws_ok($$select * from public.venues limit 1$$, '42501', null, 'select * on venues is refused');
select is((select count(*)::int from public.venues where id = '89999999-0000-4000-8000-000000000002'), 1,
          'RLS still shows the caller''s own hidden venue (policy uses created_by server-side)');
select is((select is_mine from public.venue_detail('89999999-0000-4000-8000-000000000002')), true,
          'venue_detail.is_mine still works');
select lives_ok($$delete from public.venue_photos where id in ('8b000000-0000-4000-8000-000000000001',
                                                              '8b000000-0000-4000-8000-000000000002')$$,
                'delete own photo (policy on uploaded_by)');
reset role;
select is((select array_agg(id::text order by id) from public.venue_photos
            where id in ('8b000000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-000000000002')),
          array['8b000000-0000-4000-8000-000000000002'], 'only the caller''s own photo was deleted');

-- ---------------------------------------------------------------- 7) H2 auth hook
select is(private.auth_token_hook('{"authentication_method":"password","claims":{"sub":"x"}}') -> 'error' ->> 'http_code',
          '403', 'password grant is refused by the access-token hook');
select is(private.auth_token_hook('{"authentication_method":"otp","claims":{"sub":"x"}}'),
          '{"authentication_method":"otp","claims":{"sub":"x"}}'::jsonb, 'otp grant passes unchanged');
select ok(has_function_privilege('supabase_auth_admin', 'private.auth_token_hook(jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'private.auth_token_hook(jsonb)', 'execute')
          and not has_function_privilege('anon', 'private.auth_token_hook(jsonb)', 'execute'),
          'hook executable only by supabase_auth_admin');

-- ---------------------------------------------------------------- 8) M4 push tokens
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.register_push_token('ExponentPushToken[short]', 'ios')$$, 'P0001', 'invalid_input',
                 'malformed token rejected');
select lives_ok($$select public.register_push_token('ExponentPushToken[tok-aaaaaaaaaa-' || n || ']', 'android')
                    from generate_series(1, 5) n$$, 'five tokens registered');
reset role;
update public.push_tokens set last_seen_at = now() - make_interval(hours => 10 - substring(token from '-(\d+)\]$')::int)
 where user_id = '81000000-0000-4000-8000-000000000003';
update public.push_tokens set last_seen_at = now() - interval '2 days'
 where token = 'ExponentPushToken[tok-aaaaaaaaaa-1]';
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select public.register_push_token('ExponentPushToken[tok-aaaaaaaaaa-6]', 'ios')$$, 'sixth token');
select ok((select count(*) = 5 and bool_and(token <> 'ExponentPushToken[tok-aaaaaaaaaa-1]')
             from public.push_tokens), 'at most 5 tokens; the least recently seen one was evicted');
reset role;
insert into public.push_tokens (token, user_id, platform)
select 'ExponentPushToken[bulk-token-0' || n || ']', '81000000-0000-4000-8000-000000000004', 'android'
  from generate_series(1, 7) n;
insert into public.notifications (id, user_id, type, payload, dedupe_key)
values ('8c000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000004', 'match', '{"url":"/x"}', 'h:1');
set local role service_role;
select is((select cardinality(tokens) from public.claim_push_batch(array['8c000000-0000-4000-8000-000000000001']::uuid[], 10)),
          5, 'claim_push_batch sends to at most 5 tokens per user');
reset role;

-- ---------------------------------------------------------------- 9) M5 joined message only once
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total)
values ('8e000000-0000-4000-8000-000000000001', 'football', '89999999-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000006', now() + interval '1 day', now() + interval '1 day 90 minutes', 10);
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.join_event('8e000000-0000-4000-8000-000000000001');
                  select public.leave_event('8e000000-0000-4000-8000-000000000001');
                  select public.join_event('8e000000-0000-4000-8000-000000000001');
                  select public.leave_event('8e000000-0000-4000-8000-000000000001');
                  select public.join_event('8e000000-0000-4000-8000-000000000001')$$, 'join/leave cycling');
reset role;
select is((select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
            where c.event_id = '8e000000-0000-4000-8000-000000000001' and m.kind = 'system'
              and m.payload ->> 'type' = 'joined'), 1, 'the "joined" system message is posted only once');

-- ---------------------------------------------------------------- 10) M6 execute allow-list
select is(array(select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')
                 order by 1),
          array['public.event_detail', 'public.events_feed', 'public.venue_detail', 'public.venue_photos_list',
                'public.venues_in_bbox'],
          'anon can execute exactly the 5 public read RPCs');
select is(array(select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'execute')
                 order by 1),
          array['private.can_post_message', 'private.is_blocked_pair', 'private.is_conversation_member',
                'private.is_event_member', 'private.is_moderator',
                'public.add_venue', 'public.add_venue_photo', 'public.block_user', 'public.blocked_users',
                'public.cancel_event', 'public.cancel_series', 'public.clear_home_location', 'public.complete_onboarding',
                'public.create_event', 'public.decline_invite', 'public.event_detail', 'public.event_participants_list',
                'public.events_feed', 'public.get_or_create_event_conversation', 'public.join_event', 'public.leave_event',
                'public.mark_conversation_read', 'public.mark_notifications_read', 'public.match_candidates',
                'public.moderate_content', 'public.my_conversations', 'public.my_events', 'public.person_summary',
                'public.propose_meeting', 'public.register_push_token', 'public.remove_participant',
                'public.review_venue_edit', 'public.set_availability', 'public.set_conversation_muted',
                'public.set_home_location', 'public.set_user_sports', 'public.set_user_verified', 'public.submit_attendance',
                'public.submit_report', 'public.suggest_venue_edit', 'public.swipe', 'public.unblock_user',
                'public.unmatch', 'public.unregister_push_token', 'public.venue_detail', 'public.venue_photos_list',
                'public.venues_in_bbox'],
          'authenticated can execute exactly the intended RPCs + the 5 RLS helpers');
select ok(exists (select 1 from pg_default_acl d join pg_roles r on r.oid = d.defaclrole
                   where r.rolname = 'postgres' and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
                     and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)),
          'global default ACL: functions created by postgres grant nothing to PUBLIC');

-- ---------------------------------------------------------------- 11) L1 autohide needs established reporters
insert into public.venue_photos (id, venue_id, external_url) values
  ('8b000000-0000-4000-8000-000000000003', '89999999-0000-4000-8000-000000000001', 'https://example.org/c.jpg');
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000008","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000009","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000010","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
reset role;
select is((select status::text from public.venue_photos where id = '8b000000-0000-4000-8000-000000000003'), 'active',
          '3 reports from brand-new accounts do not auto-hide');
set local role authenticated;
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000011","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000012","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
set local request.jwt.claims to '{"sub":"81000000-0000-4000-8000-000000000013","role":"authenticated"}';
select public.submit_report('venue_photo', '8b000000-0000-4000-8000-000000000003', 'inappropriate');
reset role;
select is((select status::text from public.venue_photos where id = '8b000000-0000-4000-8000-000000000003'), 'hidden',
          '3 reports from established (onboarded, >3 days) accounts auto-hide');

select * from finish();
rollback;
