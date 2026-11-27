alter table public.online_rooms
  add column room_code text not null
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
    check (room_code ~ '^[0-9A-F]{10}$');

create unique index online_rooms_room_code_idx
  on public.online_rooms (room_code);
