-- Bojo — venue RPCs (ARCHITECTURE §5.1). Rules §5.0: security definer, pinned search_path,
-- #variable_conflict use_column, coalesce() defaults, closed error codes, blocks → not_found.

-- Ordered sport ids of a venue.
create function private.venue_sport_ids(p_venue_id uuid) returns text[]
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(array_agg(vs.sport_id order by s.sort_order), '{}')
    from public.venue_sports vs join public.sports s on s.id = vs.sport_id
   where vs.venue_id = p_venue_id;
$$;

-- Public scheduled events at a venue that end in the future and start within 7 days.
create function private.venue_upcoming_count(p_venue_id uuid) returns int
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select count(*)::int from public.events e
   where e.venue_id = p_venue_id and e.status = 'scheduled' and e.visibility = 'public'
     and e.ends_at > now() and e.starts_at < now() + interval '7 days';
$$;

-- Validates a sport id array: non-empty, ≤ 9, every id is an active sport. Returns the de-duplicated array.
create function private.valid_sport_ids(p_ids text[]) returns text[]
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare v text[];
begin
  select coalesce(array_agg(distinct x), '{}') into v from unnest(coalesce(p_ids, '{}')) x;
  if cardinality(v) = 0 or cardinality(v) > 9 then raise exception 'invalid_input'; end if;
  if exists (select 1 from unnest(v) x where not exists (select 1 from public.sports s where s.id = x and s.is_active)) then
    raise exception 'invalid_input';
  end if;
  return v;
end $$;

-- Surface class (= packages/shared VENUE_SURFACES; the OSM importer writes the same keys).
create function private.valid_surface(p text) returns text
language plpgsql immutable set search_path = public, extensions, pg_temp as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if p not in ('grass','artificial_turf','asphalt','concrete','clay','hard','tartan','sand','wood','other') then
    raise exception 'invalid_input';
  end if;
  return p;
end $$;

-- ---------------------------------------------------------------------------

create function public.venues_in_bbox(
  p_min_lng float8, p_min_lat float8, p_max_lng float8, p_max_lat float8,
  p_sport_ids text[] default null, p_limit int default 400)
returns table (id uuid, name text, kind public.venue_kind, lat float8, lng float8, sport_ids text[],
               is_lit boolean, is_free boolean, surface text, upcoming_events_count int)
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
         private.venue_upcoming_count(v.id)
    from public.venues v
   where v.status = 'active'
     and v.location operator(extensions.&&) v_env
     and (v_sports is null or exists (select 1 from public.venue_sports vs
                                       where vs.venue_id = v.id and vs.sport_id = any (v_sports)))
   order by v.location operator(extensions.<->) v_center, v.id
   limit v_limit;
end $$;

create function public.venue_detail(p_venue_id uuid)
returns table (id uuid, name text, kind public.venue_kind, lat float8, lng float8, district_key text, address text,
               surface text, is_lit boolean, is_free boolean, is_indoor boolean, access text, opening_hours text,
               website text, phone text, source public.venue_source, osm_type text, osm_id bigint,
               status public.moderation_status, is_mock boolean, sport_ids text[], photo_count int,
               upcoming_events_count int, has_pending_edit_by_me boolean, is_mine boolean,
               created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.venues v where v.id = p_venue_id
                   and (v.status = 'active' or (v_uid is not null and v.created_by = v_uid))) then
    raise exception 'not_found';
  end if;
  return query
  select v.id, v.name, v.kind,
         extensions.st_y(v.location::extensions.geometry), extensions.st_x(v.location::extensions.geometry),
         v.district_key, v.address, v.surface, v.is_lit, v.is_free, v.is_indoor, v.access, v.opening_hours,
         v.website, v.phone, v.source, v.osm_type, v.osm_id, v.status, v.is_mock,
         private.venue_sport_ids(v.id),
         (select count(*)::int from public.venue_photos ph where ph.venue_id = v.id and ph.status = 'active'),
         private.venue_upcoming_count(v.id),
         (v_uid is not null and exists (select 1 from public.venue_edits ve
                                         where ve.venue_id = v.id and ve.created_by = v_uid and ve.status = 'pending')),
         (v_uid is not null and v.created_by is not distinct from v_uid),
         v.created_at, v.updated_at
    from public.venues v
   where v.id = p_venue_id;
end $$;

create function public.venue_photos_list(p_venue_id uuid)
returns table (id uuid, storage_path text, external_url text, attribution text, is_mine boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.venues v where v.id = p_venue_id
                   and (v.status = 'active' or (v_uid is not null and v.created_by = v_uid))) then
    raise exception 'not_found';
  end if;
  return query
  select ph.id, ph.storage_path, ph.external_url, ph.attribution,
         (v_uid is not null and ph.uploaded_by is not distinct from v_uid), ph.created_at
    from public.venue_photos ph
   where ph.venue_id = p_venue_id
     and (ph.status = 'active' or (v_uid is not null and ph.uploaded_by = v_uid))
   order by ph.created_at desc, ph.id desc
   limit 50;
end $$;

create function public.add_venue(
  p_name text, p_kind public.venue_kind, p_lat float8, p_lng float8, p_sport_ids text[],
  p_surface text default null, p_is_lit boolean default null, p_is_free boolean default null,
  p_is_indoor boolean default null, p_opening_hours text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_name   text := btrim(coalesce(p_name, ''));
  v_sports text[];
  v_point  extensions.geography;
  v_dup    uuid;
  v_id     uuid;
  v_oh     text := nullif(btrim(coalesce(p_opening_hours, '')), '');
  v_surf   text := private.valid_surface(p_surface);
begin
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'invalid_input'; end if;
  if p_kind is null or p_kind = 'running_route' then raise exception 'invalid_input'; end if;
  if v_oh is not null and char_length(v_oh) > 255 then raise exception 'invalid_input'; end if;
  v_sports := private.valid_sport_ids(p_sport_ids);
  if p_lat is null or p_lng is null then raise exception 'invalid_input'; end if;
  if not private.in_service_area(p_lat, p_lng) then raise exception 'outside_service_area'; end if;

  perform private.assert_rate((select count(*) from public.venues v
                                where v.created_by = v_uid and v.created_at > now() - interval '24 hours'), 5);

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  select v.id into v_dup from public.venues v
   where v.status = 'active' and extensions.st_dwithin(v.location, v_point, 25)
     and exists (select 1 from public.venue_sports vs where vs.venue_id = v.id and vs.sport_id = any (v_sports))
   order by extensions.st_distance(v.location, v_point) limit 1;
  if v_dup is not null then
    raise exception 'duplicate_venue' using detail = v_dup::text;
  end if;

  insert into public.venues (name, kind, location, surface, is_lit, is_free, is_indoor, opening_hours, source, created_by)
  values (v_name, p_kind, v_point, v_surf, p_is_lit, p_is_free, p_is_indoor, v_oh, 'user', v_uid)
  returning id into v_id;

  insert into public.venue_sports (venue_id, sport_id) select v_id, x from unnest(v_sports) x;

  insert into public.venue_edits (venue_id, kind, proposed, status, created_by, reviewed_at)
  values (v_id, 'create',
          jsonb_strip_nulls(jsonb_build_object('name', v_name, 'kind', p_kind, 'lat', p_lat, 'lng', p_lng,
            'sport_ids', to_jsonb(v_sports), 'surface', v_surf, 'is_lit', p_is_lit, 'is_free', p_is_free,
            'is_indoor', p_is_indoor, 'opening_hours', v_oh)),
          'approved', v_uid, now());
  return v_id;
end $$;

-- Validates a VenueEditProposal (whitelisted keys + types). Returns the cleaned object.
create function private.clean_venue_proposal(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  v_out jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  v_ids text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid_input'; end if;
  for k, v in select * from jsonb_each(p) loop
    case k
      when 'name' then
        if jsonb_typeof(v) <> 'string' or char_length(btrim(v #>> '{}')) not between 1 and 120 then raise exception 'invalid_input'; end if;
        v_out := v_out || jsonb_build_object('name', btrim(v #>> '{}'));
      when 'surface' then
        if jsonb_typeof(v) <> 'string' then raise exception 'invalid_input'; end if;
        v_out := v_out || jsonb_build_object('surface', private.valid_surface(v #>> '{}'));
      when 'opening_hours' then
        if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 255 then raise exception 'invalid_input'; end if;
        v_out := v_out || jsonb_build_object('opening_hours', nullif(btrim(v #>> '{}'), ''));
      when 'is_lit', 'is_free', 'is_indoor' then
        if jsonb_typeof(v) not in ('boolean', 'null') then raise exception 'invalid_input'; end if;
        v_out := v_out || jsonb_build_object(k, v);
      when 'sport_ids' then
        if jsonb_typeof(v) <> 'array' then raise exception 'invalid_input'; end if;
        select array_agg(x) into v_ids from jsonb_array_elements_text(v) x;
        v_out := v_out || jsonb_build_object('sport_ids', to_jsonb(private.valid_sport_ids(v_ids)));
      else
        raise exception 'invalid_input';
    end case;
  end loop;
  if v_out = '{}'::jsonb then raise exception 'invalid_input'; end if;
  return v_out;
end $$;

create function public.suggest_venue_edit(
  p_venue_id uuid, p_kind public.venue_edit_kind, p_proposed jsonb, p_comment text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid      uuid := private.require_uid();
  v_venue    public.venues%rowtype;
  v_proposed jsonb := '{}'::jsonb;
  v_previous jsonb;
  v_comment  text := nullif(btrim(coalesce(p_comment, '')), '');
  v_id       uuid;
begin
  if p_kind is null or p_kind not in ('update', 'close') then raise exception 'invalid_input'; end if;
  if v_comment is not null and char_length(v_comment) > 500 then raise exception 'invalid_input'; end if;
  select * into v_venue from public.venues v
   where v.id = p_venue_id and (v.status = 'active' or v.created_by = v_uid);
  if not found then raise exception 'not_found'; end if;

  perform private.assert_rate((select count(*) from public.venue_edits ve
                                where ve.created_by = v_uid and ve.created_at > now() - interval '24 hours'), 20);

  if p_kind = 'update' then
    v_proposed := private.clean_venue_proposal(p_proposed);
    select jsonb_object_agg(k.key, case k.key
             when 'name' then to_jsonb(v_venue.name)
             when 'surface' then to_jsonb(v_venue.surface)
             when 'opening_hours' then to_jsonb(v_venue.opening_hours)
             when 'is_lit' then to_jsonb(v_venue.is_lit)
             when 'is_free' then to_jsonb(v_venue.is_free)
             when 'is_indoor' then to_jsonb(v_venue.is_indoor)
             when 'sport_ids' then to_jsonb(private.venue_sport_ids(v_venue.id)) end)
      into v_previous
      from jsonb_object_keys(v_proposed) k(key);
  else
    v_previous := jsonb_build_object('status', v_venue.status);
  end if;

  insert into public.venue_edits (venue_id, kind, proposed, previous, comment, created_by)
  values (v_venue.id, p_kind, v_proposed, v_previous, v_comment, v_uid)
  returning id into v_id;
  return v_id;
end $$;

create function public.add_venue_photo(p_venue_id uuid, p_storage_path text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid uuid := private.require_uid();
  v_id  uuid;
begin
  if p_venue_id is null or p_storage_path is null
     or p_storage_path !~ ('^' || p_venue_id::text || '/' || v_uid::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.venues v where v.id = p_venue_id and v.status = 'active') then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'venue-photos' and o.name = p_storage_path) then
    raise exception 'invalid_input';
  end if;
  perform private.assert_rate((select count(*) from public.venue_photos ph
                                where ph.uploaded_by = v_uid and ph.created_at > now() - interval '24 hours'), 20);
  insert into public.venue_photos (venue_id, storage_path, uploaded_by)
  values (p_venue_id, p_storage_path, v_uid)
  returning id into v_id;
  return v_id;
end $$;

create function public.review_venue_edit(p_edit_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid  uuid := private.require_uid();
  v_edit public.venue_edits%rowtype;
  v_p    jsonb;
begin
  if not private.is_moderator(v_uid) then raise exception 'forbidden'; end if;
  if p_approve is null then raise exception 'invalid_input'; end if;
  select * into v_edit from public.venue_edits ve where ve.id = p_edit_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_edit.status <> 'pending' then raise exception 'invalid_input'; end if;

  if p_approve then
    v_p := v_edit.proposed;
    if v_edit.kind = 'update' then
      update public.venues v set
        name          = case when v_p ? 'name' then v_p ->> 'name' else v.name end,
        surface       = case when v_p ? 'surface' then v_p ->> 'surface' else v.surface end,
        opening_hours = case when v_p ? 'opening_hours' then v_p ->> 'opening_hours' else v.opening_hours end,
        is_lit        = case when v_p ? 'is_lit' then (v_p ->> 'is_lit')::boolean else v.is_lit end,
        is_free       = case when v_p ? 'is_free' then (v_p ->> 'is_free')::boolean else v.is_free end,
        is_indoor     = case when v_p ? 'is_indoor' then (v_p ->> 'is_indoor')::boolean else v.is_indoor end,
        locally_edited_at = now()
      where v.id = v_edit.venue_id;
      if v_p ? 'sport_ids' then
        delete from public.venue_sports vs where vs.venue_id = v_edit.venue_id;
        insert into public.venue_sports (venue_id, sport_id, inferred)
        select v_edit.venue_id, x, false from jsonb_array_elements_text(v_p -> 'sport_ids') x;
      end if;
    elsif v_edit.kind = 'close' then
      update public.venues v set status = 'hidden', locally_edited_at = now() where v.id = v_edit.venue_id;
    end if;
  end if;

  update public.venue_edits ve
     set status = case when p_approve then 'approved'::public.edit_status else 'rejected'::public.edit_status end,
         reviewed_by = v_uid, reviewed_at = now()
   where ve.id = p_edit_id;
end $$;
