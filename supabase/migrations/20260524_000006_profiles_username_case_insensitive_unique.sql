begin;

-- Enforce case-insensitive uniqueness for usernames.
-- 1) Normalize existing rows to lowercase trimmed values.
update public.profiles
set username = lower(trim(username))
where username is not null
  and username <> lower(trim(username));

-- 2) Replace plain unique constraint with a unique functional index.
alter table public.profiles
drop constraint if exists profiles_username_key;

create unique index if not exists idx_profiles_username_lower_unique
on public.profiles ((lower(username)));

commit;
