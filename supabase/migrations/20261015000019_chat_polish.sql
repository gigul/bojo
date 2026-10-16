-- Bojo — chat polish (lead follow-up, integration feedback from the events/chat client)
-- 1) my_conversations.unread_count ignores kind='system' messages (event_invite still counts).
-- 2) decline_invite explicitly bumps events.updated_at → Realtime `event:<id>` UPDATE refreshes the invite card.
-- 3) my_conversations returns last_message_payload jsonb (payload of the last visible message, NULL if none).
-- my_conversations changes its return type → drop + create; EXECUTE re-granted to authenticated only.

drop function public.my_conversations();

create function public.my_conversations()
returns table (conversation_id uuid, kind public.conversation_kind, event_id uuid, match_id uuid, title text,
               other_user_id uuid, avatar_path text, sport_id text, event_starts_at timestamptz,
               event_status public.event_status, last_message_body text, last_message_kind public.message_kind,
               last_message_at timestamptz, last_message_sender_id uuid, last_message_payload jsonb,
               unread_count int, muted boolean)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare v_uid uuid := private.require_uid();
begin
  return query
  select c.id, c.kind, c.event_id, c.match_id,
         case when c.kind = 'event' then e.title else op.display_name end,
         case when c.kind = 'match' then ou.other_id end,
         case when c.kind = 'match' then op.avatar_path end,
         e.sport_id, e.starts_at, e.status,
         lm.body, lm.kind, lm.created_at, lm.sender_id, lm.payload,
         (select count(*)::int from public.messages ms
           where ms.conversation_id = c.id
             and ms.kind <> 'system'                                  -- system notices are never "unread"
             and ms.created_at > coalesce(m.last_read_at, m.joined_at)
             and ms.sender_id is distinct from v_uid
             and (ms.sender_id is null or not private.is_blocked_pair(v_uid, ms.sender_id))),
         m.muted
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    left join public.events e on e.id = c.event_id
    left join public.matches mt on mt.id = c.match_id
    left join lateral (select case when mt.user_a = v_uid then mt.user_b else mt.user_a end as other_id) ou on c.kind = 'match'
    left join public.profiles op on op.id = ou.other_id
    left join lateral (
      select ms.body, ms.kind, ms.created_at, ms.sender_id, ms.payload
        from public.messages ms
       where ms.conversation_id = c.id
         and (ms.sender_id is null or ms.sender_id = v_uid or not private.is_blocked_pair(v_uid, ms.sender_id))
       order by ms.created_at desc, ms.id desc
       limit 1) lm on true
   where m.user_id = v_uid
     and (c.kind = 'event' or (mt.status = 'active' and not private.is_blocked_pair(mt.user_a, mt.user_b)))
   order by coalesce(c.last_message_at, c.created_at) desc, c.id;
end $$;

revoke all on function public.my_conversations() from public, anon, authenticated;
grant execute on function public.my_conversations() to authenticated;

-- Same signature/return type → create or replace keeps the existing grant (authenticated only).
create or replace function public.decline_invite(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_uid    uuid := private.require_uid();
  v_status public.participant_status;
begin
  perform 1 from public.events e where e.id = p_event_id for update;
  if not found then raise exception 'not_found'; end if;
  select ep.status into v_status from public.event_participants ep
   where ep.event_id = p_event_id and ep.user_id = v_uid;
  if v_status is distinct from 'invited' then raise exception 'not_participant'; end if;
  update public.event_participants ep set status = 'left', left_at = now()
   where ep.event_id = p_event_id and ep.user_id = v_uid;
  -- explicit bump so subscribers of Realtime `event:<id>` (the proposer's invite card) get an UPDATE
  update public.events e set updated_at = now() where e.id = p_event_id;
end $$;
