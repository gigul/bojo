-- =============================================================================
-- Bojo — LOCAL DEV MOCK DATA (ARCHITECTURE §10). Never run in production.
-- * 12 users dev01@bojo.test … dev12@bojo.test (fixed ids d0000000-0000-4000-8000-0000000000NN).
--   Log in with the email OTP; the code arrives in Mailpit (http://127.0.0.1:44324).
--   dev01 is also a moderator (private.moderators) for testing review_venue_edit/moderate_content.
-- * ~20 "[DEV] " events in the next 7 days at REAL OSM venues (picked by subquery), one weekly series,
--   one match (dev01 ↔ dev02) with a conversation and messages. Everything is is_mock = true.
-- * If the OSM venue seed is empty, events/series/match-invites are simply skipped.
-- * Mock users' home areas are fictional points snapped with private.snap_home_point (~550 m grid).
-- Remove everything with:
--   delete from auth.users where email like '%@bojo.test';
--   delete from public.events where is_mock; delete from public.event_series where is_mock;
-- =============================================================================

-- ---- users -------------------------------------------------------------------
with u(n, name) as (values
  ('01','Anna'), ('02','Piotr'), ('03','Kasia'), ('04','Marek'), ('05','Ola'), ('06','Tomek'),
  ('07','Ewa'), ('08','Jan'), ('09','Magda'), ('10','Paweł'), ('11','Zosia'), ('12','Kuba'))
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', ('d0000000-0000-4000-8000-0000000000' || u.n)::uuid,
       'authenticated', 'authenticated', 'dev' || u.n || '@bojo.test', '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', '', '', '', '', ''
  from u
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email like 'dev__@bojo.test'
on conflict do nothing;

-- ---- profiles (created by the on_auth_user_created trigger) -------------------
with p(n, name, district, goal, bio, verified, lat, lng) as (values
  ('01','Anna',  'mokotow',        'fun',         'Piłka po pracy, czasem siatkówka.',      true,  52.1931, 21.0280),
  ('02','Piotr', 'mokotow',        'competition', 'Gram w piłkę od dziecka. Szukam ekipy.', false, 52.1990, 21.0420),
  ('03','Kasia', 'srodmiescie',    'learning',    'Tenis i padel — uczę się serwisu.',      true,  52.2290, 21.0110),
  ('04','Marek', 'wola',           'competition', 'Koszykówka 3x3, wieczorami.',            false, 52.2360, 20.9600),
  ('05','Ola',   'zoliborz',       'fitness',     'Siatkówka plażowa + bieganie nad Wisłą.', false, 52.2700, 20.9870),
  ('06','Tomek', 'praga_poludnie', 'fun',         'Ping-pong w parku i futsal.',            false, 52.2400, 21.0800),
  ('07','Ewa',   'ursynow',        'fitness',     'Biegam 10 km, street workout.',          true,  52.1500, 21.0450),
  ('08','Jan',   'bielany',        'competition', 'Tenis, poziom średnio-zaawansowany.',    false, 52.2850, 20.9500),
  ('09','Magda', 'ochota',         'fitness',     'Basen rano, workout wieczorem.',         false, 52.2120, 20.9750),
  ('10','Paweł', 'wilanow',        'fun',         'Padel i tenis w weekendy.',              false, 52.1650, 21.0850),
  ('11','Zosia', 'bemowo',         'learning',    'Kosz i siatka, dopiero zaczynam.',       false, 52.2540, 20.9150),
  ('12','Kuba',  'targowek',       'competition', 'Organizuję gierki w piłkę co tydzień.',  true,  52.2900, 21.0450))
update public.profiles pr
   set display_name = '[DEV] ' || p.name, district_key = p.district, goal = p.goal::public.user_goal, bio = p.bio,
       is_verified = p.verified, is_mock = true, onboarded_at = coalesce(pr.onboarded_at, now())
  from p
 where pr.id = ('d0000000-0000-4000-8000-0000000000' || p.n)::uuid;

with p(n, lat, lng, locale) as (values
  ('01', 52.1931, 21.0280, 'ru'), ('02', 52.1990, 21.0420, 'pl'), ('03', 52.2290, 21.0110, 'en'),
  ('04', 52.2360, 20.9600, 'pl'), ('05', 52.2700, 20.9870, 'ru'), ('06', 52.2400, 21.0800, 'pl'),
  ('07', 52.1500, 21.0450, 'pl'), ('08', 52.2850, 20.9500, 'en'), ('09', 52.2120, 20.9750, 'ru'),
  ('10', 52.1650, 21.0850, 'pl'), ('11', 52.2540, 20.9150, 'pl'), ('12', 52.2900, 21.0450, 'ru'))
update public.profile_private pp
   set home_location = private.snap_home_point(p.lat, p.lng), home_location_updated_at = now(),
       locale = p.locale, notify_radius_km = 5
  from p
 where pp.user_id = ('d0000000-0000-4000-8000-0000000000' || p.n)::uuid;

insert into public.user_sports (user_id, sport_id, level)
select ('d0000000-0000-4000-8000-0000000000' || s.n)::uuid, s.sport, s.lvl
  from (values
    ('01','football',3), ('01','volleyball',2), ('02','football',4), ('02','basketball',3),
    ('03','tennis',3), ('03','padel',2), ('04','basketball',4), ('04','football',2),
    ('05','volleyball',4), ('05','running',3), ('06','football',2), ('06','table_tennis',3),
    ('07','running',4), ('07','workout',3), ('08','tennis',4), ('08','table_tennis',2),
    ('09','swimming',3), ('09','workout',2), ('10','padel',3), ('10','tennis',3),
    ('11','basketball',2), ('11','volleyball',3), ('12','football',5), ('12','running',2)
  ) as s(n, sport, lvl)
on conflict do nothing;

-- weekday evenings for most, weekend mornings for some
insert into public.availability_slots (user_id, weekday, day_part)
select ('d0000000-0000-4000-8000-0000000000' || a.n)::uuid, w.d, a.part::public.day_part
  from (values ('01','evening'), ('02','evening'), ('03','afternoon'), ('04','evening'), ('05','morning'),
               ('06','evening'), ('07','morning'), ('08','afternoon'), ('09','morning'), ('10','evening'),
               ('11','evening'), ('12','evening')) as a(n, part)
  cross join lateral (select generate_series(case when a.part = 'morning' then 6 else 1 end,
                                             case when a.part = 'morning' then 7 else 5 end)::smallint as d) w
on conflict do nothing;

insert into private.moderators (user_id) values ('d0000000-0000-4000-8000-000000000001') on conflict do nothing;

-- ---- events at real OSM venues (skipped when no venue matches) -----------------
-- day 0 = today (starts 2–4 h from now), otherwise local Warsaw time on day +N.
with spec(n, sport, org, day_off, local_t, dur, total, reserved, lvl, title) as (values
  ( 1, 'football',     '12', 0, null::time,    90, 10, 3, 3,    'Gierka 5×5'),
  ( 2, 'basketball',   '04', 0, null,          90, 6,  0, 3,    '3×3 po pracy'),
  ( 3, 'table_tennis', '06', 0, null,          60, 4,  0, null, 'Ping-pong w parku'),
  ( 4, 'tennis',       '08', 1, time '18:00',  60, 2,  0, 4,    'Sparing tenisowy'),
  ( 5, 'volleyball',   '05', 1, time '19:00',  90, 12, 4, 3,    'Siatkówka plażowa'),
  ( 6, 'running',      '07', 1, time '07:00',  60, 8,  0, null, 'Poranne 10 km'),
  ( 7, 'football',     '02', 2, time '20:00',  90, 12, 6, 4,    'Orlik — szukamy 4'),
  ( 8, 'padel',        '10', 2, time '18:30',  90, 4,  1, 3,    'Padel debel'),
  ( 9, 'workout',      '09', 2, time '08:00',  60, 6,  0, 2,    'Street workout'),
  (10, 'basketball',   '11', 3, time '17:30',  90, 10, 2, 2,    'Kosz dla początkujących'),
  (11, 'swimming',     '09', 3, time '07:00',  60, 4,  0, null, 'Basen rano'),
  (12, 'football',     '01', 3, time '19:00',  90, 10, 2, null, 'Mixed football'),
  (13, 'tennis',       '03', 4, time '16:00',  60, 2,  0, 3,    'Tenis — trening'),
  (14, 'running',      '05', 4, time '18:00',  60, 10, 0, 3,    'Bieg nad Wisłą'),
  (15, 'table_tennis', '08', 4, time '17:00',  60, 4,  0, null, 'Turniej ping-ponga'),
  (16, 'volleyball',   '11', 5, time '11:00',  120, 12, 2, null, 'Siatka — gra otwarta'),
  (17, 'football',     '06', 5, time '10:00',  90, 14, 4, 2,    'Piłka rekreacyjna'),
  (18, 'workout',      '07', 6, time '09:00',  60, 8,  0, null, 'Kalistenika w parku'),
  (19, 'basketball',   '02', 6, time '12:00',  90, 10, 0, 4,    'Streetball'),
  (20, 'padel',        '03', 7, time '18:00',  90, 4,  0, 2,    'Padel dla nowych'))
insert into public.events (id, sport_id, venue_id, organizer_id, title, starts_at, ends_at,
                           spots_total, spots_reserved, level, is_mock)
select ('e0000000-0000-4000-8000-0000000000' || lpad(s.n::text, 2, '0'))::uuid, s.sport, v.id,
       ('d0000000-0000-4000-8000-0000000000' || s.org)::uuid, '[DEV] ' || s.title,
       st.starts_at, st.starts_at + make_interval(mins => s.dur), s.total, s.reserved, s.lvl, true
  from spec s
  join public.profiles pr on pr.id = ('d0000000-0000-4000-8000-0000000000' || s.org)::uuid
  join public.districts d on d.key = pr.district_key
  cross join lateral (
    select case when s.day_off = 0
                then date_trunc('hour', now()) + interval '2 hours' + (s.n * interval '20 minutes')
                else (((now() at time zone 'Europe/Warsaw')::date + s.day_off) + s.local_t) at time zone 'Europe/Warsaw'
           end as starts_at) st
  cross join lateral (
    select v.id from public.venues v
     where v.status = 'active'
       and exists (select 1 from public.venue_sports vs where vs.venue_id = v.id and vs.sport_id = s.sport and not vs.inferred)
     order by (v.name is null), v.location operator(extensions.<->) d.center
     limit 1 offset (s.n % 2)) v
on conflict (id) do nothing;

-- participants (organizer is added by the events_after_insert trigger)
insert into public.event_participants (event_id, user_id, status)
select ('e0000000-0000-4000-8000-0000000000' || x.e)::uuid, ('d0000000-0000-4000-8000-0000000000' || x.u)::uuid, 'going'
  from (values
    ('01','02'), ('01','01'), ('01','06'), ('02','11'), ('03','08'), ('05','11'), ('05','01'),
    ('06','05'), ('06','12'), ('07','12'), ('07','01'), ('07','04'), ('08','03'), ('10','04'),
    ('12','02'), ('12','06'), ('14','07'), ('16','05'), ('16','01'), ('17','12'), ('19','04'), ('19','11')
  ) as x(e, u)
 where exists (select 1 from public.events e where e.id = ('e0000000-0000-4000-8000-0000000000' || x.e)::uuid)
on conflict do nothing;

-- one weekly series (Tue + Thu 19:00) materialised for the 14-day horizon
with org as (select p.id, d.center from public.profiles p join public.districts d on d.key = p.district_key
              where p.id = 'd0000000-0000-4000-8000-000000000012'),
     ven as (select v.id from public.venues v, org
              where v.status = 'active'
                and exists (select 1 from public.venue_sports vs where vs.venue_id = v.id and vs.sport_id = 'football' and not vs.inferred)
              order by (v.name is null), v.location operator(extensions.<->) org.center limit 1)
insert into public.event_series (id, organizer_id, sport_id, venue_id, title, spots_total, spots_reserved, level,
                                 weekdays, start_time, duration_min, starts_on, until_on, is_mock)
select 'f0000000-0000-4000-8000-000000000001', org.id, 'football', ven.id, '[DEV] Wtorek/czwartek — piłka', 12, 2, 3,
       array[2,4]::smallint[], time '19:00', 90, (now() at time zone 'Europe/Warsaw')::date,
       (now() at time zone 'Europe/Warsaw')::date + 56, true
  from org, ven
on conflict (id) do nothing;
select private.materialize_series('f0000000-0000-4000-8000-000000000001', 14)
 where exists (select 1 from public.event_series s where s.id = 'f0000000-0000-4000-8000-000000000001');

-- ---- one match (dev01 ↔ dev02) with a conversation and messages ----------------
insert into public.swipes (swiper_id, target_id, liked, sport_id) values
  ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', true, 'football'),
  ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', true, 'football'),
  ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', true, 'football')
on conflict do nothing;

insert into public.matches (id, user_a, user_b)
values ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.conversations (id, kind, match_id)
values ('c0000000-0000-4000-8000-000000000001', 'match', 'a0000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.conversation_members (conversation_id, user_id) values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, kind, body, created_at)
select m.id::uuid, 'c0000000-0000-4000-8000-000000000001', m.sender::uuid, 'text', m.body, now() - m.ago
  from (values
    ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'Cześć! Widzę, że też grasz w piłkę 🙂', interval '50 minutes'),
    ('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Hej! Tak, zwykle wieczorami na Mokotowie.', interval '45 minutes'),
    ('b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'Super, może w czwartek o 20?', interval '40 minutes'),
    ('b0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'Pasuje. Wyślę zaproszenie na boisko.', interval '5 minutes')
  ) as m(id, sender, body, ago)
on conflict (id) do nothing;

-- some chat in the first event conversation
insert into public.messages (conversation_id, sender_id, kind, body)
select c.id, m.sender::uuid, 'text', m.body
  from public.conversations c
  cross join (values ('d0000000-0000-4000-8000-000000000012', 'Bierzcie jasne i ciemne koszulki!'),
                     ('d0000000-0000-4000-8000-000000000002', 'Będę 10 min wcześniej.')) as m(sender, body)
 where c.event_id = 'e0000000-0000-4000-8000-000000000001'
   and not exists (select 1 from public.messages x where x.conversation_id = c.id and x.kind = 'text');
