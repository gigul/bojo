// delete-account (verify_jwt = true) — ARCHITECTURE §6.
// Client: supabase.functions.invoke('delete-account'). Removes avatars/<uid>/* then deletes the auth user,
// which cascades all public rows (venue_photos.uploaded_by / venues.created_by become NULL).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'not_authenticated' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const uid = userData?.user?.id;
  if (userErr || !uid) return json({ error: 'not_authenticated' }, 401);

  // Remove the user's avatar files (paths "<uid>/<file>").
  for (let round = 0; round < 20; round++) {
    const { data: files, error } = await admin.storage.from('avatars').list(uid, { limit: 100 });
    if (error) {
      console.error('avatar list failed', error.message);
      break;
    }
    if (!files || files.length === 0) break;
    const { error: rmErr } = await admin.storage
      .from('avatars')
      .remove(files.map((f) => `${uid}/${f.name}`));
    if (rmErr) {
      console.error('avatar remove failed', rmErr.message);
      break;
    }
    if (files.length < 100) break;
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error('deleteUser failed', delErr.message);
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ ok: true });
});
