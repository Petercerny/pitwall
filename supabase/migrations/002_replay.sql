-- Optional telemetry pointer; existing timing snapshots remain unchanged.
alter table public.archive_sessions add column if not exists replay_object_path text;
