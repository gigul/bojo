-- venues_in_bbox: district_key + today_events_count (migration 20261015000021 §12).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'm1@test.local', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
insert into public.venues (id, name, kind, location, source)
values ('99000000-0000-4000-8000-000000000001', 'Map court', 'pitch', 'SRID=4326;POINT(21.00001 52.20001)', 'user');
insert into public.venue_sports (venue_id, sport_id) values ('99000000-0000-4000-8000-000000000001', 'tennis');

-- "today" = now … end of today in Europe/Warsaw (same window as events_feed 'today')
select set_config('t.eod', ((((now() at time zone 'Europe/Warsaw')::date + 1)::timestamp at time zone 'Europe/Warsaw'))::text, true);
insert into public.events (id, sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total, visibility, status)
select x.id::uuid, 'tennis', '99000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
       x.starts, x.starts + interval '1 hour', 2, x.vis::public.event_visibility, 'scheduled'
  from (values
    ('9e000000-0000-4000-8000-000000000001', now() + (current_setting('t.eod')::timestamptz - now()) / 2, 'public'),   -- today
    ('9e000000-0000-4000-8000-000000000002', now() + (current_setting('t.eod')::timestamptz - now()) / 3, 'private'),  -- today, private
    ('9e000000-0000-4000-8000-000000000003', current_setting('t.eod')::timestamptz + interval '1 hour', 'public'),     -- tomorrow
    ('9e000000-0000-4000-8000-000000000004', now() + (current_setting('t.eod')::timestamptz - now()) / 4, 'public')    -- today, cancelled below
  ) x(id, starts, vis);
update public.events set status = 'cancelled' where id = '9e000000-0000-4000-8000-000000000004';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select today_events_count from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['tennis'], 50)
            where id = '99000000-0000-4000-8000-000000000001'), 1,
          'today_events_count: public scheduled events starting between now and end of today (Warsaw)');
select is((select upcoming_events_count from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['tennis'], 50)
            where id = '99000000-0000-4000-8000-000000000001'), 2,
          'upcoming_events_count (7 days) still counts tomorrow too');
select is((select district_key from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['tennis'], 50)
            where id = '99000000-0000-4000-8000-000000000001'), 'mokotow', 'district_key returned');
reset role;
select is((select district_key from public.venues_in_bbox(20.99, 52.19, 21.01, 52.21, array['tennis'], 50)
            where id = '99000000-0000-4000-8000-000000000001'),
          (select v.district_key from public.venues v where v.id = '99000000-0000-4000-8000-000000000001'),
          'district_key equals the venue''s stored district');
select ok(pg_get_function_result('public.venues_in_bbox(float8, float8, float8, float8, text[], int)'::regprocedure)
            ~ 'district_key text, today_events_count integer',
          'result type has district_key text, today_events_count int');
select ok(has_function_privilege('anon', 'public.venues_in_bbox(float8, float8, float8, float8, text[], int)', 'execute')
          and has_function_privilege('authenticated', 'public.venues_in_bbox(float8, float8, float8, float8, text[], int)', 'execute')
          and not has_function_privilege('anon', 'private.venue_today_count(uuid)', 'execute'),
          'venues_in_bbox re-granted to anon + authenticated; helper stays private');

select * from finish();
rollback;
