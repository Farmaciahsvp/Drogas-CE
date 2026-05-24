begin;

-- Fix recursive RLS evaluation on profiles.
-- Previous policies referenced helper functions that queried profiles again,
-- causing "stack depth limit exceeded" under joins/selects.

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_auth_directory" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

-- All authenticated users can read profile directory data (id/username/name/role).
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

-- Users can update only their own profile row.
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

commit;
