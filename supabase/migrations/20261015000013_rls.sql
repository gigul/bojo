-- Bojo — row level security (ARCHITECTURE §4.2, exact). RLS is enabled on every table in public.

alter table public.districts            enable row level security;
alter table public.sports               enable row level security;
alter table public.profiles             enable row level security;
alter table public.profile_private      enable row level security;
alter table public.user_sports          enable row level security;
alter table public.availability_slots   enable row level security;
alter table public.runner_profiles      enable row level security;
alter table public.runs                 enable row level security;
alter table public.venues               enable row level security;
alter table public.venue_sports         enable row level security;
alter table public.venue_photos         enable row level security;
alter table public.venue_edits          enable row level security;
alter table public.event_series         enable row level security;
alter table public.events               enable row level security;
alter table public.event_participants   enable row level security;
alter table public.ratings              enable row level security;
alter table public.swipes               enable row level security;
alter table public.matches              enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.blocks               enable row level security;
alter table public.reports              enable row level security;
alter table public.push_tokens          enable row level security;
alter table public.notifications        enable row level security;
alter table private.moderators          enable row level security;   -- no policies, no grants

-- reference data (anon + authenticated)
create policy districts_read    on public.districts    for select to anon, authenticated using (true);
create policy sports_read       on public.sports       for select to anon, authenticated using (true);
create policy venue_sports_read on public.venue_sports for select to anon, authenticated using (true);

-- profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or not private.is_blocked_pair((select auth.uid()), id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private (owner only)
create policy profile_private_read_own on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_private_update_own on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_sports_read on public.user_sports for select to authenticated
  using (user_id = (select auth.uid()) or not private.is_blocked_pair((select auth.uid()), user_id));
create policy availability_read_own on public.availability_slots for select to authenticated
  using (user_id = (select auth.uid()));
create policy runner_profiles_own on public.runner_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy runs_own on public.runs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- venues
create policy venues_read on public.venues for select to authenticated
  using (status = 'active' or created_by = (select auth.uid()));
create policy venue_photos_read on public.venue_photos for select to authenticated
  using (status = 'active' or uploaded_by = (select auth.uid()));
create policy venue_photos_delete_own on public.venue_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()));
create policy venue_edits_read on public.venue_edits for select to authenticated
  using (created_by = (select auth.uid()) or private.is_moderator((select auth.uid())));

-- events
create policy events_read on public.events for select to authenticated using (
  organizer_id = (select auth.uid())
  or private.is_event_member(id, (select auth.uid()))
  or (visibility = 'public' and not private.is_blocked_pair((select auth.uid()), organizer_id)));
create policy event_series_read on public.event_series for select to authenticated
  using (visibility = 'public' or organizer_id = (select auth.uid()));
create policy event_participants_read_own on public.event_participants for select to authenticated
  using (user_id = (select auth.uid()));           -- lists of others ONLY via event_participants_list()
create policy ratings_read on public.ratings for select to authenticated
  using (rater_id = (select auth.uid()) or ratee_id = (select auth.uid()));

-- matching / chat
create policy swipes_read_own  on public.swipes  for select to authenticated using (swiper_id = (select auth.uid()));
create policy matches_read_own on public.matches for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
create policy conversations_read on public.conversations for select to authenticated
  using (private.is_conversation_member(id, (select auth.uid())));
create policy conversation_members_read on public.conversation_members for select to authenticated using (
  user_id = (select auth.uid())
  or (private.is_conversation_member(conversation_id, (select auth.uid()))
      and not private.is_blocked_pair((select auth.uid()), user_id)));
create policy messages_read on public.messages for select to authenticated using (
  private.is_conversation_member(conversation_id, (select auth.uid()))
  and (sender_id is null or sender_id = (select auth.uid())
       or not private.is_blocked_pair((select auth.uid()), sender_id)));
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and kind = 'text'
  and payload is null
  and private.can_post_message(conversation_id, (select auth.uid())));

-- safety / notifications
create policy blocks_read_own        on public.blocks        for select to authenticated using (blocker_id = (select auth.uid()));
create policy reports_read_own       on public.reports       for select to authenticated using (reporter_id = (select auth.uid()));
create policy push_tokens_read_own   on public.push_tokens   for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
