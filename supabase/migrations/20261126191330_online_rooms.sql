create table public.online_rooms (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references auth.users(id) on delete cascade,
  black_id uuid references auth.users(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  turn_started_at timestamptz,
  white_ms integer not null check (white_ms between 0 and 900000),
  black_ms integer not null check (black_ms between 0 and 900000),
  pgn text not null default '' check (octet_length(pgn) <= 65536),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text check (reason in ('mate', 'draw', 'timeout', 'resign')),
  check (black_id is null or white_id <> black_id)
);
create unique index online_rooms_one_waiting
  on public.online_rooms (white_id) where black_id is null;
create index online_rooms_black_idx on public.online_rooms (black_id);
alter table public.online_rooms enable row level security;
revoke all on public.online_rooms from public, anon, authenticated;
grant select on public.online_rooms to authenticated;
grant select, insert, update on public.online_rooms to service_role;

create policy "Only seated players read their room" on public.online_rooms
for select to authenticated using ((select auth.uid()) in (white_id, black_id));

alter publication supabase_realtime add table public.online_rooms;

create index online_rooms_white_idx on public.online_rooms (white_id);
create function public.online_clock() returns timestamptz
language sql stable security invoker set search_path = ''
as $$ select pg_catalog.statement_timestamp() $$;
revoke execute on function public.online_clock() from public, anon;
grant execute on function public.online_clock() to authenticated;
