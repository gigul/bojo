-- Bojo — chat + matching RPCs (ARCHITECTURE §5.3, §5.4)

-- ---------------------------------------------------------------------------
-- §5.3 chats
-- ---------------------------------------------------------------------------

create function public.get_or_create_event_conversation(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid  uuid := private.require_uid();
  v_conv uuid;
begin
  if not private.can_see_event(p_event_id, v_uid) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.event_participants ep
                  where ep.event_id = p_event_id and ep.user_id = v_uid and ep.status = 'going') then
    raise exception 'not_participant';
  end if;
  insert into public.conversations (kind, event_id) values ('event', p_event_id)
  on conflict (event_id) do nothing;
  select c.id into v_conv from public.conversations c where c.event_id = p_event_id;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_uid)
  on conflict do nothing;
  return v_conv;
end $$;

create function public.my_conversations()
returns table (conversation_id uuid, kind public.conversation_kind, event_id uuid, match_id uuid, title text,
               other_user_id uuid, avatar_path text, sport_id text, event_starts_at timestamptz,
               event_status public.event_status, last_message_body text, last_message_kind public.message_kind,
               last_message_at timestamptz, last_message_sender_id uuid, unread_count int, muted boolean)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := private.require_uid();
begin
  return query
  select c.id, c.kind, c.event_id, c.match_id,
         case when c.kind = 'event' then e.title else op.display_name end,
         case when c.kind = 'match' then ou.other_id end,
         case when c.kind = 'match' then op.avatar_path end,
         e.sport_id, e.starts_at, e.status,
         lm.body, lm.kind, lm.created_at, lm.sender_id,
         (select count(*)::int from public.messages ms
           where ms.conversation_id = c.id
             and ms.created_at > coalesce(m.last_read_at, m.joined_at)
             and ms.sender_id is distinct from v_uid
             and (ms.sender_id is null or not private.is_blocked_pair(v_uid, ms.sender_id))),
         m.muted
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    left join public.events e on e.id = c.event_id
    left join public.matches mt on mt.id = c.match_id
    left join lateral (select case when mt.user_a = v_uid then mt.user_b else mt.user_a end as other_id) ou on c.kind = 'match'
    left join public.profiles op on op.id = ou.other_id
    left join lateral (
      select ms.body, ms.kind, ms.created_at, ms.sender_id
        from public.messages ms
       where ms.conversation_id = c.id
         and (ms.sender_id is null or ms.sender_id = v_uid or not private.is_blocked_pair(v_uid, ms.sender_id))
       order by ms.created_at desc, ms.id desc
       limit 1) lm on true
   where m.user_id = v_uid
     and (c.kind = 'event' or (mt.status = 'active' and not private.is_blocked_pair(mt.user_a, mt.user_b)))
   order by coalesce(c.last_message_at, c.created_at) desc, c.id;
end $$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  update public.conversation_members m set last_read_at = now()
   where m.conversation_id = p_conversation_id and m.user_id = v_uid;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.set_conversation_muted(p_conversation_id uuid, p_muted boolean)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if p_muted is null then raise exception 'invalid_input'; end if;
  update public.conversation_members m set muted = p_muted
   where m.conversation_id = p_conversation_id and m.user_id = v_uid;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- §5.4 matching & people
-- ---------------------------------------------------------------------------

create function public.match_candidates(p_limit int default 20, p_sport_id text default null)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
  goal public.user_goal, is_verified boolean, reliability_score smallint,
  sport_ids text[], sport_levels smallint[], common_sport_ids text[], distance_km_approx int,
  score real, score_sport real, score_level real, score_schedule real, score_distance real)
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
         c2.s_sport, c2.s_level, c2.s_sched, c2.s_dist
  from comp2 c2
  order by 13 desc, c2.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

create function public.swipe(p_target_id uuid, p_liked boolean, p_sport_id text default null)
returns table (match_id uuid, conversation_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid   uuid := private.require_uid();
  v_a     uuid;
  v_b     uuid;
  v_match public.matches%rowtype;
  v_conv  uuid;
  v_new   boolean := false;
  v_name_me text;
  v_name_them text;
begin
  if p_target_id is null or p_liked is null then raise exception 'invalid_input'; end if;
  if p_target_id = v_uid then raise exception 'invalid_input'; end if;
  perform private.require_onboarded(v_uid);
  if p_sport_id is not null and not exists (select 1 from public.sports s where s.id = p_sport_id) then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = p_target_id and p.onboarded_at is not null and p.discoverable)
     or private.is_blocked_pair(v_uid, p_target_id) then
    raise exception 'not_found';
  end if;
  perform private.assert_rate((select count(*) from public.swipes s
                                where s.swiper_id = v_uid and s.created_at > now() - interval '24 hours'), 300);

  v_a := least(v_uid, p_target_id);
  v_b := greatest(v_uid, p_target_id);
  perform pg_advisory_xact_lock(hashtextextended(v_a::text || v_b::text, 0));

  insert into public.swipes as s (swiper_id, target_id, liked, sport_id)
  values (v_uid, p_target_id, p_liked, p_sport_id)
  on conflict on constraint swipes_pkey
  do update set liked = excluded.liked, sport_id = excluded.sport_id, created_at = now();

  if p_liked and exists (select 1 from public.swipes s
                          where s.swiper_id = p_target_id and s.target_id = v_uid and s.liked) then
    insert into public.matches as m (user_a, user_b) values (v_a, v_b)
    on conflict on constraint matches_pair_uniq do nothing
    returning * into v_match;
    if v_match.id is not null then
      v_new := true;
    else
      select * into v_match from public.matches m where m.user_a = v_a and m.user_b = v_b;
    end if;

    if v_match.status = 'active' then
      insert into public.conversations (kind, match_id) values ('match', v_match.id)
      on conflict (match_id) do nothing;
      select c.id into v_conv from public.conversations c where c.match_id = v_match.id;
      insert into public.conversation_members (conversation_id, user_id)
      values (v_conv, v_a), (v_conv, v_b) on conflict do nothing;

      if v_new then
        select p.display_name into v_name_me   from public.profiles p where p.id = v_uid;
        select p.display_name into v_name_them from public.profiles p where p.id = p_target_id;
        insert into public.notifications (user_id, type, payload, dedupe_key) values
          (v_uid, 'match', jsonb_build_object('match_id', v_match.id, 'conversation_id', v_conv,
             'other_user_id', p_target_id, 'other_name', coalesce(v_name_them, ''), 'url', '/chat/' || v_conv),
           'match:' || v_match.id),
          (p_target_id, 'match', jsonb_build_object('match_id', v_match.id, 'conversation_id', v_conv,
             'other_user_id', v_uid, 'other_name', coalesce(v_name_me, ''), 'url', '/chat/' || v_conv),
           'match:' || v_match.id)
        on conflict on constraint notifications_dedupe_uniq do nothing;
      end if;
      return query select v_match.id, v_conv;
      return;
    end if;
  end if;

  return query select null::uuid, null::uuid;
end $$;

create function public.unmatch(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid uuid := private.require_uid();
  v_m   public.matches%rowtype;
begin
  select * into v_m from public.matches m
   where m.id = p_match_id and (m.user_a = v_uid or m.user_b = v_uid) for update;
  if not found then raise exception 'not_found'; end if;
  if v_m.status = 'active' then
    update public.matches m set status = 'unmatched', unmatched_at = now() where m.id = p_match_id;
  end if;
  delete from public.conversation_members cm
   using public.conversations c
   where c.id = cm.conversation_id and c.match_id = p_match_id;
end $$;

create function public.propose_meeting(
  p_match_id uuid, p_sport_id text, p_venue_id uuid, p_starts_at timestamptz,
  p_duration_min int default null, p_note text default null)
returns table (event_id uuid, conversation_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid      uuid := private.require_uid();
  v_m        public.matches%rowtype;
  v_other    uuid;
  v_sport    public.sports%rowtype;
  v_duration int;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_event    uuid;
  v_conv     uuid;
  v_vname    text;
  v_myname   text;
begin
  perform private.require_onboarded(v_uid);
  select * into v_m from public.matches m
   where m.id = p_match_id and (m.user_a = v_uid or m.user_b = v_uid);
  if not found then raise exception 'not_found'; end if;
  if v_m.status <> 'active' or private.is_blocked_pair(v_m.user_a, v_m.user_b) then
    raise exception 'match_inactive';
  end if;
  v_other := case when v_m.user_a = v_uid then v_m.user_b else v_m.user_a end;

  select * into v_sport from public.sports s where s.id = p_sport_id and s.is_active;
  if not found then raise exception 'invalid_input'; end if;
  select v.name into v_vname from public.venues v where v.id = p_venue_id and v.status = 'active';
  if not found then raise exception 'not_found'; end if;
  if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
    raise exception 'invalid_input';
  end if;
  v_duration := coalesce(p_duration_min, v_sport.default_duration_min);
  if v_duration not between 15 and 480 or char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  perform private.assert_rate(
    (select count(*) from public.events e
      where e.organizer_id = v_uid and e.series_id is null and e.created_at > now() - interval '24 hours'), 10);

  select c.id into v_conv from public.conversations c where c.match_id = v_m.id;
  if v_conv is null then raise exception 'match_inactive'; end if;

  insert into public.events (sport_id, venue_id, organizer_id, starts_at, ends_at, spots_total, spots_reserved, visibility)
  values (v_sport.id, p_venue_id, v_uid, p_starts_at, p_starts_at + make_interval(mins => v_duration), 2, 0, 'private')
  returning id into v_event;

  insert into public.event_participants (event_id, user_id, status) values (v_event, v_other, 'invited')
  on conflict on constraint event_participants_pkey do nothing;

  insert into public.messages (conversation_id, sender_id, kind, body, payload)
  values (v_conv, v_uid, 'event_invite', coalesce(v_note, ''),
          jsonb_build_object('event_id', v_event, 'sport_id', v_sport.id, 'starts_at', p_starts_at,
                             'venue_name', v_vname));

  select p.display_name into v_myname from public.profiles p where p.id = v_uid;
  insert into public.notifications (user_id, type, payload, dedupe_key)
  values (v_other, 'event_invite',
          jsonb_build_object('event_id', v_event, 'sport_id', v_sport.id, 'starts_at', p_starts_at,
                             'venue_name', v_vname, 'from_user_id', v_uid, 'from_name', coalesce(v_myname, ''),
                             'conversation_id', v_conv, 'url', '/chat/' || v_conv),
          'invite:' || v_event)
  on conflict on constraint notifications_dedupe_uniq do nothing;

  return query select v_event, v_conv;
end $$;

-- Cross-user profile card. Location exposure: district_key + bucketed distance only (§8).
create function public.person_summary(p_user_id uuid)
returns table (user_id uuid, display_name text, avatar_path text, bio text, district_key text,
               goal public.user_goal, is_verified boolean, reliability_score int, attended_count int,
               sport_ids text[], sport_levels int[], common_sport_ids text[], distance_km_approx int,
               match_id uuid, conversation_id uuid, is_me boolean)
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
         (p.id = v_uid)
    from public.profiles p
    left join public.matches mt on p.id <> v_uid and mt.status = 'active'
                               and mt.user_a = least(v_uid, p.id) and mt.user_b = greatest(v_uid, p.id)
    left join public.conversations cv on cv.match_id = mt.id
   where p.id = p_user_id;
end $$;
