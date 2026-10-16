-- Bojo — private helper functions + triggers (ARCHITECTURE §3.7, §3.8, §6)
-- All helpers: security definer, search_path pinned, called schema-qualified.

-- ---------------------------------------------------------------------------
-- §3.7 helpers
-- ---------------------------------------------------------------------------

create function private.is_blocked_pair(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;

create function private.is_conversation_member(p_conversation_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p_user_id is not null and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = p_user_id);
$$;

-- participant with status in ('going','invited')
create function private.is_event_member(p_event_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p_user_id is not null and exists (
    select 1 from public.event_participants ep
    where ep.event_id = p_event_id and ep.user_id = p_user_id and ep.status in ('going','invited'));
$$;

-- member AND (event conversation OR (match active AND pair not blocked))
create function private.can_post_message(p_conversation_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (
    select 1 from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id and m.user_id = p_user_id
    left join public.matches mt on mt.id = c.match_id
    where c.id = p_conversation_id
      and (c.kind = 'event'
           or (mt.status = 'active' and not private.is_blocked_pair(mt.user_a, mt.user_b))));
$$;

create function private.is_moderator(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p_user_id is not null and exists (select 1 from private.moderators m where m.user_id = p_user_id);
$$;

-- district whose boundary covers the point; else nearest centre within 8 km; else null
create function private.district_key_for(p_point extensions.geography) returns text
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select case when p_point is null then null else coalesce(
    (select d.key from public.districts d
      where d.boundary is not null and extensions.st_covers(d.boundary, p_point)
      order by d.sort_order limit 1),
    (select d.key from public.districts d
      where extensions.st_dwithin(d.center, p_point, 8000)
      order by extensions.st_distance(d.center, p_point) limit 1)) end;
$$;

-- ~550 m grid (0.005° lat × 0.008° lng). The ONLY way a user location is ever stored (§8).
create function private.snap_home_point(p_lat float8, p_lng float8) returns extensions.geography
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select extensions.st_setsrid(extensions.st_makepoint(
           (round((p_lng / 0.008)::numeric) * 0.008)::float8,
           (round((p_lat / 0.005)::numeric) * 0.005)::float8), 4326)::extensions.geography;
$$;

-- null→null; <1.5→1; <10→round; <30→round to 5; else 30 (same as shared/distance.ts)
create function private.approx_distance_km(p_km float8) returns int
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select case
    when p_km is null then null
    when p_km < 1.5 then 1
    when p_km < 10 then round(p_km::numeric)::int
    when p_km < 30 then (round((p_km / 5)::numeric) * 5)::int
    else 30 end;
$$;

-- Warsaw hour <12 → morning, <17 → afternoon, else evening
create function private.day_part_of(p_ts timestamptz) returns public.day_part
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select case
    when extract(hour from p_ts at time zone 'Europe/Warsaw') < 12 then 'morning'::public.day_part
    when extract(hour from p_ts at time zone 'Europe/Warsaw') < 17 then 'afternoon'::public.day_part
    else 'evening'::public.day_part end;
$$;

create function private.in_service_area(p_lat float8, p_lng float8) returns boolean
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select p_lat is not null and p_lng is not null
     and p_lat between 51.95 and 52.50 and p_lng between 20.70 and 21.45;
$$;

-- Throws 'rate_limited' when p_count >= p_max (helper for RPCs).
create function private.assert_rate(p_count bigint, p_max int) returns void
language plpgsql immutable set search_path = public, extensions, pg_temp as $$
begin
  if p_count >= p_max then raise exception 'rate_limited'; end if;
end $$;

-- Returns the caller's uid or raises 'not_authenticated'.
create function private.require_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  return v;
end $$;

-- Raises 'profile_incomplete' unless the user finished onboarding.
create function private.require_onboarded(p_uid uuid) returns void
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_uid and p.onboarded_at is not null) then
    raise exception 'profile_incomplete';
  end if;
end $$;

-- Inserts a system message (sender null) into an event conversation, if it exists.
create function private.post_system_message(p_conversation_id uuid, p_payload jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_conversation_id is null then return; end if;
  insert into public.messages (conversation_id, sender_id, kind, body, payload)
  values (p_conversation_id, null, 'system', '', p_payload);
end $$;

-- ---------------------------------------------------------------------------
-- §3.8 trigger functions
-- ---------------------------------------------------------------------------

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.tg_set_updated_at() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_set_updated_at        before update on public.profiles        for each row execute function private.tg_set_updated_at();
create trigger profile_private_set_updated_at before update on public.profile_private for each row execute function private.tg_set_updated_at();
create trigger venues_set_updated_at          before update on public.venues          for each row execute function private.tg_set_updated_at();
create trigger events_set_updated_at          before update on public.events          for each row execute function private.tg_set_updated_at();
create trigger ratings_set_updated_at         before update on public.ratings         for each row execute function private.tg_set_updated_at();
create trigger runner_profiles_set_updated_at before update on public.runner_profiles for each row execute function private.tg_set_updated_at();

-- avatar_path must live in the owner's folder: "<id>/<file>.<jpg|jpeg|png|webp>"
create function private.tg_profiles_avatar_path() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.avatar_path is not null
     and new.avatar_path !~ ('^' || new.id::text || '/[0-9A-Za-z_-]{1,80}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_input';
  end if;
  return new;
end $$;
create trigger profiles_avatar_path before update of avatar_path on public.profiles
  for each row execute function private.tg_profiles_avatar_path();

create function private.tg_venues_district() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  new.district_key := private.district_key_for(new.location);
  return new;
end $$;
create trigger venues_district before insert or update of location on public.venues
  for each row execute function private.tg_venues_district();

-- 1) event conversation; 2) organizer becomes a 'going' participant
create function private.tg_events_after_insert() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  insert into public.conversations (kind, event_id) values ('event', new.id) on conflict (event_id) do nothing;
  insert into public.event_participants (event_id, user_id, status)
  values (new.id, new.organizer_id, 'going')
  on conflict on constraint event_participants_pkey do nothing;
  return null;
end $$;
create trigger events_after_insert after insert on public.events
  for each row execute function private.tg_events_after_insert();

-- recount events.spots_taken; keep chat membership in sync with 'going'
create function private.tg_event_participants_sync() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_user  uuid := coalesce(new.user_id, old.user_id);
  v_conv  uuid;
begin
  update public.events e
     set spots_taken = (select count(*) from public.event_participants p
                         where p.event_id = v_event and p.status = 'going')
   where e.id = v_event;                         -- events_spots_chk makes over-booking impossible
  select c.id into v_conv from public.conversations c where c.event_id = v_event;
  if v_conv is not null then
    if tg_op <> 'DELETE' and new.status = 'going' then
      insert into public.conversation_members (conversation_id, user_id)
      values (v_conv, v_user) on conflict do nothing;
    else
      delete from public.conversation_members where conversation_id = v_conv and user_id = v_user;
    end if;
  end if;
  return null;
end $$;
create trigger event_participants_sync after insert or update of status or delete on public.event_participants
  for each row execute function private.tg_event_participants_sync();

-- becomes 'going' (user ≠ organizer) → notify organizer + system message in the event chat
create function private.tg_event_participants_notify() returns trigger
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
  perform private.post_system_message(v_conv, jsonb_build_object('type', 'joined', 'user_id', new.user_id));
  return null;
end $$;
create trigger event_participants_notify after insert or update of status on public.event_participants
  for each row execute function private.tg_event_participants_notify();

create function private.tg_ratings_reliability() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_user uuid := coalesce(new.ratee_id, old.ratee_id);
begin
  update public.profiles p
     set attended_count    = s.attended,
         no_show_count     = s.no_show,
         reliability_score = case when s.attended + s.no_show >= 3
                                  then round(100.0 * (s.attended + 2) / (s.attended + s.no_show + 2))::smallint
                             end
    from (select count(*) filter (where r.attended)::int     as attended,
                 count(*) filter (where not r.attended)::int as no_show
            from public.ratings r where r.ratee_id = v_user) s
   where p.id = v_user;
  return null;
end $$;
create trigger ratings_reliability after insert or update or delete on public.ratings
  for each row execute function private.tg_ratings_reliability();

-- ≥20 messages by the same sender in the last 60 s → rate_limited
create function private.tg_messages_rate_limit() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.sender_id is not null and (
       select count(*) from public.messages m
        where m.sender_id = new.sender_id and m.created_at > now() - interval '60 seconds') >= 20 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function private.tg_messages_rate_limit();

-- last_message_at + 'message' notifications (text only) to other non-muted, non-blocked members.
create function private.tg_messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_conv public.conversations%rowtype;
  v_name text;
begin
  update public.conversations c set last_message_at = greatest(coalesce(c.last_message_at, new.created_at), new.created_at)
   where c.id = new.conversation_id
   returning * into v_conv;

  if new.kind = 'text' and new.sender_id is not null and v_conv.id is not null then
    select p.display_name into v_name from public.profiles p where p.id = new.sender_id;
    insert into public.notifications (user_id, type, payload, dedupe_key)
    select m.user_id, 'message',
           jsonb_build_object('conversation_id', v_conv.id, 'conversation_kind', v_conv.kind,
                              'event_id', v_conv.event_id, 'sender_id', new.sender_id,
                              'sender_name', coalesce(v_name, ''), 'url', '/chat/' || v_conv.id),
           'msg:' || v_conv.id || ':' || floor(extract(epoch from new.created_at) / 300)::bigint
      from public.conversation_members m
     where m.conversation_id = v_conv.id
       and m.user_id <> new.sender_id
       and not m.muted
       and not private.is_blocked_pair(m.user_id, new.sender_id)
    on conflict on constraint notifications_dedupe_uniq do nothing;
  end if;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.tg_messages_after_insert();

-- ≥3 distinct reporters: venue_photo → hidden; user-created venue → hidden (OSM venues never auto-hidden)
create function private.tg_reports_autohide() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_n int;
begin
  if new.target_type not in ('venue_photo', 'venue') then return null; end if;
  select count(distinct r.reporter_id) into v_n from public.reports r
   where r.target_type = new.target_type and r.target_id = new.target_id;
  if v_n < 3 then return null; end if;
  if new.target_type = 'venue_photo' then
    update public.venue_photos ph set status = 'hidden' where ph.id = new.target_id and ph.status = 'active';
  else
    update public.venues v set status = 'hidden' where v.id = new.target_id and v.source = 'user' and v.status = 'active';
  end if;
  return null;
end $$;
create trigger reports_autohide after insert on public.reports
  for each row execute function private.tg_reports_autohide();

-- ---------------------------------------------------------------------------
-- §6 push outbox → pg_net → Edge Function push-dispatch (no-op without vault secrets)
-- ---------------------------------------------------------------------------

create function private.functions_config(out o_url text, out o_secret text)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  select ds.decrypted_secret into o_url    from vault.decrypted_secrets ds where ds.name = 'bojo_functions_url' limit 1;
  select ds.decrypted_secret into o_secret from vault.decrypted_secrets ds where ds.name = 'bojo_dispatch_secret' limit 1;
end $$;

create function private.tg_notifications_dispatch() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_url text; v_secret text; v_ids jsonb;
begin
  select c.o_url, c.o_secret into v_url, v_secret from private.functions_config() c;
  if v_url is null or v_secret is null then return null; end if;          -- graceful: in-app inbox still works
  select jsonb_agg(n.id) into v_ids from new_rows n;
  if v_ids is null then return null; end if;
  perform net.http_post(
    url     := v_url || '/push-dispatch',
    body    := jsonb_build_object('notification_ids', v_ids),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-dispatch-secret', v_secret));
  return null;
exception when others then
  -- never break the inserting transaction because of push plumbing
  raise warning 'notifications_dispatch failed: %', sqlerrm;
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  referencing new table as new_rows for each statement execute function private.tg_notifications_dispatch();
