-- Bojo — extensions and schemas (ARCHITECTURE §3.0)
create extension if not exists postgis with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Helpers, trigger functions, cron functions and moderators live here.
-- NOT exposed by PostgREST ([api] schemas = ["public","graphql_public"]).
create schema if not exists private;
revoke all on schema private from public;
