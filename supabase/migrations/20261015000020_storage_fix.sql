-- Bojo — storage policy fix + venue_detail.flags (lead follow-up)
--
-- 1) BUG (blocker): in venue_photos_obj_insert (migration 15) the unqualified `name` inside
--    EXISTS (select 1 from public.venues v where v.id::text = (storage.foldername(name))[1] …)
--    resolved to v.name (venues.name), so the check never passed and every venue photo upload failed RLS.
--    Recreated with storage.objects.name qualified everywhere.
--    Audit: no other storage or public policy references table columns inside a subquery (the remaining
--    subqueries are only `(select auth.uid())`), so nothing else is affected.
-- 2) venue_detail returns flags text[] = osm_tags->'bojo:flags' (import facts such as on_school_grounds,
--    customers_only, restricted_access); '{}' if none. Recreated (drop + create), re-granted to anon + authenticated.

drop policy if exists venue_photos_obj_insert on storage.objects;
create policy venue_photos_obj_insert on storage.objects for insert to authenticated with check (
  storage.objects.bucket_id = 'venue-photos'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and exists (select 1 from public.venues v
               where v.id::text = (storage.foldername(storage.objects.name))[1]
                 and v.status = 'active'));

-- ---------------------------------------------------------------------------

drop function public.venue_detail(uuid);

create function public.venue_detail(p_venue_id uuid)
returns table (id uuid, name text, kind public.venue_kind, lat float8, lng float8, district_key text, address text,
               surface text, is_lit boolean, is_free boolean, is_indoor boolean, access text, opening_hours text,
               website text, phone text, source public.venue_source, osm_type text, osm_id bigint,
               status public.moderation_status, is_mock boolean, sport_ids text[], photo_count int,
               upcoming_events_count int, has_pending_edit_by_me boolean, is_mine boolean,
               created_at timestamptz, updated_at timestamptz, flags text[])
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
         v.created_at, v.updated_at,
         case when jsonb_typeof(v.osm_tags -> 'bojo:flags') = 'array'
              then array(select f from jsonb_array_elements_text(v.osm_tags -> 'bojo:flags') f)
              else '{}'::text[] end
    from public.venues v
   where v.id = p_venue_id;
end $$;

revoke all on function public.venue_detail(uuid) from public, anon, authenticated;
grant execute on function public.venue_detail(uuid) to anon, authenticated;
