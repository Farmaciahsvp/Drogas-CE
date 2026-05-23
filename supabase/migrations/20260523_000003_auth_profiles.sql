-- Phase 2: Supabase Auth + profiles sync + basic profile access policies

begin;

-- Keep username lowercase and trimmed
create or replace function public.normalize_username()
returns trigger
language plpgsql
as $$
begin
  new.username = lower(trim(new.username));
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_username on public.profiles;
create trigger trg_profiles_normalize_username
before insert or update on public.profiles
for each row execute function public.normalize_username();

-- Auto-create profile on new auth user.
-- Role defaults to farmaceutico; admin role should be elevated manually by an admin flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_username text;
  new_name text;
begin
  new_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'user_' || substr(new.id::text, 1, 8));
  new_name := coalesce(new.raw_user_meta_data->>'name', new_username);

  insert into public.profiles (id, username, name, role)
  values (new.id, new_username, new_name, 'farmaceutico')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Utility function to fetch current user role
create or replace function public.current_app_role()
returns app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Enable RLS and create base policies only for profiles in this phase.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.current_app_role() = 'admin')
with check (id = auth.uid() or public.current_app_role() = 'admin');

commit;
