-- Drogas CE - Initial Supabase/Postgres schema
-- Execute in Supabase SQL Editor or via Supabase CLI migrations.

begin;

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'farmaceutico');
  end if;
  if not exists (select 1 from pg_type where typname = 'prescription_status') then
    create type prescription_status as enum ('pending', 'dispensed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type transaction_type as enum ('ingreso', 'egreso');
  end if;
  if not exists (select 1 from pg_type where typname = 'reference_type') then
    create type reference_type as enum ('manual', 'prescription');
  end if;
  if not exists (select 1 from pg_type where typname = 'replenishment_status') then
    create type replenishment_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- Profiles linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (length(trim(username)) >= 3),
  name text not null check (length(trim(name)) >= 3),
  role app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medications (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  active_principle text not null check (length(trim(active_principle)) > 0),
  category text not null check (length(trim(category)) > 0),
  stock integer not null default 0 check (stock >= 0),
  unit text not null check (length(trim(unit)) > 0),
  min_stock integer not null default 10 check (min_stock >= 0),
  shelf_location text not null check (length(trim(shelf_location)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id bigint generated always as identity primary key,
  code text unique not null check (code ~ '^REC-[0-9]{6}$'),
  patient_name text not null check (length(trim(patient_name)) > 0),
  patient_id text not null check (length(trim(patient_id)) > 0),
  doctor_name text not null check (length(trim(doctor_name)) > 0),
  status prescription_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prescription_items (
  id bigint generated always as identity primary key,
  prescription_id bigint not null references public.prescriptions(id) on delete cascade,
  medication_id bigint not null references public.medications(id),
  quantity_prescribed integer not null check (quantity_prescribed > 0),
  quantity_dispensed integer not null default 0 check (quantity_dispensed >= 0),
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescription_items_qty_check check (quantity_dispensed <= quantity_prescribed)
);

create table if not exists public.transactions (
  id bigint generated always as identity primary key,
  medication_id bigint not null references public.medications(id),
  type transaction_type not null,
  quantity integer not null check (quantity > 0),
  reference_type reference_type not null,
  reference_id text,
  user_id uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.replenishment_requests (
  id bigint generated always as identity primary key,
  medication_id bigint not null references public.medications(id),
  quantity integer not null check (quantity > 0),
  notes text,
  user_id uuid not null references public.profiles(id),
  status replenishment_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger function for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_medications_updated_at on public.medications;
create trigger trg_medications_updated_at
before update on public.medications
for each row execute function public.set_updated_at();

drop trigger if exists trg_prescriptions_updated_at on public.prescriptions;
create trigger trg_prescriptions_updated_at
before update on public.prescriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_prescription_items_updated_at on public.prescription_items;
create trigger trg_prescription_items_updated_at
before update on public.prescription_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_replenishment_requests_updated_at on public.replenishment_requests;
create trigger trg_replenishment_requests_updated_at
before update on public.replenishment_requests
for each row execute function public.set_updated_at();

-- Indexes for operational queries
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_medications_name on public.medications(name);
create index if not exists idx_medications_low_stock on public.medications(stock, min_stock);
create index if not exists idx_prescriptions_code on public.prescriptions(code);
create index if not exists idx_prescriptions_status_created on public.prescriptions(status, created_at desc);
create index if not exists idx_prescription_items_prescription on public.prescription_items(prescription_id);
create index if not exists idx_transactions_timestamp on public.transactions(created_at desc);
create index if not exists idx_transactions_medication on public.transactions(medication_id, created_at desc);
create index if not exists idx_replenishment_status_created on public.replenishment_requests(status, created_at desc);

commit;
