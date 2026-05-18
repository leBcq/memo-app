-- Eliminate infinite RLS recursion on `public.memos`:
-- Policies that do EXISTS (SELECT … FROM memo_shares …) still trigger `memo_shares` RLS, which can
-- chain back into `memos` evaluation. Read `memo_shares` inside SECURITY DEFINER helpers instead
-- so RLS is bypassed there (same pattern as `memo_is_owned_by_auth_user` on `memo_shares`).

-- Shared viewer or editor: JWT email matches a share row for this memo.
create or replace function public.is_memo_shared_with_user(p_memo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memo_shares ms
    where ms.memo_id = p_memo_id
      and ms.role in ('viewer', 'editor')
      and lower(trim(ms.shared_with_email))
        = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

comment on function public.is_memo_shared_with_user(uuid) is
  'True if JWT email has viewer/editor share on memo. SECURITY DEFINER to avoid memos↔memo_shares RLS recursion.';

-- Shared editor only (for UPDATE).
create or replace function public.is_memo_editable_by_user(p_memo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memo_shares ms
    where ms.memo_id = p_memo_id
      and ms.role = 'editor'
      and lower(trim(ms.shared_with_email))
        = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

comment on function public.is_memo_editable_by_user(uuid) is
  'True if JWT email has editor share on memo. SECURITY DEFINER to avoid memos↔memo_shares RLS recursion.';

revoke all on function public.is_memo_shared_with_user(uuid) from public;
grant execute on function public.is_memo_shared_with_user(uuid) to authenticated;
grant execute on function public.is_memo_shared_with_user(uuid) to service_role;

revoke all on function public.is_memo_editable_by_user(uuid) from public;
grant execute on function public.is_memo_editable_by_user(uuid) to authenticated;
grant execute on function public.is_memo_editable_by_user(uuid) to service_role;

drop policy if exists "memos_select_shared_invitee" on public.memos;
drop policy if exists "memos_update_shared_editor" on public.memos;
drop policy if exists "memos_select_shared" on public.memos;
drop policy if exists "memos_update_shared" on public.memos;

-- Keep owner access in the same policies so installs that only had invitee/update-share policies
-- (no separate owner policy in migrations) still allow full owner SELECT/UPDATE.
-- If you already have owner-only policies, these add redundant OR branches; PostgreSQL ORs policies, so behavior stays correct.
create policy "memos_select_shared"
  on public.memos
  for select
  using (
    user_id = (select auth.uid())
    or public.is_memo_shared_with_user(id)
  );

create policy "memos_update_shared"
  on public.memos
  for update
  using (
    user_id = (select auth.uid())
    or public.is_memo_editable_by_user(id)
  )
  with check (
    user_id = (select auth.uid())
    or public.is_memo_editable_by_user(id)
  );
