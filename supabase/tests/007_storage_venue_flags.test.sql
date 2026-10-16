-- Storage RLS with real inserts into storage.objects (migration 20261015000020) + venue_detail.flags.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('71000000-0000-4000-8000-00000000000' || n)::uuid, 'authenticated',
       'authenticated', 's' || n || '@test.local', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from generate_series(1, 2) n;

insert into public.venues (id, name, kind, location, source, status, created_by) values
  ('79999999-0000-4000-8000-000000000001', 'Active court', 'pitch', 'SRID=4326;POINT(21.0 52.23)', 'user', 'active', null),
  ('79999999-0000-4000-8000-000000000002', 'Hidden court', 'pitch', 'SRID=4326;POINT(21.01 52.23)', 'user', 'hidden',
   '71000000-0000-4000-8000-000000000001');   -- hidden even though s1 created it
insert into public.venues (id, name, kind, location, source, osm_type, osm_id, osm_tags) values
  ('79999999-0000-4000-8000-000000000003', null, 'pitch', 'SRID=4326;POINT(21.02 52.23)', 'osm', 'way', 999000001,
   '{"leisure":"pitch","sport":"basketball","bojo:flags":["customers_only","on_school_grounds"]}');
insert into public.venue_sports (venue_id, sport_id) values
  ('79999999-0000-4000-8000-000000000001', 'basketball'), ('79999999-0000-4000-8000-000000000003', 'basketball');

-- ---------------------------------------------------------------- venue-photos bucket (as s1)
set local role authenticated;
set local request.jwt.claims to '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('venue-photos',
  '79999999-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/7f000000-0000-4000-8000-000000000001.jpg',
  '71000000-0000-4000-8000-000000000001')$$,
  'venue photo: own user folder on an active venue → allowed');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('venue-photos',
  '79999999-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000002/7f000000-0000-4000-8000-000000000002.jpg')$$,
  '42501', null, 'venue photo: someone else''s user folder → RLS violation');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('venue-photos',
  '79999999-0000-4000-8000-000000000002/71000000-0000-4000-8000-000000000001/7f000000-0000-4000-8000-000000000003.jpg')$$,
  '42501', null, 'venue photo: hidden venue (even if own) → RLS violation');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('venue-photos',
  '79999999-0000-4000-8000-0000000000ff/71000000-0000-4000-8000-000000000001/7f000000-0000-4000-8000-000000000004.jpg')$$,
  '42501', null, 'venue photo: unknown venue → RLS violation');
select lives_ok($$select public.add_venue_photo('79999999-0000-4000-8000-000000000001',
  '79999999-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/7f000000-0000-4000-8000-000000000001.jpg')$$,
  'add_venue_photo succeeds once the object exists (end-to-end upload path)');
select is((select count(*)::int from public.venue_photos_list('79999999-0000-4000-8000-000000000001')), 1,
          'photo listed for the venue');

-- ---------------------------------------------------------------- avatars bucket
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('avatars',
  '71000000-0000-4000-8000-000000000001/7f000000-0000-4000-8000-000000000005.jpg', '71000000-0000-4000-8000-000000000001')$$,
  'avatar: own folder → allowed');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars',
  '71000000-0000-4000-8000-000000000002/7f000000-0000-4000-8000-000000000006.jpg')$$,
  '42501', null, 'avatar: foreign folder → RLS violation');

-- s2 cannot see s1's objects via the select policies (no enumeration)
set local request.jwt.claims to '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from storage.objects where name like '71000000-0000-4000-8000-000000000001/%'
              or name like '%/71000000-0000-4000-8000-000000000001/%'), 0,
          'other users cannot list s1''s objects');

-- ---------------------------------------------------------------- venue_detail.flags
select is((select flags from public.venue_detail('79999999-0000-4000-8000-000000000003')),
          array['customers_only', 'on_school_grounds'], 'venue_detail.flags = osm_tags bojo:flags');
select is((select flags from public.venue_detail('79999999-0000-4000-8000-000000000001')), '{}'::text[],
          'flags is an empty array when there are none');
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select flags from public.venue_detail('79999999-0000-4000-8000-000000000003')),
          array['customers_only', 'on_school_grounds'], 'anon sees venue flags too');
reset role;
select ok(pg_get_function_result('public.venue_detail(uuid)'::regprocedure) ~ 'flags text\[\]'
          and has_function_privilege('anon', 'public.venue_detail(uuid)', 'execute'),
          'venue_detail returns flags text[] and is still anon-callable');

select * from finish();
rollback;
