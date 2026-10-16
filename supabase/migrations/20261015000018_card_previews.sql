-- Bojo — card previews (lead follow-up to ARCHITECTURE §5.2 / §5.4)
-- 1) EventCardRow.participants_preview: up to 4 going participants {user_id, display_name, avatar_path},
--    organizer first then joined_at; users in a blocked pair with the caller excluded; NULL for anon.
-- 2) CandidateRow / PersonSummaryRow.common_slots: intersection of the caller's and the target's availability
--    as '<weekday>:<day_part>' (= shared slotKey()), sorted weekday → morning/afternoon/evening. The target's
--    non-overlapping slots are never returned.
-- Return types change → drop + create. EXECUTE is re-granted exactly as in 20261015000014_grants.sql.

drop function public.events_feed(float8, float8, float8, text[], text, text, uuid, boolean, int, timestamptz, uuid);
drop function public.my_events(text, int);
drop function public.event_detail(uuid);
drop function public.match_candidates(int, text);
drop function public.person_summary(uuid);
drop function private.event_cards(uuid[], uuid, extensions.geography);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create function private.event_cards(p_ids uuid[], p_uid uuid, p_ref extensions.geography)
returns table (id uuid, series_id uuid, sport_id text, title text, starts_at timestamptz, ends_at timestamptz,
               spots_total int, spots_taken int, spots_reserved int, spots_left int, level int,
               status public.event_status, visibility public.event_visibility,
               venue_id uuid, venue_name text, venue_kind public.venue_kind, venue_lat float8, venue_lng float8,
               district_key text, distance_km float8,
               organizer_id uuid, organizer_name text, organizer_avatar_path text,
               organizer_reliability int, organizer_is_verified boolean,
               my_status public.participant_status, is_organizer boolean, participants_preview jsonb, ord int)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select e.id, e.series_id, e.sport_id, e.title, e.starts_at, e.ends_at,
         e.spots_total::int, e.spots_taken::int, e.spots_reserved::int,
         greatest(e.spots_total - e.spots_taken - e.spots_reserved, 0)::int,
         e.level::int, e.status, e.visibility,
         v.id, v.name, v.kind,
         extensions.st_y(v.location::extensions.geometry), extensions.st_x(v.location::extensions.geometry),
         v.district_key,
         case when p_ref is not null
              then round((extensions.st_distance(v.location, p_ref) / 1000.0)::numeric, 1)::float8 end,
         case when p_uid is not null then e.organizer_id end,
         case when p_uid is not null then o.display_name end,
         case when p_uid is not null then o.avatar_path end,
         case when p_uid is not null then o.reliability_score::int end,
         case when p_uid is not null then o.is_verified end,
         case when p_uid is not null then
           (select ep.status from public.event_participants ep where ep.event_id = e.id and ep.user_id = p_uid) end,
         (p_uid is not null and e.organizer_id = p_uid),
         case when p_uid is not null then pv.preview end,          -- anon never sees identities
         array_position(p_ids, e.id)
    from public.events e
    join public.venues v on v.id = e.venue_id
    join public.profiles o on o.id = e.organizer_id
    left join lateral (
      select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'display_name', x.display_name,
                                                   'avatar_path', x.avatar_path)
                                order by x.is_org desc, x.joined_at, x.user_id), '[]'::jsonb) as preview
        from (select ep.user_id, pr.display_name, pr.avatar_path, ep.joined_at,
                     (ep.user_id = e.organizer_id) as is_org
                from public.event_participants ep
                join public.profiles pr on pr.id = ep.user_id
               where ep.event_id = e.id and ep.status = 'going'
                 and (ep.user_id = p_uid or not private.is_blocked_pair(p_uid, ep.user_id))
               order by (ep.user_id = e.organizer_id) desc, ep.joined_at, ep.user_id
               limit 4) x
       where p_uid is not null) pv on true
   where e.id = any (p_ids)
   order by array_position(p_ids, e.id);
$$;

-- Overlapping availability of two users as sorted slot keys ('2:evening'). Never exposes non-overlapping slots.
create function private.common_slots(p_a uuid, p_b uuid) returns text[]
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(array_agg(a.weekday::text || ':' || a.day_part::text order by a.weekday, a.day_part), '{}')
    from public.availability_slots a
    join public.availability_slots b on b.user_id = p_b and b.weekday = a.weekday and b.day_part = a.day_part
   where a.user_id = p_a;
$$;

-- ---------------------------------------------------------------------------
-- events (same bodies as 20261015000010, plus participants_preview)
-- ---------------------------------------------------------------------------

create function public.events_feed(
  p_lat float8 default null, p_lng float8 default null, p_radius_km float8 default 15,
  p_sport_ids text[] default null, p_date_range text default 'upcoming', p_district_key text default null,
  p_venue_id uuid default null, p_only_with_spots boolean default false, p_limit int default 30,
  p_cursor_starts_at timestamptz default null, p_cursor_id uuid default null)
returns table (id uuid, series_id uuid, sport_id text, title text, starts_at timestamptz, ends_at timestamptz,
               spots_total int, spots_taken int, spots_reserved int, spots_left int, level int,
               status public.event_status, visibility public.event_visibility,
               venue_id uuid, venue_name text, venue_kind public.venue_kind, venue_lat float8, venue_lng float8,
               district_key text, distance_km float8,
               organizer_id uuid, organizer_name text, organizer_avatar_path text,
               organizer_reliability int, organizer_is_verified boolean,
               my_status public.participant_status, is_organizer boolean, participants_preview jsonb)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'Europe/Warsaw')::date;
  v_dow    int  := extract(isodow from (now() at time zone 'Europe/Warsaw'))::int;
  v_from   timestamptz;
  v_to     timestamptz;
  v_ref    extensions.geography;
  v_radius float8 := least(greatest(coalesce(p_radius_km, 15), 0.5), 100) * 1000;
  v_limit  int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_sports text[] := case when cardinality(p_sport_ids) > 0 then p_sport_ids end;
  v_spots  boolean := coalesce(p_only_with_spots, false);
  v_ids    uuid[];
begin
  case coalesce(p_date_range, 'upcoming')
    when 'today'    then v_from := now(); v_to := (v_today + 1)::timestamp at time zone 'Europe/Warsaw';
    when 'tomorrow' then v_from := (v_today + 1)::timestamp at time zone 'Europe/Warsaw';
                         v_to   := (v_today + 2)::timestamp at time zone 'Europe/Warsaw';
    when 'weekend'  then v_from := case when v_dow >= 6 then now()
                                        else (v_today + (6 - v_dow))::timestamp at time zone 'Europe/Warsaw' end;
                         v_to   := (v_today + (8 - v_dow))::timestamp at time zone 'Europe/Warsaw';
    when 'week'     then v_from := now(); v_to := now() + interval '7 days';
    when 'upcoming' then v_from := now(); v_to := now() + interval '60 days';
    else raise exception 'invalid_input';
  end case;

  if (p_lat is null) <> (p_lng is null) then raise exception 'invalid_input'; end if;
  if p_lat is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_input'; end if;
    v_ref := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  select array_agg(x.id order by x.starts_at, x.id) into v_ids
  from (
    select e.id, e.starts_at
      from public.events e
      join public.venues v on v.id = e.venue_id
     where e.status = 'scheduled' and e.visibility = 'public'
       and e.starts_at >= v_from and e.starts_at < v_to
       and (v_sports is null or e.sport_id = any (v_sports))
       and (p_district_key is null or v.district_key = p_district_key)
       and (p_venue_id is null or e.venue_id = p_venue_id)
       and (p_venue_id is not null or v_ref is null or extensions.st_dwithin(v.location, v_ref, v_radius))
       and (not v_spots or e.spots_taken + e.spots_reserved < e.spots_total)
       and (v_uid is null or not private.is_blocked_pair(v_uid, e.organizer_id))
       and (p_cursor_starts_at is null
            or (p_cursor_id is null and e.starts_at > p_cursor_starts_at)
            or (p_cursor_id is not null and (e.starts_at, e.id) > (p_cursor_starts_at, p_cursor_id)))
     order by e.starts_at, e.id
     limit v_limit) x;

  if v_ids is null then return; end if;
  return query
  select c.id, c.series_id, c.sport_id, c.title, c.starts_at, c.ends_at, c.spots_total, c.spots_taken,
         c.spots_reserved, c.spots_left, c.level, c.status, c.visibility, c.venue_id, c.venue_name, c.venue_kind,
         c.venue_lat, c.venue_lng, c.district_key, c.distance_km, c.organizer_id, c.organizer_name,
         c.organizer_avatar_path, c.organizer_reliability, c.organizer_is_verified, c.my_status, c.is_organizer,
         c.participants_preview
    from private.event_cards(v_ids, v_uid, v_ref) c
   order by c.ord;
end $$;

create function public.my_events(p_scope text default 'upcoming', p_limit int default 50)
returns table (id uuid, series_id uuid, sport_id text, title text, starts_at timestamptz, ends_at timestamptz,
               spots_total int, spots_taken int, spots_reserved int, spots_left int, level int,
               status public.event_status, visibility public.event_visibility,
               venue_id uuid, venue_name text, venue_kind public.venue_kind, venue_lat float8, venue_lng float8,
               district_key text, distance_km float8,
               organizer_id uuid, organizer_name text, organizer_avatar_path text,
               organizer_reliability int, organizer_is_verified boolean,
               my_status public.participant_status, is_organizer boolean, participants_preview jsonb)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid   uuid := private.require_uid();
  v_scope text := coalesce(p_scope, 'upcoming');
  v_limit int  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_ids   uuid[];
begin
  if v_scope not in ('upcoming', 'past') then raise exception 'invalid_input'; end if;
  select array_agg(x.id order by x.rk) into v_ids
  from (
    select e.id, row_number() over (order by case when v_scope = 'upcoming' then e.starts_at end asc,
                                              case when v_scope = 'past' then e.starts_at end desc, e.id) as rk
      from public.events e
     where (e.organizer_id = v_uid
            or exists (select 1 from public.event_participants ep
                        where ep.event_id = e.id and ep.user_id = v_uid and ep.status in ('going', 'invited')))
       and case when v_scope = 'upcoming' then e.ends_at >= now() else e.ends_at < now() end
     order by rk
     limit v_limit) x;
  if v_ids is null then return; end if;
  return query
  select c.id, c.series_id, c.sport_id, c.title, c.starts_at, c.ends_at, c.spots_total, c.spots_taken,
         c.spots_reserved, c.spots_left, c.level, c.status, c.visibility, c.venue_id, c.venue_name, c.venue_kind,
         c.venue_lat, c.venue_lng, c.district_key, c.distance_km, c.organizer_id, c.organizer_name,
         c.organizer_avatar_path, c.organizer_reliability, c.organizer_is_verified, c.my_status, c.is_organizer,
         c.participants_preview
    from private.event_cards(v_ids, v_uid, null) c
   order by c.ord;
end $$;

create function public.event_detail(p_event_id uuid)
returns table (id uuid, series_id uuid, sport_id text, title text, starts_at timestamptz, ends_at timestamptz,
               spots_total int, spots_taken int, spots_reserved int, spots_left int, level int,
               status public.event_status, visibility public.event_visibility,
               venue_id uuid, venue_name text, venue_kind public.venue_kind, venue_lat float8, venue_lng float8,
               district_key text, distance_km float8,
               organizer_id uuid, organizer_name text, organizer_avatar_path text,
               organizer_reliability int, organizer_is_verified boolean,
               my_status public.participant_status, is_organizer boolean, participants_preview jsonb,
               description text, cancel_reason text, venue_address text, series_weekdays int[],
               conversation_id uuid, can_join boolean, attendance_open boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid();
begin
  if p_event_id is null or not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  return query
  select c.id, c.series_id, c.sport_id, c.title, c.starts_at, c.ends_at, c.spots_total, c.spots_taken,
         c.spots_reserved, c.spots_left, c.level, c.status, c.visibility, c.venue_id, c.venue_name, c.venue_kind,
         c.venue_lat, c.venue_lng, c.district_key, c.distance_km, c.organizer_id, c.organizer_name,
         c.organizer_avatar_path, c.organizer_reliability, c.organizer_is_verified, c.my_status, c.is_organizer,
         c.participants_preview,
         e.description, e.cancel_reason, v.address,
         (select array(select w::int from unnest(s.weekdays) w order by w) from public.event_series s where s.id = e.series_id),
         case when c.my_status = 'going' then (select cv.id from public.conversations cv where cv.event_id = e.id) end,
         (e.status = 'scheduled' and e.starts_at > now() and c.spots_left > 0
          and not c.is_organizer
          and c.my_status is distinct from 'going' and c.my_status is distinct from 'removed'
          and (e.visibility = 'public' or c.my_status = 'invited')),
         (c.is_organizer and e.status <> 'cancelled'
          and now() between e.starts_at and e.ends_at + interval '72 hours'),
         e.created_at
    from private.event_cards(array[p_event_id], v_uid, null) c
    join public.events e on e.id = c.id
    join public.venues v on v.id = e.venue_id;
end $$;

-- ---------------------------------------------------------------------------
-- people (same bodies as 20261015000011, plus common_slots)
-- ---------------------------------------------------------------------------

create function public.match_candidates(p_limit int default 20, p_sport_id text default null)
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
           p.reliability_score, pp.home_location
    from public.profiles p join public.profile_private pp on pp.user_id = p.id
    where p.id <> v_uid and p.onboarded_at is not null and p.discoverable
      and not private.is_blocked_pair(v_uid, p.id)
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = p.id
                        and (s.liked or s.created_at > now() - interval '14 days'))
      and not exists (select 1 from public.matches m
                       where m.user_a = least(v_uid, p.id) and m.user_b = greatest(v_uid, p.id))
      and exists (select 1 from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
                   where us.user_id = p.id and (p_sport_id is null or us.sport_id = p_sport_id))
      and (v_home is null or pp.home_location is null or extensions.st_dwithin(v_home, pp.home_location, 30000))
  ),
  theirs as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as sport_ids,
           array_agg(us.level order by us.sport_id) as sport_levels, count(*)::int as n
    from public.user_sports us where us.user_id in (select pool.id from pool) group by us.user_id),
  common as (
    select us.user_id, array_agg(us.sport_id order by us.sport_id) as common_ids, count(*)::int as n,
           avg(1.0 - abs(us.level - ms.level) / 4.0)::real as level_close
    from public.user_sports us join my_sports ms on ms.sport_id = us.sport_id
    where us.user_id in (select pool.id from pool) group by us.user_id),
  sched as (
    select a.user_id, count(*)::int as n,
           count(*) filter (where exists (select 1 from public.availability_slots m
               where m.user_id = v_uid and m.weekday = a.weekday and m.day_part = a.day_part))::int as overlap_n
    from public.availability_slots a where a.user_id in (select pool.id from pool) group by a.user_id),
  comp as (
    select p.*, t.sport_ids, t.sport_levels, c.common_ids,
      (c.n::real / (t.n + v_my_sports - c.n))::real as s_sport,
      c.level_close as s_level,
      (case when coalesce(sc.n,0) = 0 or v_my_slots = 0 then 0.5
            else sc.overlap_n::real / least(sc.n, v_my_slots) end)::real as s_sched,
      case when v_home is not null and p.home_location is not null
           then extensions.st_distance(v_home, p.home_location) / 1000.0 end as d_km
    from pool p join theirs t on t.user_id = p.id join common c on c.user_id = p.id
    left join sched sc on sc.user_id = p.id),
  comp2 as (
    select comp.*, (case when comp.d_km is not null then exp(-comp.d_km / 5.0)
                         when v_district is not null and comp.district_key = v_district then exp(-3.0 / 5.0)
                         else 0.3 end)::real as s_dist
    from comp)
  select c2.id, c2.display_name, c2.avatar_path, c2.bio, c2.district_key, c2.goal, c2.is_verified,
         c2.reliability_score, c2.sport_ids, c2.sport_levels, c2.common_ids,
         private.approx_distance_km(c2.d_km),                         -- precise distance never leaves the DB
         ((0.25 + 0.75*c2.s_sport) * (0.25 + 0.75*c2.s_level) * (0.4 + 0.6*c2.s_sched) * (0.2 + 0.8*c2.s_dist))::real,
         c2.s_sport, c2.s_level, c2.s_sched, c2.s_dist,
         private.common_slots(v_uid, c2.id)
  from comp2 c2
  order by 13 desc, c2.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

create function public.person_summary(p_user_id uuid)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
               goal public.user_goal, is_verified boolean, reliability_score int, attended_count int,
               sport_ids text[], sport_levels int[], common_sport_ids text[], distance_km_approx int,
               match_id uuid, conversation_id uuid, is_me boolean, common_slots text[])
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_d   float8;
begin
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id)
     or private.is_blocked_pair(v_uid, p_user_id) then
    raise exception 'not_found';
  end if;
  if p_user_id <> v_uid then
    select extensions.st_distance(a.home_location, b.home_location) / 1000.0 into v_d
      from public.profile_private a, public.profile_private b
     where a.user_id = v_uid and b.user_id = p_user_id
       and a.home_location is not null and b.home_location is not null;
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
         private.approx_distance_km(v_d),
         mt.id, cv.id,
         (p.id = v_uid),
         private.common_slots(v_uid, p.id)
    from public.profiles p
    left join public.matches mt on p.id <> v_uid and mt.status = 'active'
                               and mt.user_a = least(v_uid, p.id) and mt.user_b = greatest(v_uid, p.id)
    left join public.conversations cv on cv.match_id = mt.id
   where p.id = p_user_id;
end $$;

-- ---------------------------------------------------------------------------
-- privileges (as in 20261015000014_grants.sql)
-- ---------------------------------------------------------------------------
revoke all on function private.event_cards(uuid[], uuid, extensions.geography) from public, anon, authenticated;
revoke all on function private.common_slots(uuid, uuid) from public, anon, authenticated;
revoke all on function
  public.events_feed(float8, float8, float8, text[], text, text, uuid, boolean, int, timestamptz, uuid),
  public.my_events(text, int),
  public.event_detail(uuid),
  public.match_candidates(int, text),
  public.person_summary(uuid)
from public, anon, authenticated;

grant execute on function
  public.events_feed(float8, float8, float8, text[], text, text, uuid, boolean, int, timestamptz, uuid),
  public.event_detail(uuid)
to anon, authenticated;

grant execute on function
  public.my_events(text, int),
  public.match_candidates(int, text),
  public.person_summary(uuid)
to authenticated;
