-- Bojo — privacy & abuse hardening (security review follow-up, lead decisions)
--
--  1/2  Cross-user distance = distance between COARSE cells (~2 km: lat step 0.02°, lng step 0.03°, cell
--       centres), bucketed 3/5/10/15/25 km. score_distance/score derive from the bucket only.
--       (C1: before, -5·ln(score_distance) revealed the exact home-to-home distance.)
--  3    set_home_location: first change after onboarding is free, then at most 1 change per 7 days.
--  4    person_summary: distance/common_slots only with an active match OR (target discoverable AND caller
--       onboarded); common_slots full only for an active match, else max 3 (also in match_candidates).
--  5    M1  event_series_read hides series of blocked organizers.
--  6    M3  authenticated can no longer read venues.created_by / venue_photos.uploaded_by (column grants).
--  7    H2  password sessions are refused by a GoTrue custom-access-token hook (see private.auth_token_hook).
--  8    M4  ≤5 push tokens per user, stricter token format, claim caps (100 notifications × 5 tokens).
--  9    M5  the "joined" system message is posted only the first time a user joins an event.
-- 10    M6  no implicit EXECUTE-to-PUBLIC for any future function created by postgres.
-- 11    L1  reports_autohide counts only onboarded reporters whose account is older than 3 days.

-- ---------------------------------------------------------------------------
-- 1) coarse cells + new buckets
-- ---------------------------------------------------------------------------

-- <3 → 3; <7 → 5; <12 → 10; <20 → 15; else 25 (same as packages/shared/src/distance.ts)
create or replace function private.approx_distance_km(p_km float8) returns int
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select case
    when p_km is null then null
    when p_km < 3  then 3
    when p_km < 7  then 5
    when p_km < 12 then 10
    when p_km < 20 then 15
    else 25 end;
$$;

-- Centre of the ~2 km cell (0.02° lat × 0.03° lng) containing the point.
create function private.coarse_cell(p extensions.geography) returns extensions.geography
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select case when p is null then null else
    extensions.st_setsrid(extensions.st_makepoint(
      ((floor((extensions.st_x(p::extensions.geometry))::numeric / 0.03) + 0.5) * 0.03)::float8,
      ((floor((extensions.st_y(p::extensions.geometry))::numeric / 0.02) + 0.5) * 0.02)::float8), 4326)::extensions.geography
  end;
$$;

-- km between the coarse cells of two homes (the ONLY cross-user distance primitive).
create function private.coarse_distance_km(p_a extensions.geography, p_b extensions.geography) returns float8
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select case when p_a is null or p_b is null then null
              else extensions.st_distance(private.coarse_cell(p_a), private.coarse_cell(p_b)) / 1000.0 end;
$$;

-- ---------------------------------------------------------------------------
-- 2/4) match_candidates (same signature + result type → grants preserved)
-- ---------------------------------------------------------------------------
create or replace function public.match_candidates(p_limit int default 20, p_sport_id text default null)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
  goal public.user_goal, is_verified boolean, reliability_score smallint,
  sport_ids text[], sport_levels smallint[], common_sport_ids text[], distance_km_approx int,
  score real, score_sport real, score_level real, score_schedule real, score_distance real,
  common_slots text[])
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid(); v_home extensions.geography; v_district text; v_my_sports int; v_my_slots int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select p.district_key, pp.home_location into v_district, v_home
    from public.profiles p join public.profile_private pp on pp.user_id = p.id
   where p.id = v_uid and p.onboarded_at is not null;
  if not found then raise exception 'profile_incomplete'; end if;
  select count(*) into v_my_sports from public.user_sports us where us.user_id = v_uid;
  if v_my_sports = 0 then raise exception 'profile_incomplete'; end if;
  select count(*) into v_my_slots from public.availability_slots a where a.user_id = v_uid;

  return query
  with my_sports as (select us.sport_id, us.level from public.user_sports us where us.user_id = v_uid),
  pool as (
    select p.id, p.display_name, p.avatar_path, p.bio, p.district_key, p.goal, p.is_verified,
           p.reliability_score,
           private.approx_distance_km(private.coarse_distance_km(v_home, pp.home_location)) as bucket,
           private.coarse_distance_km(v_home, pp.home_location) as coarse_km
    from public.profiles p join public.profile_private pp on pp.user_id = p.id
    where p.id <> v_uid and p.onboarded_at is not null and p.discoverable
      and not private.is_blocked_pair(v_uid, p.id)
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = p.id
                        and (s.liked or s.created_at > now() - interval '14 days'))
      and not exists (select 1 from public.matches m
                       where m.user_a = least(v_uid, p.id) and m.user_b = greatest(v_uid, p.id))
      and exists (select 1 from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
                   where us.user_id = p.id and (p_sport_id is null or us.sport_id = p_sport_id))
  ),
  pool30 as (select * from pool where pool.coarse_km is null or pool.coarse_km < 30),   -- 30 km on coarse cells
  theirs as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as sport_ids,
           array_agg(us.level order by us.sport_id) as sport_levels, count(*)::int as n
    from public.user_sports us where us.user_id in (select pool30.id from pool30) group by us.user_id),
  common as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as common_ids, count(*)::int as n,
           avg(1.0 - abs(us.level - ms.level) / 4.0)::real as level_close
    from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
    where us.user_id in (select pool30.id from pool30) group by us.user_id),
  sched as (
    select a.user_id, count(*)::int as n,
           count(*) filter (where exists (select 1 from public.availability_slots m
               where m.user_id = v_uid and m.weekday = a.weekday and m.day_part = a.day_part))::int as overlap_n
    from public.availability_slots a where a.user_id in (select pool30.id from pool30) group by a.user_id),
  comp as (
    select p.*, t.sport_ids, t.sport_levels, c.common_ids,
      (c.n::real / (t.n + v_my_sports - c.n))::real as s_sport,
      c.level_close as s_level,
      (case when coalesce(sc.n,0) = 0 or v_my_slots = 0 then 0.5
            else sc.overlap_n::real / least(sc.n, v_my_slots) end)::real as s_sched,
      -- distance factor from the BUCKET only (never from a continuous distance)
      (case when p.bucket is not null then exp(-p.bucket / 5.0)
            when v_district is not null and p.district_key = v_district then exp(-3.0 / 5.0)
            else 0.3 end)::real as s_dist
    from pool30 p join theirs t on t.user_id = p.id join common c on c.user_id = p.id
    left join sched sc on sc.user_id = p.id)
  select c2.id, c2.display_name, c2.avatar_path, c2.bio, c2.district_key, c2.goal, c2.is_verified,
         c2.reliability_score, c2.sport_ids, c2.sport_levels, c2.common_ids,
         c2.bucket,
         ((0.25 + 0.75*c2.s_sport) * (0.25 + 0.75*c2.s_level) * (0.4 + 0.6*c2.s_sched) * (0.2 + 0.8*c2.s_dist))::real,
         c2.s_sport, c2.s_level, c2.s_sched, c2.s_dist,
         (private.common_slots(v_uid, c2.id))[1:3]                     -- not matched → at most 3 slots
  from comp c2
  order by 13 desc, c2.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

-- ---------------------------------------------------------------------------
-- 4) person_summary (same signature + result type → grants preserved)
-- ---------------------------------------------------------------------------
create or replace function public.person_summary(p_user_id uuid)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
               goal public.user_goal, is_verified boolean, reliability_score int, attended_count int,
               sport_ids text[], sport_levels int[], common_sport_ids text[], distance_km_approx int,
               match_id uuid, conversation_id uuid, is_me boolean, common_slots text[])
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid     uuid := private.require_uid();
  v_matched boolean := false;
  v_visible boolean := false;
  v_bucket  int;
  v_slots   text[] := '{}'::text[];
begin
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id)
     or private.is_blocked_pair(v_uid, p_user_id) then
    raise exception 'not_found';
  end if;
  if p_user_id <> v_uid then
    v_matched := exists (select 1 from public.matches m
                          where m.user_a = least(v_uid, p_user_id) and m.user_b = greatest(v_uid, p_user_id)
                            and m.status = 'active');
    v_visible := v_matched
      or (exists (select 1 from public.profiles t where t.id = p_user_id and t.discoverable)
          and exists (select 1 from public.profiles me where me.id = v_uid and me.onboarded_at is not null));
    if v_visible then
      select private.approx_distance_km(private.coarse_distance_km(a.home_location, b.home_location)) into v_bucket
        from public.profile_private a, public.profile_private b
       where a.user_id = v_uid and b.user_id = p_user_id;
      v_slots := private.common_slots(v_uid, p_user_id);
      if not v_matched then v_slots := v_slots[1:3]; end if;
    end if;
  end if;
  return query
  select p.id, p.display_name, p.avatar_path, p.bio, p.district_key, p.goal, p.is_verified,
         p.reliability_score::int, p.attended_count,
         coalesce((select array_agg(us.sport_id order by s.sort_order) from public.user_sports us
                    join public.sports s on s.id = us.sport_id where us.user_id = p.id), '{}'),
         coalesce((select array_agg(us.level::int order by s.sort_order) from public.user_sports us
                    join public.sports s on s.id = us.sport_id where us.user_id = p.id), '{}'),
         coalesce((select array_agg(us.sport_id order by s.sort_order) from public.user_sports us
                    join public.sports s on s.id = us.sport_id
                   where us.user_id = p.id and p.id <> v_uid
                     and exists (select 1 from public.user_sports mine
                                  where mine.user_id = v_uid and mine.sport_id = us.sport_id)), '{}'),
         v_bucket,
         mt.id, cv.id,
         (p.id = v_uid),
         coalesce(v_slots, '{}')
    from public.profiles p
    left join public.matches mt on p.id <> v_uid and mt.status = 'active'
                               and mt.user_a = least(v_uid, p.id) and mt.user_b = greatest(v_uid, p.id)
    left join public.conversations cv on cv.match_id = mt.id
   where p.id = p_user_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3) home moves: free before/at the first change after onboarding, then 1 per 7 days
--    home_location_changes_count = changes made after onboarding (no longer reset daily),
--    home_location_updated_at   = time of the last change (kept by clear_home_location).
-- ---------------------------------------------------------------------------
create or replace function public.set_home_location(p_lat float8, p_lng float8)
returns table (district_key text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid      uuid := private.require_uid();
  v_today    date := (now() at time zone 'Europe/Warsaw')::date;
  v_pp       public.profile_private%rowtype;
  v_onboard  timestamptz;
  v_point    extensions.geography;
  v_district text;
begin
  if p_lat is null or p_lng is null or p_lat <> p_lat or p_lng <> p_lng then raise exception 'invalid_input'; end if;
  if not private.in_service_area(p_lat, p_lng) then raise exception 'outside_service_area'; end if;

  select p.onboarded_at into v_onboard from public.profiles p where p.id = v_uid;
  select * into v_pp from public.profile_private pp where pp.user_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if v_onboard is not null and v_pp.home_location_changes_count > 0
     and v_pp.home_location_updated_at is not null
     and v_pp.home_location_updated_at > now() - interval '7 days' then
    raise exception 'rate_limited';
  end if;

  v_point := private.snap_home_point(p_lat, p_lng);      -- stored precision stays ~550 m
  v_district := private.district_key_for(v_point);

  update public.profile_private pp
     set home_location = v_point,
         home_location_updated_at = now(),
         home_location_changes_count = case when v_onboard is not null
                                            then pp.home_location_changes_count + 1
                                            else pp.home_location_changes_count end,
         home_location_changes_on = case when v_onboard is not null then v_today else pp.home_location_changes_on end
   where pp.user_id = v_uid;

  update public.profiles p set district_key = v_district
   where p.id = v_uid and p.district_key is null and v_district is not null;

  return query select v_district;
end $$;

-- keeps home_location_updated_at so clear+set cannot bypass the 7-day limit
create or replace function public.clear_home_location()
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  update public.profile_private pp set home_location = null where pp.user_id = v_uid;
end $$;

-- no more daily counter reset (the counter now means "changes since onboarding")
create or replace function private.cleanup() returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  delete from public.notifications n where n.created_at < now() - interval '90 days';
end $$;

-- ---------------------------------------------------------------------------
-- 5) M1: series of blocked organizers are invisible (like events_read)
-- ---------------------------------------------------------------------------
drop policy event_series_read on public.event_series;
create policy event_series_read on public.event_series for select to authenticated
  using ((visibility = 'public' or organizer_id = (select auth.uid()))
         and (organizer_id = (select auth.uid())
              or not private.is_blocked_pair((select auth.uid()), organizer_id)));

-- ---------------------------------------------------------------------------
-- 6) M3: column-list SELECT grants without venues.created_by / venue_photos.uploaded_by
--    (RLS policies may still reference them; is_mine is computed server-side in venue_detail)
-- ---------------------------------------------------------------------------
revoke select on public.venues, public.venue_photos from authenticated;
grant select (id, name, kind, location, route_path, district_key, address, surface, is_lit, is_free, is_indoor,
              access, opening_hours, website, phone, source, osm_type, osm_id, osm_tags, osm_imported_at,
              locally_edited_at, status, is_mock, created_at, updated_at)
  on public.venues to authenticated;
grant select (id, venue_id, storage_path, external_url, attribution, status, is_mock, created_at)
  on public.venue_photos to authenticated;

-- ---------------------------------------------------------------------------
-- 7) H2: refuse password sessions (GoTrue custom access token hook, wired in config.toml).
--    OTP users also carry a bcrypt hash (GoTrue signs passwordless users up with a random password), so
--    sign-up rows cannot be told apart at INSERT time; refusing the `password` grant is the reliable cut.
-- ---------------------------------------------------------------------------
create function private.auth_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = public, extensions, pg_temp as $$
begin
  if event ->> 'authentication_method' = 'password' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Password sign-in is disabled. Sign in with the email code.'));
  end if;
  return event;
end $$;
revoke all on function private.auth_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.auth_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 8) M4: push tokens
-- ---------------------------------------------------------------------------
create or replace function public.register_push_token(p_token text, p_platform public.push_platform)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if p_token is null or p_platform is null
     or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,64}\]$' then
    raise exception 'invalid_input';
  end if;
  insert into public.push_tokens as t (token, user_id, platform, last_seen_at)
  values (p_token, v_uid, p_platform, now())
  on conflict on constraint push_tokens_pkey
  do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
  -- keep the 5 most recently seen devices
  delete from public.push_tokens t
   where t.user_id = v_uid
     and t.token not in (select k.token from public.push_tokens k where k.user_id = v_uid
                          order by k.last_seen_at desc, k.token limit 5);
end $$;

create or replace function public.claim_push_batch(p_ids uuid[] default null, p_limit int default 100)
returns table (notification_id uuid, user_id uuid, type public.notification_type, payload jsonb, locale text,
               tokens text[])
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_limit int := least(greatest(coalesce(p_limit, 100), 1), 100);   -- ≤100 notifications × ≤5 tokens
begin
  if p_ids is null then
    update public.notifications n set push_status = 'failed', push_error = coalesce(n.push_error, 'stale')
     where n.push_status = 'sending' and n.push_attempts >= 3
       and n.push_claimed_at < now() - interval '5 minutes';
  end if;

  return query
  with picked as (
    select n.id, n.user_id
      from public.notifications n
     where case when p_ids is not null
                then n.id = any (p_ids) and n.push_status = 'pending'
                else (n.push_status = 'pending' and n.created_at < now() - interval '20 seconds')
                  or (n.push_status = 'sending' and n.push_attempts < 3
                      and n.push_claimed_at < now() - interval '5 minutes') end
     order by n.created_at
     limit v_limit
     for update skip locked),
  info as (
    select pk.id, pk.user_id, coalesce(pp.push_enabled, false) as enabled, coalesce(pp.locale, 'ru') as locale,
           (select array_agg(k.token) from (select t.token from public.push_tokens t where t.user_id = pk.user_id
                                             order by t.last_seen_at desc, t.token limit 5) k) as tokens
      from picked pk left join public.profile_private pp on pp.user_id = pk.user_id),
  skipped as (
    update public.notifications n set push_status = 'skipped'
      from info i
     where n.id = i.id and (not i.enabled or i.tokens is null)
    returning n.id),
  claimed as (
    update public.notifications n
       set push_status = 'sending', push_attempts = n.push_attempts + 1, push_claimed_at = now()
      from info i
     where n.id = i.id and i.enabled and i.tokens is not null
    returning n.id, n.user_id, n.type, n.payload, i.locale, i.tokens)
  select cl.id, cl.user_id, cl.type, cl.payload, cl.locale, cl.tokens from claimed cl;
end $$;

-- ---------------------------------------------------------------------------
-- 9) M5: "joined" system message only the first time a user becomes 'going' for an event
-- ---------------------------------------------------------------------------
create or replace function private.tg_event_participants_notify() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_ev    public.events%rowtype;
  v_name  text;
  v_going int;
  v_conv  uuid;
begin
  if new.status <> 'going' or (tg_op = 'UPDATE' and old.status = 'going') then return null; end if;
  select * into v_ev from public.events e where e.id = new.event_id;
  if not found or v_ev.organizer_id = new.user_id then return null; end if;

  select p.display_name into v_name from public.profiles p where p.id = new.user_id;
  select count(*) into v_going from public.event_participants p where p.event_id = new.event_id and p.status = 'going';

  insert into public.notifications (user_id, type, payload, dedupe_key)
  values (v_ev.organizer_id, 'event_joined',
          jsonb_build_object('event_id', v_ev.id, 'sport_id', v_ev.sport_id, 'starts_at', v_ev.starts_at,
                             'user_id', new.user_id, 'user_name', coalesce(v_name, ''),
                             'spots_left', greatest(v_ev.spots_total - v_ev.spots_reserved - v_going, 0),
                             'url', '/event/' || v_ev.id),
          'joined:' || v_ev.id || ':' || new.user_id)
  on conflict on constraint notifications_dedupe_uniq do nothing;

  select c.id into v_conv from public.conversations c where c.event_id = new.event_id;
  if v_conv is not null and not exists (
       select 1 from public.messages m
        where m.conversation_id = v_conv and m.kind = 'system'
          and m.payload ->> 'type' = 'joined' and m.payload ->> 'user_id' = new.user_id::text) then
    perform private.post_system_message(v_conv, jsonb_build_object('type', 'joined', 'user_id', new.user_id));
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 10) M6: future functions created by postgres (any schema) get no EXECUTE for PUBLIC
-- ---------------------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 11) L1: autohide only counts established reporters (onboarded, account older than 3 days)
-- ---------------------------------------------------------------------------
create or replace function private.tg_reports_autohide() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_n int;
begin
  if new.target_type not in ('venue_photo', 'venue') then return null; end if;
  select count(distinct r.reporter_id) into v_n
    from public.reports r
    join public.profiles p on p.id = r.reporter_id
   where r.target_type = new.target_type and r.target_id = new.target_id
     and p.onboarded_at is not null and p.created_at < now() - interval '3 days';
  if v_n < 3 then return null; end if;     -- otherwise the report just stays open for moderators
  if new.target_type = 'venue_photo' then
    update public.venue_photos ph set status = 'hidden' where ph.id = new.target_id and ph.status = 'active';
  else
    update public.venues v set status = 'hidden' where v.id = new.target_id and v.source = 'user' and v.status = 'active';
  end if;
  return null;
end $$;

-- new private helpers: not callable by clients
revoke all on function private.coarse_cell(extensions.geography),
                       private.coarse_distance_km(extensions.geography, extensions.geography)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12) UX: venues_in_bbox also returns district_key and today_events_count (public scheduled events that
--     start between now and the end of today, Europe/Warsaw — the events_feed 'today' window).
--     Return type changes → drop + create; EXECUTE re-granted to anon + authenticated.
-- ---------------------------------------------------------------------------
create function private.venue_today_count(p_venue_id uuid) returns int
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select count(*)::int from public.events e
   where e.venue_id = p_venue_id and e.status = 'scheduled' and e.visibility = 'public'
     and e.starts_at >= now()
     and e.starts_at < (((now() at time zone 'Europe/Warsaw')::date + 1)::timestamp at time zone 'Europe/Warsaw');
$$;
revoke all on function private.venue_today_count(uuid) from public, anon, authenticated;

drop function public.venues_in_bbox(float8, float8, float8, float8, text[], int);
create function public.venues_in_bbox(
  p_min_lng float8, p_min_lat float8, p_max_lng float8, p_max_lat float8,
  p_sport_ids text[] default null, p_limit int default 400)
returns table (id uuid, name text, kind public.venue_kind, lat float8, lng float8, sport_ids text[],
               is_lit boolean, is_free boolean, surface text, upcoming_events_count int,
               district_key text, today_events_count int)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_env    extensions.geography;
  v_center extensions.geography;
  v_limit  int := least(greatest(coalesce(p_limit, 400), 1), 1000);
  v_sports text[] := case when cardinality(p_sport_ids) > 0 then p_sport_ids end;
begin
  if p_min_lng is null or p_min_lat is null or p_max_lng is null or p_max_lat is null
     or p_min_lng >= p_max_lng or p_min_lat >= p_max_lat
     or p_min_lat < -90 or p_max_lat > 90 or p_min_lng < -180 or p_max_lng > 180 then
    raise exception 'invalid_input';
  end if;
  v_env    := extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography;
  v_center := extensions.st_setsrid(extensions.st_makepoint((p_min_lng + p_max_lng) / 2, (p_min_lat + p_max_lat) / 2), 4326)::extensions.geography;

  return query
  select v.id, v.name, v.kind,
         extensions.st_y(v.location::extensions.geometry), extensions.st_x(v.location::extensions.geometry),
         private.venue_sport_ids(v.id), v.is_lit, v.is_free, v.surface,
         private.venue_upcoming_count(v.id),
         v.district_key,
         private.venue_today_count(v.id)
    from public.venues v
   where v.status = 'active'
     and v.location operator(extensions.&&) v_env
     and (v_sports is null or exists (select 1 from public.venue_sports vs
                                       where vs.venue_id = v.id and vs.sport_id = any (v_sports)))
   order by v.location operator(extensions.<->) v_center, v.id
   limit v_limit;
end $$;
revoke all on function public.venues_in_bbox(float8, float8, float8, float8, text[], int) from public, anon, authenticated;
grant execute on function public.venues_in_bbox(float8, float8, float8, float8, text[], int) to anon, authenticated;
