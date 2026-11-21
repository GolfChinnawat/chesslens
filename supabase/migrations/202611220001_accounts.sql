create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pgn text not null check (octet_length(pgn) between 1 and 2097152),
  fingerprint text generated always as (md5(pgn)) stored,
  source text not null default 'pgn' check (source in ('pgn', 'public', 'local')),
  result text not null default '*' check (result in ('1-0','0-1','1/2-1/2','*')),
  opening text check (length(opening) <= 200),
  time_control text check (length(time_control) <= 80),
  played_at date,
  saved_at timestamptz not null default now(),
  unique (user_id, fingerprint),
  unique (user_id, id)
);

create table public.reviews (
  user_id uuid not null default auth.uid(),
  game_id uuid not null,
  engine text not null default 'Stockfish 17.1 Lite',
  depth int not null check (depth in (12, 16, 18, 20)),
  config_version int not null default 1,
  payload jsonb not null check (
    octet_length(payload::text) <= 4194304 and
    jsonb_typeof(payload) = 'object' and
    case when jsonb_typeof(payload->'positions') = 'array'
      and jsonb_typeof(payload->'evaluations') = 'array'
      then jsonb_array_length(payload->'positions') between 2 and 2001
        and jsonb_array_length(payload->'positions') = jsonb_array_length(payload->'evaluations')
      else false end
  ),
  primary key (game_id, depth),
  foreign key (user_id, game_id) references public.games(user_id, id) on delete cascade
);

create table public.mistake_positions (
  user_id uuid not null default auth.uid(),
  game_id uuid not null,
  ply int not null check (ply > 0),
  fen text not null check (length(fen) between 1 and 150),
  played text not null check (played ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  best text not null check (best ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  class text not null check (class in ('mistake','blunder','miss','inaccuracy')),
  theme text not null default 'general' check (length(theme) <= 60),
  times_seen int not null default 0 check (times_seen >= 0),
  box int not null default 0 check (box between 0 and 4),
  last_result boolean,
  due_at timestamptz not null default now(),
  primary key (game_id, ply),
  foreign key (user_id, game_id) references public.games(user_id, id) on delete cascade
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 60)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['games','reviews','mistake_positions','settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner on public.%I to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;

create function public.save_review(game_pgn text, game_source text, game_result text, game_opening text,
  game_time_control text, game_date date, review_depth int, review_payload jsonb, mistakes jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if review_payload #>> '{game,pgn}' is distinct from game_pgn
    or review_payload -> 'depth' is distinct from to_jsonb(review_depth) then
    raise exception 'Review does not match game or depth';
  end if;
  insert into public.games (pgn, source, result, opening, time_control, played_at)
    values (game_pgn, game_source, game_result, left(game_opening, 200), left(game_time_control, 80), game_date)
    on conflict (user_id, fingerprint) do update set saved_at = now()
    returning id into saved_id;
  insert into public.reviews (game_id, depth, payload) values (saved_id, review_depth, review_payload)
    on conflict (game_id, depth) do update set payload = excluded.payload;
  if jsonb_typeof(mistakes) is distinct from 'array' or octet_length(mistakes::text) > 2097152 then
    raise exception 'Invalid training data';
  end if;
  insert into public.mistake_positions (game_id, ply, fen, played, best, class)
    select saved_id, entry.ply, entry.fen, entry.played, entry.best, entry.class
    from jsonb_to_recordset(mistakes) as entry(ply int, fen text, played text, best text, class text)
    on conflict (game_id, ply) do nothing;
  return saved_id;
end $$;
revoke execute on function public.save_review(text,text,text,text,text,date,int,jsonb,jsonb) from public, anon;
grant execute on function public.save_review(text,text,text,text,text,date,int,jsonb,jsonb) to authenticated;

create function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
