-- Bojo — people (ARCHITECTURE §3.3)

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default '' check (char_length(display_name) <= 40),
  avatar_path       text check (avatar_path is null or char_length(avatar_path) <= 200),  -- 'avatars' bucket path "<id>/<uuid>.jpg"
  bio               text check (bio is null or char_length(bio) <= 300),
  district_key      text references public.districts(key),
  goal              public.user_goal,
  discoverable      boolean not null default true,       -- show in matching
  is_verified       boolean not null default false,      -- SERVER-ONLY
  attended_count    int not null default 0,              -- SERVER-ONLY
  no_show_count     int not null default 0,              -- SERVER-ONLY
  reliability_score smallint check (reliability_score between 0 and 100),  -- SERVER-ONLY; null until >= 3 rated events
  onboarded_at      timestamptz,                         -- SERVER-ONLY (complete_onboarding)
  is_mock           boolean not null default false,      -- SERVER-ONLY
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_district_idx on public.profiles (district_key);

-- OWNER-ONLY. Never joined into anything returned to other users (ARCHITECTURE §8).
create table public.profile_private (
  user_id                      uuid primary key references public.profiles(id) on delete cascade,
  home_location                extensions.geography(Point,4326),   -- SERVER-ONLY write (set_home_location), snapped ~550 m
  home_location_updated_at     timestamptz,                         -- SERVER-ONLY
  home_location_changes_on     date,                                -- SERVER-ONLY (rate limit day)
  home_location_changes_count  smallint not null default 0,         -- SERVER-ONLY
  notify_radius_km             smallint not null default 5 check (notify_radius_km between 1 and 30),
  push_enabled                 boolean not null default true,
  locale                       text not null default 'ru' check (locale in ('ru','pl','en')),
  updated_at                   timestamptz not null default now()
);
create index profile_private_home_gix on public.profile_private using gist (home_location);

create table public.user_sports (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  sport_id   text not null references public.sports(id),
  level      smallint not null check (level between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);
create index user_sports_sport_idx on public.user_sports (sport_id, level);

create table public.availability_slots (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  weekday  smallint not null check (weekday between 1 and 7),       -- ISO: 1 = Monday
  day_part public.day_part not null,
  primary key (user_id, weekday, day_part)
);

-- Module 4 (running) — STUB
create table public.runner_profiles (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  pace_fast_sec_per_km  smallint check (pace_fast_sec_per_km between 150 and 900),
  pace_slow_sec_per_km  smallint check (pace_slow_sec_per_km between 150 and 900),
  preferred_distance_km numeric(4,1) check (preferred_distance_km between 1 and 100),
  updated_at            timestamptz not null default now(),
  check (pace_fast_sec_per_km is null or pace_slow_sec_per_km is null or pace_fast_sec_per_km <= pace_slow_sec_per_km)
);

create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source      public.run_source not null default 'manual',
  external_id text,
  started_at  timestamptz not null,
  distance_m  int not null check (distance_m between 1 and 500000),
  duration_s  int not null check (duration_s between 1 and 172800),
  created_at  timestamptz not null default now(),
  constraint runs_external_uniq unique (user_id, source, external_id)
);
create index runs_user_started_idx on public.runs (user_id, started_at desc);

create table private.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
