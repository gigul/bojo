-- Bojo — events (ARCHITECTURE §3.5)

create table public.event_series (
  id             uuid primary key default gen_random_uuid(),
  organizer_id   uuid not null references public.profiles(id) on delete cascade,
  sport_id       text not null references public.sports(id),
  venue_id       uuid not null references public.venues(id),
  title          text check (title is null or char_length(title) <= 80),
  description    text check (description is null or char_length(description) <= 1000),
  spots_total    smallint not null check (spots_total between 2 and 50),
  spots_reserved smallint not null default 0 check (spots_reserved >= 0),
  level          smallint check (level between 1 and 5),                -- null = any level
  visibility     public.event_visibility not null default 'public',
  weekdays       smallint[] not null check (cardinality(weekdays) between 1 and 7
                                            and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  start_time     time not null,                                          -- local time in `timezone`
  duration_min   smallint not null check (duration_min between 15 and 480),
  timezone       text not null default 'Europe/Warsaw',
  starts_on      date not null,
  until_on       date check (until_on is null or until_on >= starts_on), -- RPC caps at starts_on + 26 weeks
  is_active      boolean not null default true,
  is_mock        boolean not null default false,
  created_at     timestamptz not null default now(),
  check (spots_reserved <= spots_total - 2)
);
create index event_series_organizer_idx on public.event_series (organizer_id, created_at desc);
create index event_series_active_idx    on public.event_series (id) where is_active;

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid references public.event_series(id) on delete set null,
  sport_id       text not null references public.sports(id),
  venue_id       uuid not null references public.venues(id),
  organizer_id   uuid not null references public.profiles(id) on delete cascade,
  title          text check (title is null or char_length(title) <= 80),   -- e.g. "5x5"; UI composes fallback
  description    text check (description is null or char_length(description) <= 1000),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  spots_total    smallint not null check (spots_total between 2 and 50),  -- total players incl. organizer
  spots_taken    smallint not null default 0,      -- SERVER-ONLY: count of participants with status 'going' (trigger)
  spots_reserved smallint not null default 0,      -- players coming without the app ("we are 7, need 3")
  level          smallint check (level between 1 and 5),                  -- null = any level
  visibility     public.event_visibility not null default 'public',      -- 'private' = propose_meeting
  status         public.event_status not null default 'scheduled',      -- SERVER-ONLY
  cancelled_at   timestamptz,
  cancel_reason  text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  is_mock        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint events_time_chk  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  constraint events_spots_chk check (spots_taken >= 0 and spots_reserved >= 0
                                     and spots_taken + spots_reserved <= spots_total),
  constraint events_series_start_uniq unique (series_id, starts_at)
);
create index events_starts_sched_idx on public.events (starts_at) where status = 'scheduled';
create index events_venue_starts_idx on public.events (venue_id, starts_at);
create index events_sport_starts_idx on public.events (sport_id, starts_at);
create index events_organizer_idx    on public.events (organizer_id, created_at desc);

create table public.event_participants (
  event_id  uuid not null references public.events(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  status    public.participant_status not null default 'going',
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (event_id, user_id)
);
create index event_participants_user_idx  on public.event_participants (user_id, status);
create index event_participants_event_idx on public.event_participants (event_id, status);

create table public.ratings (                 -- attendance / reliability. One row per (event, ratee). MVP rater = organizer.
  event_id   uuid not null references public.events(id) on delete cascade,
  ratee_id   uuid not null references public.profiles(id) on delete cascade,
  rater_id   uuid not null references public.profiles(id) on delete cascade,
  attended   boolean not null,                -- true = showed up, false = no-show
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, ratee_id),
  check (rater_id <> ratee_id)
);
create index ratings_ratee_idx on public.ratings (ratee_id);
create index ratings_rater_idx on public.ratings (rater_id);
