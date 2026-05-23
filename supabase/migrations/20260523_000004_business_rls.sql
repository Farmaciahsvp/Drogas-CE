-- Phase 3: RLS for business tables

begin;

-- Utility helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_pharmacist_or_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'farmaceutico')
  );
$$;

-- Enable RLS
alter table public.medications enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.transactions enable row level security;
alter table public.replenishment_requests enable row level security;

-- MEDICATIONS
drop policy if exists "medications_select_auth" on public.medications;
create policy "medications_select_auth"
on public.medications
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "medications_insert_admin" on public.medications;
create policy "medications_insert_admin"
on public.medications
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "medications_update_admin" on public.medications;
create policy "medications_update_admin"
on public.medications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- PRESCRIPTIONS
drop policy if exists "prescriptions_select_auth" on public.prescriptions;
create policy "prescriptions_select_auth"
on public.prescriptions
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "prescriptions_insert_auth" on public.prescriptions;
create policy "prescriptions_insert_auth"
on public.prescriptions
for insert
to authenticated
with check (
  public.is_pharmacist_or_admin() and created_by = auth.uid()
);

drop policy if exists "prescriptions_update_auth" on public.prescriptions;
create policy "prescriptions_update_auth"
on public.prescriptions
for update
to authenticated
using (public.is_pharmacist_or_admin())
with check (public.is_pharmacist_or_admin());

-- PRESCRIPTION ITEMS
drop policy if exists "prescription_items_select_auth" on public.prescription_items;
create policy "prescription_items_select_auth"
on public.prescription_items
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "prescription_items_insert_auth" on public.prescription_items;
create policy "prescription_items_insert_auth"
on public.prescription_items
for insert
to authenticated
with check (public.is_pharmacist_or_admin());

drop policy if exists "prescription_items_update_auth" on public.prescription_items;
create policy "prescription_items_update_auth"
on public.prescription_items
for update
to authenticated
using (public.is_pharmacist_or_admin())
with check (public.is_pharmacist_or_admin());

-- TRANSACTIONS
drop policy if exists "transactions_select_auth" on public.transactions;
create policy "transactions_select_auth"
on public.transactions
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "transactions_insert_auth_own" on public.transactions;
create policy "transactions_insert_auth_own"
on public.transactions
for insert
to authenticated
with check (
  public.is_pharmacist_or_admin() and user_id = auth.uid()
);

-- REPLENISHMENT REQUESTS
drop policy if exists "replenishment_select_auth" on public.replenishment_requests;
create policy "replenishment_select_auth"
on public.replenishment_requests
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "replenishment_insert_auth_own" on public.replenishment_requests;
create policy "replenishment_insert_auth_own"
on public.replenishment_requests
for insert
to authenticated
with check (
  public.is_pharmacist_or_admin() and user_id = auth.uid()
);

drop policy if exists "replenishment_update_admin" on public.replenishment_requests;
create policy "replenishment_update_admin"
on public.replenishment_requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;
