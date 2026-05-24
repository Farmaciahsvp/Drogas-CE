begin;

-- Allow authenticated pharmacy users to resolve display names for activity history.
drop policy if exists "profiles_select_auth_directory" on public.profiles;
create policy "profiles_select_auth_directory"
on public.profiles
for select
to authenticated
using (public.is_pharmacist_or_admin());

commit;
