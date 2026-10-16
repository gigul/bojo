-- Bojo — privileges (ARCHITECTURE §4.1, §4.3). LAST DDL migration for public objects:
-- revoke everything Supabase's default privileges granted, then grant only what the app needs.
-- Any future migration that adds a table or function MUST add explicit grants.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- private: helpers are callable only where RLS policies need them
revoke all on all tables    in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function
  private.is_blocked_pair(uuid, uuid),
  private.is_conversation_member(uuid, uuid),
  private.is_event_member(uuid, uuid),
  private.can_post_message(uuid, uuid),
  private.is_moderator(uuid)
to authenticated;

-- Future objects created by migrations (role postgres) are NOT auto-exposed.
alter default privileges for role postgres in schema public  revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- tables (§4.3, exhaustive)
-- ---------------------------------------------------------------------------
grant select on public.districts, public.sports, public.venue_sports to anon, authenticated;
grant select on public.profiles, public.profile_private, public.user_sports, public.availability_slots,
  public.runner_profiles, public.runs, public.venues, public.venue_photos, public.venue_edits,
  public.event_series, public.events, public.event_participants, public.ratings, public.swipes, public.matches,
  public.conversations, public.conversation_members, public.messages, public.blocks, public.reports,
  public.push_tokens, public.notifications to authenticated;

grant update (display_name, avatar_path, bio, district_key, goal, discoverable) on public.profiles to authenticated;
grant update (notify_radius_km, push_enabled, locale)                           on public.profile_private to authenticated;
grant insert (id, conversation_id, body)                                         on public.messages to authenticated;
grant delete                                                                     on public.venue_photos to authenticated;
grant insert, update, delete on public.runner_profiles, public.runs to authenticated;

-- ---------------------------------------------------------------------------
-- functions
-- ---------------------------------------------------------------------------
grant execute on function
  public.venues_in_bbox(float8, float8, float8, float8, text[], int),
  public.venue_detail(uuid),
  public.venue_photos_list(uuid),
  public.events_feed(float8, float8, float8, text[], text, text, uuid, boolean, int, timestamptz, uuid),
  public.event_detail(uuid)
to anon, authenticated;

grant execute on function
  public.add_venue(text, public.venue_kind, float8, float8, text[], text, boolean, boolean, boolean, text),
  public.suggest_venue_edit(uuid, public.venue_edit_kind, jsonb, text),
  public.add_venue_photo(uuid, text),
  public.review_venue_edit(uuid, boolean),
  public.my_events(text, int),
  public.event_participants_list(uuid),
  public.create_event(text, uuid, timestamptz, int, int, int, int, text, text, int[], date),
  public.join_event(uuid),
  public.leave_event(uuid),
  public.decline_invite(uuid),
  public.cancel_event(uuid, text),
  public.remove_participant(uuid, uuid),
  public.cancel_series(uuid),
  public.submit_attendance(uuid, jsonb),
  public.get_or_create_event_conversation(uuid),
  public.my_conversations(),
  public.mark_conversation_read(uuid),
  public.set_conversation_muted(uuid, boolean),
  public.match_candidates(int, text),
  public.swipe(uuid, boolean, text),
  public.unmatch(uuid),
  public.propose_meeting(uuid, text, uuid, timestamptz, int, text),
  public.person_summary(uuid),
  public.complete_onboarding(),
  public.set_user_sports(jsonb),
  public.set_availability(jsonb),
  public.set_home_location(float8, float8),
  public.clear_home_location(),
  public.set_user_verified(uuid, boolean),
  public.moderate_content(public.report_target, uuid, public.moderation_status),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.blocked_users(),
  public.submit_report(public.report_target, uuid, public.report_reason, text),
  public.register_push_token(text, public.push_platform),
  public.unregister_push_token(text),
  public.mark_notifications_read(uuid[])
to authenticated;

grant execute on function
  public.claim_push_batch(uuid[], int),
  public.complete_push_batch(jsonb, text[])
to service_role;
