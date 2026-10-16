-- Bojo — storage buckets + policies (ARCHITECTURE §4.5)
-- Public-read buckets with random UUID filenames; no list policy for others (no enumeration).
-- Uploads are re-encoded client-side, which strips EXIF/GPS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('venue-photos', 'venue-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- avatars: path "<user_id>/<uuid>.jpg"
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- venue-photos: path "<venue_id>/<user_id>/<uuid>.jpg"
create policy venue_photos_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'venue-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (select 1 from public.venues v where v.id::text = (storage.foldername(name))[1] and v.status = 'active'));
create policy venue_photos_obj_select_own on storage.objects for select to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy venue_photos_obj_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
