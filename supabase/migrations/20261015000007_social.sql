-- Bojo — matching, chat, safety, notifications (ARCHITECTURE §3.6)

create table public.swipes (
  swiper_id  uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  liked      boolean not null,
  sport_id   text references public.sports(id),
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  check (swiper_id <> target_id)
);
create index swipes_target_liked_idx on public.swipes (target_id) where liked;
create index swipes_swiper_created_idx on public.swipes (swiper_id, created_at desc);

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,   -- canonical: user_a < user_b
  user_b       uuid not null references public.profiles(id) on delete cascade,
  status       public.match_status not null default 'active',
  created_at   timestamptz not null default now(),
  unmatched_at timestamptz,
  constraint matches_order_chk check (user_a < user_b),
  constraint matches_pair_uniq unique (user_a, user_b)
);
create index matches_user_b_idx on public.matches (user_b);

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.conversation_kind not null,
  event_id        uuid unique references public.events(id) on delete cascade,
  match_id        uuid unique references public.matches(id) on delete cascade,
  last_message_at timestamptz,                                      -- trigger-maintained
  created_at      timestamptz not null default now(),
  constraint conversations_kind_chk check (
    (kind = 'event' and event_id is not null and match_id is null) or
    (kind = 'match' and match_id is not null and event_id is null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  muted           boolean not null default false,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),  -- client may supply (optimistic UI dedupe)
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid default auth.uid() references public.profiles(id) on delete set null, -- null = system
  kind            public.message_kind not null default 'text',
  body            text not null default '',
  payload         jsonb,               -- event_invite: {event_id, sport_id, starts_at, venue_name}; system: {type, user_id}
  created_at      timestamptz not null default now(),
  constraint messages_body_chk check (char_length(body) <= 2000 and (kind <> 'text' or btrim(body) <> ''))
);
create index messages_conv_created_idx   on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_created_idx on public.messages (sender_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  details     text check (details is null or char_length(details) <= 1000),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  constraint reports_once_uniq unique (reporter_id, target_type, target_id)
);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_status_idx on public.reports (status, created_at);
create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);

create table public.push_tokens (
  token        text primary key check (char_length(token) <= 255),   -- ExponentPushToken[...]
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     public.push_platform not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (           -- in-app inbox + dedupe log + push outbox
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            public.notification_type not null,
  payload         jsonb not null default '{}',   -- shapes in §9.2 NotificationPayloads; always contains "url"
  dedupe_key      text,
  push_status     public.push_status not null default 'pending',
  push_attempts   smallint not null default 0,
  push_error      text,
  push_claimed_at timestamptz,                   -- SERVER-ONLY: when claim_push_batch last moved it to 'sending'
  sent_at         timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint notifications_dedupe_uniq unique (user_id, dedupe_key)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_push_queue_idx   on public.notifications (created_at) where push_status in ('pending','sending');
create index notifications_user_unread_idx  on public.notifications (user_id) where read_at is null;
