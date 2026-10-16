-- Bojo — enums (ARCHITECTURE §3.1). Mirrored in packages/shared/src/enums.ts.
create type public.venue_kind          as enum ('pitch','sports_centre','swimming_pool','fitness_station','track','running_route','other');
create type public.venue_source        as enum ('osm','user');
create type public.moderation_status   as enum ('active','pending','hidden');
create type public.venue_edit_kind     as enum ('create','update','close');
create type public.edit_status         as enum ('pending','approved','rejected');
create type public.event_status        as enum ('scheduled','cancelled','completed');
create type public.event_visibility    as enum ('public','private');
create type public.participant_status  as enum ('invited','going','left','removed');
create type public.conversation_kind   as enum ('event','match');
create type public.message_kind        as enum ('text','system','event_invite');
create type public.match_status        as enum ('active','unmatched');
create type public.day_part            as enum ('morning','afternoon','evening');   -- 06–12, 12–17, 17–23 Europe/Warsaw
create type public.user_goal           as enum ('fun','fitness','competition','learning');
create type public.report_target       as enum ('user','event','venue','venue_photo','message');
create type public.report_reason       as enum ('spam','abuse','fake','no_show','inappropriate','wrong_info','other');
create type public.report_status       as enum ('open','reviewed','dismissed');
create type public.notification_type   as enum ('event_nearby','event_joined','event_cancelled','event_invite','match','message','attendance_reminder');
create type public.push_status         as enum ('pending','sending','sent','skipped','failed');
create type public.push_platform       as enum ('ios','android');
create type public.run_source          as enum ('manual','strava','apple_health','google_fit');
