-- Bojo — Realtime (ARCHITECTURE §7). postgres_changes are filtered per subscriber by SELECT RLS.
-- Only these three tables; profile_private is never published.
alter publication supabase_realtime add table public.messages, public.events, public.notifications;
