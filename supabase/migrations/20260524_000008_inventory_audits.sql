begin;

create table if not exists public.inventory_audits (
  id bigint generated always as identity primary key,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_audit_items (
  id bigint generated always as identity primary key,
  audit_id bigint not null references public.inventory_audits(id) on delete cascade,
  medication_id bigint not null references public.medications(id),
  expected_stock integer not null check (expected_stock >= 0),
  observed_stock integer not null check (observed_stock >= 0),
  difference integer not null,
  created_at timestamptz not null default now(),
  unique(audit_id, medication_id)
);

create index if not exists idx_inventory_audits_created_at
  on public.inventory_audits(created_at desc);
create index if not exists idx_inventory_audit_items_audit
  on public.inventory_audit_items(audit_id);

alter table public.inventory_audits enable row level security;
alter table public.inventory_audit_items enable row level security;

drop policy if exists "inventory_audits_select_auth" on public.inventory_audits;
create policy "inventory_audits_select_auth"
on public.inventory_audits
for select
to authenticated
using (public.is_pharmacist_or_admin());

drop policy if exists "inventory_audit_items_select_auth" on public.inventory_audit_items;
create policy "inventory_audit_items_select_auth"
on public.inventory_audit_items
for select
to authenticated
using (public.is_pharmacist_or_admin());

create or replace function public.create_inventory_audit(
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_audit_id bigint;
  v_item jsonb;
  v_medication_id bigint;
  v_observed integer;
  v_expected integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'farmaceutico' and v_role is distinct from 'admin' then
    raise exception 'No autorizado';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La toma de inventario requiere items';
  end if;

  insert into public.inventory_audits(notes, created_by)
  values (nullif(trim(coalesce(p_notes, '')), ''), v_uid)
  returning id into v_audit_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_medication_id := (v_item ->> 'medication_id')::bigint;
    v_observed := (v_item ->> 'observed_stock')::integer;

    if v_medication_id is null then
      raise exception 'Item con medication_id invalido';
    end if;
    if v_observed is null or v_observed < 0 then
      raise exception 'Cantidad observada invalida';
    end if;

    select stock into v_expected
    from public.medications
    where id = v_medication_id;

    if not found then
      raise exception 'Medicamento no encontrado';
    end if;

    insert into public.inventory_audit_items(
      audit_id, medication_id, expected_stock, observed_stock, difference
    )
    values (
      v_audit_id,
      v_medication_id,
      v_expected,
      v_observed,
      v_observed - v_expected
    );
  end loop;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

revoke all on function public.create_inventory_audit(text, jsonb) from public;
grant execute on function public.create_inventory_audit(text, jsonb) to authenticated;

commit;
