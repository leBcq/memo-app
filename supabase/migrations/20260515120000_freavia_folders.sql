-- Folder tree sync (cross-device). Memo rows remain in `memos`; folder-only rows live here.

create table if not exists public.freavia_folders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id text,
  name text not null default '',
  sort_order integer not null default 0,
  is_open boolean not null default true,
  is_bookmarked boolean not null default false,
  icon text,
  color text,
  updated_at timestamptz not null default now()
);

create index if not exists freavia_folders_user_id_idx on public.freavia_folders (user_id);
create index if not exists freavia_folders_user_parent_idx on public.freavia_folders (user_id, parent_id);

alter table public.freavia_folders enable row level security;

create policy "freavia_folders_select_own"
  on public.freavia_folders
  for select
  using (auth.uid() = user_id);

create policy "freavia_folders_insert_own"
  on public.freavia_folders
  for insert
  with check (auth.uid() = user_id);

create policy "freavia_folders_update_own"
  on public.freavia_folders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "freavia_folders_delete_own"
  on public.freavia_folders
  for delete
  using (auth.uid() = user_id);
