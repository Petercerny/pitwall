-- Run once in your Supabase SQL editor. No anonymous access or client writes.
create table if not exists public.archive_sessions (
  id text primary key,
  year integer not null check (year >= 2023),
  round integer not null,
  event_name text not null,
  location text,
  country text,
  session_type text not null check (session_type in ('R','S','Q','SQ')),
  session_name text not null,
  session_date timestamptz,
  status text not null check (status in ('available','unavailable','scheduled','cancelled')),
  object_path text,
  checksum text,
  size_bytes bigint,
  schema_version integer,
  imported_at timestamptz,
  source jsonb,
  results jsonb,
  detail text
);
alter table public.archive_sessions enable row level security;
revoke all on public.archive_sessions from anon, authenticated;
grant all on public.archive_sessions to service_role;
insert into storage.buckets (id,name,public) values ('pitwall-archive','pitwall-archive',false)
on conflict (id) do nothing;
