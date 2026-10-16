-- Bojo — LOCAL DEV ONLY vault secrets for pg_net → Edge Function push-dispatch (ARCHITECTURE §6).
-- These are dev placeholders, not real keys. Production sets real values once in the SQL editor:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'bojo_functions_url');
--   select vault.create_secret('<long random secret = PUSH_DISPATCH_SECRET>', 'bojo_dispatch_secret');
-- Without these secrets the dispatch trigger/sweep are no-ops (the in-app inbox still works).
-- host.docker.internal resolves to the host from inside the Postgres container on Docker Desktop.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bojo_functions_url') then
    perform vault.create_secret('http://host.docker.internal:44321/functions/v1', 'bojo_functions_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'bojo_dispatch_secret') then
    perform vault.create_secret('local-dev-dispatch-secret', 'bojo_dispatch_secret');
  end if;
end $$;
