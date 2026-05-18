-- PostgREST uses the database role tied to the JWT (e.g. `authenticated`).
-- New tables do not inherit broad privileges; without GRANT, RLS never runs — requests fail first.

grant select, insert, update, delete on table public.memo_shares to authenticated;

grant all on table public.memo_shares to service_role;
