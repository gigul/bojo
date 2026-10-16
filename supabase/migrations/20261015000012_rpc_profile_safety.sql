-- Bojo — profile, safety, notification RPCs (ARCHITECTURE §5.5, §5.6)

-- ---------------------------------------------------------------------------
-- §5.5 profile
-- ---------------------------------------------------------------------------

create function public.complete_onboarding()
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if not exists (select 1 from public.profiles p where p.id = v_uid and char_length(btrim(p.display_name)) >= 2)
     or not exists (select 1 from public.user_sports us where us.user_id = v_uid) then
    raise exception 'profile_incomplete';
  end if;
  update public.profiles p set onboarded_at = coalesce(p.onboarded_at, now()) where p.id = v_uid;
end $$;

-- p_sports: [{"sport_id": text, "level": 1..5}], 1..9 entries, unique sport ids
create function public.set_user_sports(p_sports jsonb)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid uuid := private.require_uid();
  v_n   int;
begin
  if p_sports is null or jsonb_typeof(p_sports) <> 'array' then raise exception 'invalid_input'; end if;
  v_n := jsonb_array_length(p_sports);
  if v_n < 1 or v_n > 9 then raise exception 'invalid_input'; end if;
  if exists (select 1 from jsonb_array_elements(p_sports) x
              where jsonb_typeof(x) <> 'object'
                 or jsonb_typeof(x -> 'sport_id') <> 'string'
                 or jsonb_typeof(x -> 'level') <> 'number'
                 or (x ->> 'level') !~ '^[1-5]$'
                 or not exists (select 1 from public.sports s where s.id = x ->> 'sport_id' and s.is_active)) then
    raise exception 'invalid_input';
  end if;
  if (select count(distinct x ->> 'sport_id') from jsonb_array_elements(p_sports) x) <> v_n then
    raise exception 'invalid_input';
  end if;
  delete from public.user_sports us where us.user_id = v_uid;
  insert into public.user_sports (user_id, sport_id, level)
  select v_uid, x ->> 'sport_id', (x ->> 'level')::smallint from jsonb_array_elements(p_sports) x;
end $$;

-- p_slots: [{"weekday": 1..7, "day_part": "morning"|"afternoon"|"evening"}], ≤ 21 (replace all)
create function public.set_availability(p_slots jsonb)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 21 then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from jsonb_array_elements(p_slots) x
              where jsonb_typeof(x) <> 'object'
                 or jsonb_typeof(x -> 'weekday') <> 'number'
                 or (x ->> 'weekday') !~ '^[1-7]$'
                 or coalesce(x ->> 'day_part', '') not in ('morning', 'afternoon', 'evening')) then
    raise exception 'invalid_input';
  end if;
  delete from public.availability_slots a where a.user_id = v_uid;
  insert into public.availability_slots (user_id, weekday, day_part)
  select distinct v_uid, (x ->> 'weekday')::smallint, (x ->> 'day_part')::public.day_part
    from jsonb_array_elements(p_slots) x;
end $$;

-- Stores ONLY the ~550 m snapped point (§8); 5 changes per Warsaw day. Returns the detected district.
create function public.set_home_location(p_lat float8, p_lng float8)
returns table (district_key text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_uid     uuid := private.require_uid();
  v_today   date := (now() at time zone 'Europe/Warsaw')::date;
  v_pp      public.profile_private%rowtype;
  v_point   extensions.geography;
  v_district text;
begin
  if p_lat is null or p_lng is null or p_lat <> p_lat or p_lng <> p_lng then raise exception 'invalid_input'; end if;
  if not private.in_service_area(p_lat, p_lng) then raise exception 'outside_service_area'; end if;

  select * into v_pp from public.profile_private pp where pp.user_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if v_pp.home_location_changes_on = v_today and v_pp.home_location_changes_count >= 5 then
    raise exception 'rate_limited';
  end if;

  v_point := private.snap_home_point(p_lat, p_lng);
  v_district := private.district_key_for(v_point);

  update public.profile_private pp
     set home_location = v_point,
         home_location_updated_at = now(),
         home_location_changes_count = case when pp.home_location_changes_on = v_today
                                            then pp.home_location_changes_count + 1 else 1 end,
         home_location_changes_on = v_today
   where pp.user_id = v_uid;

  update public.profiles p set district_key = v_district
   where p.id = v_uid and p.district_key is null and v_district is not null;

  return query select v_district;
end $$;

create function public.clear_home_location()
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  update public.profile_private pp set home_location = null, home_location_updated_at = null
   where pp.user_id = v_uid;
end $$;

create function public.set_user_verified(p_user_id uuid, p_verified boolean)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if not private.is_moderator(v_uid) then raise exception 'forbidden'; end if;
  if p_verified is null then raise exception 'invalid_input'; end if;
  update public.profiles p set is_verified = p_verified where p.id = p_user_id;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.moderate_content(p_target_type public.report_target, p_target_id uuid,
                                        p_status public.moderation_status)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if not private.is_moderator(v_uid) then raise exception 'forbidden'; end if;
  if p_status is null then raise exception 'invalid_input'; end if;
  if p_target_type = 'venue' then
    update public.venues v set status = p_status where v.id = p_target_id;
  elsif p_target_type = 'venue_photo' then
    update public.venue_photos ph set status = p_status where ph.id = p_target_id;
  else
    raise exception 'invalid_input';
  end if;
  if not found then raise exception 'not_found'; end if;
  update public.reports r set status = 'reviewed'
   where r.target_type = p_target_type and r.target_id = p_target_id and r.status = 'open';
end $$;

-- ---------------------------------------------------------------------------
-- §5.6 safety
-- ---------------------------------------------------------------------------

create function public.block_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if p_user_id is null or p_user_id = v_uid then raise exception 'invalid_input'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then raise exception 'not_found'; end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;

  -- active match between the pair → unmatched, members removed
  update public.matches m set status = 'unmatched', unmatched_at = now()
   where m.user_a = least(v_uid, p_user_id) and m.user_b = greatest(v_uid, p_user_id) and m.status = 'active';
  delete from public.conversation_members cm
   using public.conversations c, public.matches m
   where c.id = cm.conversation_id and m.id = c.match_id
     and m.user_a = least(v_uid, p_user_id) and m.user_b = greatest(v_uid, p_user_id);

  -- pending invitations between them → left
  update public.event_participants ep set status = 'left', left_at = now()
    from public.events e
   where e.id = ep.event_id and ep.status = 'invited'
     and ((ep.user_id = p_user_id and e.organizer_id = v_uid) or (ep.user_id = v_uid and e.organizer_id = p_user_id));
end $$;

create function public.unblock_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  delete from public.blocks b where b.blocker_id = v_uid and b.blocked_id = p_user_id;
end $$;

create function public.blocked_users()
returns table (user_id uuid, display_name text, avatar_path text, blocked_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := private.require_uid();
begin
  return query
  select b.blocked_id, p.display_name, p.avatar_path, b.created_at
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = v_uid
   order by b.created_at desc;
end $$;

create function public.submit_report(p_target_type public.report_target, p_target_id uuid,
                                     p_reason public.report_reason, p_details text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid     uuid := private.require_uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id      uuid;
  v_exists  boolean;
begin
  if p_target_type is null or p_target_id is null or p_reason is null
     or char_length(coalesce(v_details, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  if p_target_type = 'user' and p_target_id = v_uid then raise exception 'invalid_input'; end if;
  v_exists := case p_target_type
    when 'user'        then exists (select 1 from public.profiles x where x.id = p_target_id)
    when 'event'       then exists (select 1 from public.events x where x.id = p_target_id)
    when 'venue'       then exists (select 1 from public.venues x where x.id = p_target_id)
    when 'venue_photo' then exists (select 1 from public.venue_photos x where x.id = p_target_id)
    when 'message'     then exists (select 1 from public.messages x where x.id = p_target_id
                                     and private.is_conversation_member(x.conversation_id, v_uid))
  end;
  if not v_exists then raise exception 'not_found'; end if;
  perform private.assert_rate((select count(*) from public.reports r
                                where r.reporter_id = v_uid and r.created_at > now() - interval '24 hours'), 20);

  insert into public.reports as r (reporter_id, target_type, target_id, reason, details)
  values (v_uid, p_target_type, p_target_id, p_reason, v_details)
  on conflict on constraint reports_once_uniq
  do update set reason = excluded.reason, details = excluded.details
  returning r.id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- §5.6 push tokens + inbox
-- ---------------------------------------------------------------------------

create function public.register_push_token(p_token text, p_platform public.push_platform)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  if p_token is null or p_platform is null or char_length(p_token) > 255
     or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid_input';
  end if;
  insert into public.push_tokens as t (token, user_id, platform, last_seen_at)
  values (p_token, v_uid, p_platform, now())
  on conflict on constraint push_tokens_pkey
  do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  delete from public.push_tokens t where t.token = p_token and t.user_id = v_uid;
end $$;

create function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := private.require_uid();
begin
  update public.notifications n set read_at = now()
   where n.user_id = v_uid and n.read_at is null and (p_ids is null or n.id = any (p_ids));
end $$;

-- SERVICE ROLE ONLY (grants). Claims pending notifications for push-dispatch.
create function public.claim_push_batch(p_ids uuid[] default null, p_limit int default 100)
returns table (notification_id uuid, user_id uuid, type public.notification_type, payload jsonb, locale text,
               tokens text[])
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if p_ids is null then
    -- give up on rows that keep failing in 'sending'
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
           (select array_agg(t.token order by t.last_seen_at desc) from public.push_tokens t
             where t.user_id = pk.user_id) as tokens
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
  -- (data-modifying CTEs always run to completion, so `skipped` is applied even though it is not read)
  select cl.id, cl.user_id, cl.type, cl.payload, cl.locale, cl.tokens from claimed cl;
end $$;

-- SERVICE ROLE ONLY (grants). p_results: [{"notification_id": uuid, "status": "sent"|"failed", "error": text?}]
create function public.complete_push_batch(p_results jsonb, p_invalid_tokens text[] default '{}')
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then raise exception 'invalid_input'; end if;
  update public.notifications n
     set push_status = case when r.status = 'sent' then 'sent'::public.push_status
                            when n.push_attempts < 3 then 'pending'::public.push_status
                            else 'failed'::public.push_status end,
         sent_at    = case when r.status = 'sent' then now() else n.sent_at end,
         push_error = case when r.status = 'sent' then null else left(coalesce(r.error, 'failed'), 500) end
    from (select (x ->> 'notification_id')::uuid as id, x ->> 'status' as status, x ->> 'error' as error
            from jsonb_array_elements(p_results) x
           where x ->> 'status' in ('sent', 'failed')
             and (x ->> 'notification_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') r
   where n.id = r.id and n.push_status = 'sending';
  delete from public.push_tokens t where t.token = any (coalesce(p_invalid_tokens, '{}'));
end $$;
