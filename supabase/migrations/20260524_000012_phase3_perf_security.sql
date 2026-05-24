begin;

-- Phase 3A: Performance indexes for high-volume history and dashboard paths
create index if not exists idx_prescriptions_status_created_desc
  on public.prescriptions (status, created_at desc);

create index if not exists idx_prescriptions_created_desc
  on public.prescriptions (created_at desc);

create index if not exists idx_transactions_created_desc
  on public.transactions (created_at desc);

create index if not exists idx_transactions_reference_type_id
  on public.transactions (reference_type, reference_id);

create index if not exists idx_replenishment_status_created_desc
  on public.replenishment_requests (status, created_at desc);

create index if not exists idx_replenishment_created_desc
  on public.replenishment_requests (created_at desc);

create index if not exists idx_prescription_items_prescription_medication
  on public.prescription_items (prescription_id, medication_id);

create index if not exists idx_medications_category
  on public.medications (category);

-- Phase 3B: Column-level hardening on profiles
-- Keep shared visibility requirement while reducing exposed surface.
revoke all on table public.profiles from authenticated;

grant select (id, username, name, role) on public.profiles to authenticated;
grant update (username, name) on public.profiles to authenticated;

commit;
