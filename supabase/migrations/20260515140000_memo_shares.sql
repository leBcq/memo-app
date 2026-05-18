-- Collaborative shares: invitees can read memos (viewer) or edit content (editor).
-- Prerequisites: `public.memos` exists with RLS so owners retain full CRUD (e.g. user_id = auth.uid()).

-- Prevent transferring memo ownership via API (editors may UPDATE rows but not user_id).
create or replace function public.memos_enforce_immutable_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'memo owner cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists memos_immutable_owner on public.memos;
create trigger memos_immutable_owner
  before update on public.memos
  for each row
  execute procedure public.memos_enforce_immutable_owner();

-- Share invitations / ACL rows
create table if not exists public.memo_shares (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references public.memos (id) on delete cascade,
  shared_with_email text not null,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (memo_id, shared_with_email)
);

create index if not exists memo_shares_memo_id_idx on public.memo_shares (memo_id);
create index if not exists memo_shares_email_idx on public.memo_shares (lower(trim(shared_with_email)));

alter table public.memo_shares enable row level security;

drop policy if exists "memo_shares_select_owner" on public.memo_shares;
drop policy if exists "memo_shares_insert_owner" on public.memo_shares;
drop policy if exists "memo_shares_update_owner" on public.memo_shares;
drop policy if exists "memo_shares_delete_owner" on public.memo_shares;
drop policy if exists "memo_shares_select_invitee" on public.memo_shares;

-- Owner of the memo: full CRUD on share rows
create policy "memo_shares_select_owner"
  on public.memo_shares
  for select
  using (
    exists (
      select 1 from public.memos m
      where m.id = memo_shares.memo_id and m.user_id = auth.uid()
    )
  );

create policy "memo_shares_insert_owner"
  on public.memo_shares
  for insert
  with check (
    exists (
      select 1 from public.memos m
      where m.id = memo_id and m.user_id = auth.uid()
    )
  );

create policy "memo_shares_update_owner"
  on public.memo_shares
  for update
  using (
    exists (
      select 1 from public.memos m
      where m.id = memo_shares.memo_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memos m
      where m.id = memo_id and m.user_id = auth.uid()
    )
  );

create policy "memo_shares_delete_owner"
  on public.memo_shares
  for delete
  using (
    exists (
      select 1 from public.memos m
      where m.id = memo_shares.memo_id and m.user_id = auth.uid()
    )
  );

-- Invitee can see their own share rows
create policy "memo_shares_select_invitee"
  on public.memo_shares
  for select
  using (
    lower(trim(shared_with_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists "memos_select_shared_invitee" on public.memos;
drop policy if exists "memos_update_shared_editor" on public.memos;

-- Memos: invitee read (adds to any existing owner SELECT policies)
create policy "memos_select_shared_invitee"
  on public.memos
  for select
  using (
    exists (
      select 1 from public.memo_shares ms
      where ms.memo_id = memos.id
        and lower(trim(ms.shared_with_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );

-- Memos: invitee with editor role may update content (owner immutability enforced by trigger)
create policy "memos_update_shared_editor"
  on public.memos
  for update
  using (
    exists (
      select 1 from public.memo_shares ms
      where ms.memo_id = memos.id
        and lower(trim(ms.shared_with_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and ms.role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from public.memo_shares ms
      where ms.memo_id = memos.id
        and lower(trim(ms.shared_with_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and ms.role = 'editor'
    )
  );
