-- Chat polish (migration 20261015000019): unread ignores system messages, last_message_payload,
-- decline_invite bumps events.updated_at.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('61000000-0000-4000-8000-00000000000' || n)::uuid, 'authenticated',
       'authenticated', 'c' || n || '@test.local', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from generate_series(1, 2) n;
update public.profiles set display_name = 'Chat ' || right(id::text, 1), onboarded_at = now()
 where id::text like '61000000-%';
insert into public.user_sports (user_id, sport_id, level)
select id, 'tennis', 3 from public.profiles where id::text like '61000000-%';
insert into public.venues (id, name, kind, location, source)
values ('69999999-9999-4999-8999-999999999999', 'Chat court', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user');
insert into public.venue_sports (venue_id, sport_id) values ('69999999-9999-4999-8999-999999999999', 'tennis');

-- event by c1, c2 joins (→ system "joined" message)
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total)
values ('6eeeeeee-0000-4000-8000-000000000001', 'tennis', '69999999-9999-4999-8999-999999999999',
        '61000000-0000-4000-8000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour', 4);
insert into public.event_participants (event_id, user_id) values
  ('6eeeeeee-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002');
-- match c1 ↔ c2
insert into public.matches (id, user_a, user_b)
values ('6a000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002');
insert into public.conversations (id, kind, match_id)
values ('6c000000-0000-4000-8000-000000000001', 'match', '6a000000-0000-4000-8000-000000000001');
insert into public.conversation_members (conversation_id, user_id) values
  ('6c000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001'),
  ('6c000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002');
-- one transaction = one now(): backdate memberships so this transaction's messages count as "after joining"
update public.conversation_members set joined_at = now() - interval '1 hour'
 where user_id::text like '61000000-%';

-- ---------------------------------------------------------------- unread ignores system messages
set local role authenticated;
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.messages (conversation_id, body)
                  select c.id, 'See you there' from public.conversations c
                   where c.event_id = '6eeeeeee-0000-4000-8000-000000000001'$$, 'c2 writes in the event chat');

reset role;  -- make the earlier event-chat messages strictly older than the upcoming cancellation notice
update public.messages m set created_at = now() - interval '10 minutes'
  from public.conversations c where c.id = m.conversation_id and c.event_id = '6eeeeeee-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.cancel_event('6eeeeeee-0000-4000-8000-000000000001', 'rain')$$,
                'organizer cancels (→ system "cancelled" message)');
select is((select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
            where c.event_id = '6eeeeeee-0000-4000-8000-000000000001' and m.kind = 'system'), 2,
          'event chat has 2 system messages (joined + cancelled)');
select is((select unread_count from public.my_conversations() where event_id = '6eeeeeee-0000-4000-8000-000000000001'), 1,
          'organizer: only the text message is unread, system notices are not');
select is((select last_message_kind::text || ':' || (last_message_payload ->> 'type')
             from public.my_conversations() where event_id = '6eeeeeee-0000-4000-8000-000000000001'),
          'system:cancelled', 'last_message_payload carries the system payload');

-- ---------------------------------------------------------------- event_invite still counts + payload
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select set_config('test.invite', (select event_id::text from public.propose_meeting(
                   '6a000000-0000-4000-8000-000000000001', 'tennis', '69999999-9999-4999-8999-999999999999',
                   now() + interval '2 days', null, 'Gramy?')), true)$$, 'c2 proposes a meeting');
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select unread_count from public.my_conversations() where match_id = '6a000000-0000-4000-8000-000000000001'), 1,
          'event_invite counts as unread');
select is((select last_message_payload ->> 'event_id' from public.my_conversations()
            where match_id = '6a000000-0000-4000-8000-000000000001'), current_setting('test.invite'),
          'last_message_payload of the invite has event_id');
select ok((select last_message_payload ?& array['event_id', 'sport_id', 'starts_at', 'venue_name']
             from public.my_conversations() where match_id = '6a000000-0000-4000-8000-000000000001'),
          'invite payload has event_id, sport_id, starts_at, venue_name');
reset role;  -- invite strictly older than the reply below
update public.messages set created_at = now() - interval '5 minutes'
 where conversation_id = '6c000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.messages (conversation_id, body)
                  values ('6c000000-0000-4000-8000-000000000001', 'Ok!')$$, 'c1 replies with text');
select is((select last_message_payload from public.my_conversations()
            where match_id = '6a000000-0000-4000-8000-000000000001'), null::jsonb,
          'text message → last_message_payload is NULL');

-- ---------------------------------------------------------------- decline_invite bumps events.updated_at
reset role;
select set_config('test.ctid', (select ctid::text from public.events where id = current_setting('test.invite')::uuid), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.decline_invite(current_setting('test.invite')::uuid)$$, 'invitee declines');
reset role;
select ok((select ctid::text <> current_setting('test.ctid') and updated_at = now()
             from public.events where id = current_setting('test.invite')::uuid),
          'decline_invite wrote a new events row version with updated_at = now() (Realtime UPDATE)');

select * from finish();
rollback;
