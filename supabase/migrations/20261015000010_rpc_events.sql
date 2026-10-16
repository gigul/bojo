-- Bojo — event RPCs (ARCHITECTURE §5.2)

-- EventCardRow for a list of event ids, in the order of p_ids. Caller context via p_uid (null = anon:
-- organizer identity and my_status are NULL). p_ref = optional reference point for distance_km.
create function private.event_cards(p_ids uuid[], p_uid uuid, p_ref extensions.geography)
returns table (id uuid, series_id uuid, sport_id text, title text, starts_at timestamptz, ends_at timestamptz,
               spots_total int, spots_taken int, spots_reserved int, spots_left int, level int,
               status public.event_status, visibility public.event_visibility,
               venue_id uuid, venue_name text, venue_kind public.venue_kind, venue_lat float8, venue_lng float8,
               district_key text, distance_km float8,
               organizer_id uuid, organizer_name text, organizer_avatar_path text,
               organizer_reliability int, organizer_is_verified boolean,
               my_status public.participant_status, is_organizer boolean, ord int)
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
         array_position(p_ids, e.id)
    from public.events e
    join public.venues v on v.id = e.venue_id
    join public.profiles o on o.id = e.organizer_id
   where e.id = any (p_ids)
   order by array_position(p_ids, e.id);
$$;

-- Visibility as in RLS events_read; anon (p_uid null) sees public events only.
create function private.can_see_event(p_event_id uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and (case when p_uid is null then e.visibility = 'public'
                 else e.organizer_id = p_uid
                      or private.is_event_member(e.id, p_uid)
                      or (e.visibility = 'public' and not private.is_blocked_pair(p_uid, e.organizer_id)) end));
$$;

-- Cancels one scheduled event with side effects (notifications + system message). Caller checks rights.
create function private.cancel_event_internal(p_event_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_ev   public.events%rowtype;
  v_conv uuid;
  v_vname text;
begin
  update public.events e
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where e.id = p_event_id and e.status = 'scheduled'
  returning * into v_ev;
  if not found then return; end if;
  select v.name into v_vname from public.venues v where v.id = v_ev.venue_id;

  insert into public.notifications (user_id, type, payload, dedupe_key)
  select ep.user_id, 'event_cancelled',
         jsonb_build_object('event_id', v_ev.id, 'sport_id', v_ev.sport_id, 'starts_at', v_ev.starts_at,
                            'venue_name', v_vname, 'url', '/event/' || v_ev.id),
         'cancel:' || v_ev.id
    from public.event_participants ep
   where ep.event_id = v_ev.id and ep.status = 'going' and ep.user_id <> v_ev.organizer_id
  on conflict on constraint notifications_dedupe_uniq do nothing;

  select c.id into v_conv from public.conversations c where c.event_id = v_ev.id;
  perform private.post_system_message(v_conv, jsonb_build_object('type', 'cancelled'));
end $$;

-- Recurring materialisation (§5.2). Idempotent via unique(series_id, starts_at).
create function private.materialize_series(p_series_id uuid, p_horizon_days int default 14) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_n int;
begin
  insert into public.events (series_id, sport_id, venue_id, organizer_id, title, description,
                             starts_at, ends_at, spots_total, spots_reserved, level, visibility, is_mock)
  select s.id, s.sport_id, s.venue_id, s.organizer_id, s.title, s.description,
         x.starts_at, x.starts_at + make_interval(mins => s.duration_min),
         s.spots_total, s.spots_reserved, s.level, s.visibility, s.is_mock
  from public.event_series s
  cross join lateral (
    select ((d::date + s.start_time) at time zone s.timezone) as starts_at
    from generate_series(
           greatest(s.starts_on, (now() at time zone s.timezone)::date)::timestamp,
           least(coalesce(s.until_on, 'infinity'::date), (now() at time zone s.timezone)::date + coalesce(p_horizon_days, 14))::timestamp,
           interval '1 day') as d
    where extract(isodow from d)::int = any (s.weekdays)
  ) x
  where s.id = p_series_id and s.is_active and x.starts_at > now()
  on conflict (series_id, starts_at) do nothing;      -- events_after_insert creates chat + organizer row
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function private.materialize_all_series() returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r record; v_total int := 0;
begin
  for r in select s.id from public.event_series s where s.is_active loop
    v_total := v_total + private.materialize_series(r.id, 14);
  end loop;
  return v_total;
end $$;

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
               my_status public.participant_status, is_organizer boolean)
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
         c.organizer_avatar_path, c.organizer_reliability, c.organizer_is_verified, c.my_status, c.is_organizer
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
               my_status public.participant_status, is_organizer boolean)
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
         c.organizer_avatar_path, c.organizer_reliability, c.organizer_is_verified, c.my_status, c.is_organizer
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
               my_status public.participant_status, is_organizer boolean,
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

create function public.event_participants_list(p_event_id uuid)
returns table (user_id uuid, display_name text, avatar_path text, is_verified boolean, reliability_score int,
               status public.participant_status, is_organizer boolean, level int, joined_at timestamptz,
               attended boolean)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_ev  public.events%rowtype;
  v_is_org boolean;
begin
  if not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  select * into v_ev from public.events e where e.id = p_event_id;
  v_is_org := v_ev.organizer_id = v_uid;
  return query
  select ep.user_id, p.display_name, p.avatar_path, p.is_verified, p.reliability_score::int, ep.status,
         (ep.user_id = v_ev.organizer_id),
         (select us.level::int from public.user_sports us where us.user_id = ep.user_id and us.sport_id = v_ev.sport_id),
         ep.joined_at,
         case when v_is_org then (select r.attended from public.ratings r
                                   where r.event_id = ep.event_id and r.ratee_id = ep.user_id) end
    from public.event_participants ep
    join public.profiles p on p.id = ep.user_id
   where ep.event_id = p_event_id
     and (ep.status = 'going' or (v_is_org and ep.status = 'invited'))
     and (ep.user_id = v_uid or not private.is_blocked_pair(v_uid, ep.user_id))
   order by (ep.user_id = v_ev.organizer_id) desc, ep.joined_at, ep.user_id;
end $$;

create function public.create_event(
  p_sport_id text, p_venue_id uuid, p_starts_at timestamptz, p_duration_min int default null,
  p_spots_total int default null, p_spots_reserved int default 0, p_level int default null,
  p_title text default null, p_description text default null,
  p_repeat_weekdays int[] default null, p_repeat_until date default null)
returns table (event_id uuid, series_id uuid, conversation_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid      uuid := private.require_uid();
  v_sport    public.sports%rowtype;
  v_duration int;
  v_total    int;
  v_reserved int := coalesce(p_spots_reserved, 0);
  v_title    text := nullif(btrim(coalesce(p_title, '')), '');
  v_desc     text := nullif(btrim(coalesce(p_description, '')), '');
  v_event    uuid;
  v_series   uuid;
  v_local    timestamp;
  v_until    date;
  v_days     smallint[];
begin
  perform private.require_onboarded(v_uid);
  select * into v_sport from public.sports s where s.id = p_sport_id and s.is_active;
  if not found then raise exception 'invalid_input'; end if;
  if not exists (select 1 from public.venues v where v.id = p_venue_id and v.status = 'active') then
    raise exception 'not_found';
  end if;
  if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
    raise exception 'invalid_input';
  end if;
  v_duration := coalesce(p_duration_min, v_sport.default_duration_min);
  v_total    := coalesce(p_spots_total, v_sport.default_spots);
  if v_duration not between 15 and 480 or v_total not between 2 and 50
     or v_reserved < 0 or v_reserved > v_total - 2
     or (p_level is not null and p_level not between 1 and 5)
     or char_length(coalesce(v_title, '')) > 80 or char_length(coalesce(v_desc, '')) > 1000 then
    raise exception 'invalid_input';
  end if;

  perform private.assert_rate(
    (select count(*) from public.events e
      where e.organizer_id = v_uid and e.series_id is null and e.created_at > now() - interval '24 hours')
    + (select count(*) from public.event_series s
        where s.organizer_id = v_uid and s.created_at > now() - interval '24 hours'), 10);

  if p_repeat_weekdays is null then
    insert into public.events (sport_id, venue_id, organizer_id, title, description, starts_at, ends_at,
                               spots_total, spots_reserved, level)
    values (v_sport.id, p_venue_id, v_uid, v_title, v_desc, p_starts_at,
            p_starts_at + make_interval(mins => v_duration), v_total, v_reserved, p_level)
    returning id into v_event;
  else
    select array_agg(distinct w::smallint order by w::smallint) into v_days from unnest(p_repeat_weekdays) w;
    if v_days is null or cardinality(v_days) not between 1 and 7
       or exists (select 1 from unnest(v_days) w where w is null or w not between 1 and 7) then
      raise exception 'invalid_input';
    end if;
    v_local := p_starts_at at time zone 'Europe/Warsaw';
    v_until := coalesce(p_repeat_until, v_local::date + 56);
    if v_until < v_local::date or v_until > v_local::date + 182 then raise exception 'invalid_input'; end if;

    insert into public.event_series (organizer_id, sport_id, venue_id, title, description, spots_total, spots_reserved,
                                     level, weekdays, start_time, duration_min, starts_on, until_on)
    values (v_uid, v_sport.id, p_venue_id, v_title, v_desc, v_total, v_reserved, p_level, v_days,
            v_local::time, v_duration, v_local::date, v_until)
    returning id into v_series;

    perform private.materialize_series(v_series, 14);
    select e.id into v_event from public.events e
     where e.series_id = v_series and e.starts_at >= p_starts_at
     order by e.starts_at limit 1;
    if v_event is null then raise exception 'invalid_input'; end if;
  end if;

  return query
  select v_event, v_series, c.id from public.conversations c where c.event_id = v_event;
end $$;

create function public.join_event(p_event_id uuid)
returns table (spots_taken int, spots_total int, spots_reserved int, conversation_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_ev     public.events%rowtype;
  v_status public.participant_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_ev from public.events e where e.id = p_event_id for update;   -- serialises joins per event
  if not found or private.is_blocked_pair(v_uid, v_ev.organizer_id) then raise exception 'not_found'; end if;

  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = v_uid;

  if v_ev.visibility = 'private' and v_status is null then raise exception 'not_found'; end if;
  if v_status = 'removed' then raise exception 'forbidden'; end if;
  if v_ev.status <> 'scheduled' or v_ev.starts_at <= now() then raise exception 'event_not_joinable'; end if;

  if v_status is distinct from 'going' then
    if v_ev.spots_taken + v_ev.spots_reserved >= v_ev.spots_total then raise exception 'event_full'; end if;
    insert into public.event_participants as ep (event_id, user_id, status, joined_at)
    values (p_event_id, v_uid, 'going', now())
    on conflict on constraint event_participants_pkey
    do update set status = 'going', joined_at = now(), left_at = null;
    -- triggers: spots_taken recount (same tx, row already locked), chat membership, organizer notification
  end if;

  return query
    select e.spots_taken::int, e.spots_total::int, e.spots_reserved::int, c.id
      from public.events e left join public.conversations c on c.event_id = e.id
     where e.id = p_event_id;
end $$;

create function public.leave_event(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_ev     public.events%rowtype;
  v_status public.participant_status;
begin
  select * into v_ev from public.events e where e.id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_ev.organizer_id = v_uid then raise exception 'organizer_cannot_leave'; end if;
  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = v_uid;
  if v_status is distinct from 'going' then raise exception 'not_participant'; end if;
  if v_ev.starts_at <= now() then raise exception 'event_not_joinable'; end if;
  update public.event_participants ep set status = 'left', left_at = now()
   where ep.event_id = p_event_id and ep.user_id = v_uid;
end $$;

create function public.decline_invite(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_status public.participant_status;
begin
  perform 1 from public.events e where e.id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;
  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = v_uid;
  if v_status is distinct from 'invited' then raise exception 'not_participant'; end if;
  update public.event_participants ep set status = 'left', left_at = now()
   where ep.event_id = p_event_id and ep.user_id = v_uid;
end $$;

create function public.cancel_event(p_event_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_ev     public.events%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if char_length(coalesce(v_reason, '')) > 300 then raise exception 'invalid_input'; end if;
  select * into v_ev from public.events e where e.id = p_event_id for update;
  if not found or not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  if v_ev.organizer_id <> v_uid then raise exception 'forbidden'; end if;
  if v_ev.status <> 'scheduled' or v_ev.ends_at <= now() then raise exception 'event_not_joinable'; end if;
  perform private.cancel_event_internal(p_event_id, v_reason);
end $$;

create function public.remove_participant(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_ev     public.events%rowtype;
  v_status public.participant_status;
begin
  select * into v_ev from public.events e where e.id = p_event_id for update;
  if not found or not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  if v_ev.organizer_id <> v_uid then raise exception 'forbidden'; end if;
  if p_user_id is null or p_user_id = v_uid then raise exception 'invalid_input'; end if;
  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = p_user_id;
  if v_status is null or v_status not in ('going', 'invited') then raise exception 'not_participant'; end if;
  update public.event_participants ep set status = 'removed', left_at = now()
   where ep.event_id = p_event_id and ep.user_id = p_user_id;
end $$;

create function public.cancel_series(p_series_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid uuid := private.require_uid();
  v_s   public.event_series%rowtype;
  r     record;
begin
  select * into v_s from public.event_series s where s.id = p_series_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_s.organizer_id <> v_uid then raise exception 'forbidden'; end if;
  update public.event_series s set is_active = false where s.id = p_series_id;
  for r in select e.id from public.events e
            where e.series_id = p_series_id and e.status = 'scheduled' and e.starts_at > now()
            order by e.starts_at for update loop
    perform private.cancel_event_internal(r.id, null);
  end loop;
end $$;

create function public.submit_attendance(p_event_id uuid, p_marks jsonb)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid uuid := private.require_uid();
  v_ev  public.events%rowtype;
  m     jsonb;
  v_user uuid;
begin
  select * into v_ev from public.events e where e.id = p_event_id for update;
  if not found or not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  if v_ev.organizer_id <> v_uid then raise exception 'forbidden'; end if;
  if v_ev.status = 'cancelled' or now() < v_ev.starts_at or now() > v_ev.ends_at + interval '72 hours' then
    raise exception 'attendance_window_closed';
  end if;
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) > 50 then
    raise exception 'invalid_input';
  end if;
  for m in select * from jsonb_array_elements(p_marks) loop
    if jsonb_typeof(m) <> 'object' or jsonb_typeof(m -> 'attended') <> 'boolean'
       or jsonb_typeof(m -> 'user_id') <> 'string'
       or (m ->> 'user_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid_input';
    end if;
    v_user := (m ->> 'user_id')::uuid;
    if v_user = v_uid or not exists (select 1 from public.event_participants ep
                                      where ep.event_id = p_event_id and ep.user_id = v_user and ep.status = 'going') then
      raise exception 'not_participant';
    end if;
    insert into public.ratings (event_id, ratee_id, rater_id, attended)
    values (p_event_id, v_user, v_uid, (m ->> 'attended')::boolean)
    on conflict on constraint ratings_pkey do update set attended = excluded.attended, rater_id = excluded.rater_id;
  end loop;
end $$;
