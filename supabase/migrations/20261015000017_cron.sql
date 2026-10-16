-- Bojo — private cron functions + pg_cron schedule (ARCHITECTURE §5.7, §6)

-- scheduled and ended → completed; attendance reminder to the organizer when ≥2 were going
create function private.complete_past_events() returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_n int;
begin
  with done as (
    update public.events e set status = 'completed'
     where e.status = 'scheduled' and e.ends_at < now()
    returning e.id, e.organizer_id, e.sport_id, e.starts_at)
  insert into public.notifications (user_id, type, payload, dedupe_key)
  select d.organizer_id, 'attendance_reminder',
         jsonb_build_object('event_id', d.id, 'sport_id', d.sport_id, 'starts_at', d.starts_at,
                            'url', '/event/' || d.id || '/attendance'),
         'attend:' || d.id
    from done d
   where (select count(*) from public.event_participants ep where ep.event_id = d.id and ep.status = 'going') >= 2
  on conflict on constraint notifications_dedupe_uniq do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- "Football nearby in 2 hours, 1 person missing" (§5.7)
create function private.enqueue_nearby_event_notifications() returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_n int;
begin
  insert into public.notifications (user_id, type, payload, dedupe_key)
  select pp.user_id, 'event_nearby',
         jsonb_build_object('event_id', e.id, 'sport_id', e.sport_id, 'venue_name', v.name, 'venue_kind', v.kind,
                            'starts_at', e.starts_at, 'spots_left', e.spots_total - e.spots_taken - e.spots_reserved,
                            'url', '/event/' || e.id),
         'nearby:' || e.id
  from public.events e
  join public.venues v           on v.id = e.venue_id
  join public.profile_private pp on pp.push_enabled and pp.home_location is not null
                                and extensions.st_dwithin(pp.home_location, v.location, pp.notify_radius_km * 1000)
  join public.profiles pr        on pr.id = pp.user_id and pr.onboarded_at is not null
  join public.user_sports us     on us.user_id = pp.user_id and us.sport_id = e.sport_id
                                and (e.level is null or abs(us.level - e.level) <= 1)
  where e.status = 'scheduled' and e.visibility = 'public'
    and e.starts_at >= now() + interval '105 minutes' and e.starts_at < now() + interval '135 minutes'
    and e.spots_taken + e.spots_reserved < e.spots_total
    and pp.user_id <> e.organizer_id
    and not exists (select 1 from public.event_participants ep where ep.event_id = e.id and ep.user_id = pp.user_id)
    and not private.is_blocked_pair(pp.user_id, e.organizer_id)
    and (select count(*) from public.notifications n where n.user_id = pp.user_id
           and n.type = 'event_nearby' and n.created_at > now() - interval '24 hours') < 3
    and (not exists (select 1 from public.availability_slots a where a.user_id = pp.user_id)
         or exists (select 1 from public.availability_slots a where a.user_id = pp.user_id
                      and a.weekday = extract(isodow from e.starts_at at time zone 'Europe/Warsaw')::int
                      and a.day_part = private.day_part_of(e.starts_at)))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Sweep/retry: if pending or stale rows exist and vault secrets exist → POST {} to push-dispatch.
create function private.dispatch_pending_push() returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.notifications n
                  where (n.push_status = 'pending' and n.created_at < now() - interval '20 seconds')
                     or (n.push_status = 'sending' and n.push_claimed_at < now() - interval '5 minutes')) then
    return;
  end if;
  select c.o_url, c.o_secret into v_url, v_secret from private.functions_config() c;
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url     := v_url || '/push-dispatch',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-dispatch-secret', v_secret));
end $$;

create function private.cleanup() returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  delete from public.notifications n where n.created_at < now() - interval '90 days';
  update public.profile_private pp set home_location_changes_count = 0, home_location_changes_on = null
   where pp.home_location_changes_on < (now() at time zone 'Europe/Warsaw')::date;
end $$;

revoke all on function private.complete_past_events(), private.enqueue_nearby_event_notifications(),
  private.dispatch_pending_push(), private.cleanup() from public, anon, authenticated;

-- pg_cron (UTC). cron.schedule upserts by job name, so re-running is safe.
select cron.schedule('bojo-complete-events',    '5 * * * *',    $$select private.complete_past_events()$$);
select cron.schedule('bojo-materialize-series', '0 2 * * *',    $$select private.materialize_all_series()$$);
select cron.schedule('bojo-nearby-events',      '*/15 * * * *', $$select private.enqueue_nearby_event_notifications()$$);
select cron.schedule('bojo-push-sweep',         '* * * * *',    $$select private.dispatch_pending_push()$$);
select cron.schedule('bojo-cleanup',            '30 3 * * *',   $$select private.cleanup()$$);
