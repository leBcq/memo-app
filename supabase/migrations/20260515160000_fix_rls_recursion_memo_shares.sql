-- Break RLS recursion between `memos` and `memo_shares`:
-- `memos` policies reference `memo_shares`; `memo_shares` owner policies used to reference `memos`
-- with normal RLS, causing nested evaluation and 500 / "infinite recursion" errors.
--
-- Owner checks on memo_shares use SECURITY DEFINER so the inner read of `memos` bypasses RLS.

create or replace function public.memo_is_owned_by_auth_user(p_memo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memos m
    where m.id = p_memo_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.memo_is_owned_by_auth_user(uuid) is
  'True if auth.uid() owns the memo. SECURITY DEFINER to avoid RLS recursion with memo_shares policies.';

revoke all on function public.memo_is_owned_by_auth_user(uuid) from public;
grant execute on function public.memo_is_owned_by_auth_user(uuid) to authenticated;
grant execute on function public.memo_is_owned_by_auth_user(uuid) to service_role;

-- Replace owner policies (stop using bare EXISTS on memos)
drop policy if exists "memo_shares_select_owner" on public.memo_shares;
drop policy if exists "memo_shares_insert_owner" on public.memo_shares;
drop policy if exists "memo_shares_update_owner" on public.memo_shares;
drop policy if exists "memo_shares_delete_owner" on public.memo_shares;

create policy "memo_shares_select_owner"
  on public.memo_shares
  for select
  using (public.memo_is_owned_by_auth_user(memo_id));

create policy "memo_shares_insert_owner"
  on public.memo_shares
  for insert
  with check (public.memo_is_owned_by_auth_user(memo_id));

create policy "memo_shares_update_owner"
  on public.memo_shares
  for update
  using (public.memo_is_owned_by_auth_user(memo_id))
  with check (public.memo_is_owned_by_auth_user(memo_id));

create policy "memo_shares_delete_owner"
  on public.memo_shares
  for delete
  using (public.memo_is_owned_by_auth_user(memo_id));
