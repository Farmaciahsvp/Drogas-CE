-- Phase 4: transactional RPCs for critical operations

begin;

create or replace function public.dispense_prescription(
  p_prescription_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_prescription record;
  v_item record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'farmaceutico' and v_role is distinct from 'admin' then
    raise exception 'No autorizado';
  end if;

  select * into v_prescription
  from public.prescriptions
  where id = p_prescription_id
  for update;

  if not found then
    raise exception 'Receta no encontrada';
  end if;

  if v_prescription.status <> 'pending' then
    raise exception 'La receta no esta pendiente';
  end if;

  for v_item in
    select pi.id, pi.medication_id, pi.quantity_prescribed, m.stock, m.name
    from public.prescription_items pi
    join public.medications m on m.id = pi.medication_id
    where pi.prescription_id = p_prescription_id
    for update of pi, m
  loop
    if v_item.stock < v_item.quantity_prescribed then
      raise exception 'Stock insuficiente para medicamento %', v_item.name;
    end if;
  end loop;

  for v_item in
    select pi.id, pi.medication_id, pi.quantity_prescribed
    from public.prescription_items pi
    where pi.prescription_id = p_prescription_id
    for update
  loop
    update public.medications
    set stock = stock - v_item.quantity_prescribed
    where id = v_item.medication_id;

    update public.prescription_items
    set quantity_dispensed = v_item.quantity_prescribed
    where id = v_item.id;

    insert into public.transactions (
      medication_id, type, quantity, reference_type, reference_id, user_id, notes
    ) values (
      v_item.medication_id,
      'egreso',
      v_item.quantity_prescribed,
      'prescription',
      v_prescription.code,
      v_uid,
      'Despacho de receta ' || v_prescription.code
    );
  end loop;

  update public.prescriptions
  set status = 'dispensed'
  where id = p_prescription_id;

  return jsonb_build_object(
    'ok', true,
    'prescription_id', p_prescription_id,
    'status', 'dispensed'
  );
end;
$$;

create or replace function public.review_replenishment_request(
  p_request_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_request record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'admin' then
    raise exception 'Solo admin puede revisar solicitudes';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select * into v_request
  from public.replenishment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada';
  end if;

  if p_decision = 'approved' then
    update public.medications
    set stock = stock + v_request.quantity
    where id = v_request.medication_id;

    insert into public.transactions (
      medication_id, type, quantity, reference_type, reference_id, user_id, notes
    ) values (
      v_request.medication_id,
      'ingreso',
      v_request.quantity,
      'manual',
      p_request_id::text,
      v_uid,
      'Aprobacion de solicitud de reposicion #' || p_request_id::text
    );
  end if;

  update public.replenishment_requests
  set
    status = p_decision::replenishment_status,
    reviewed_by = v_uid,
    reviewed_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'status', p_decision
  );
end;
$$;

revoke all on function public.dispense_prescription(bigint) from public;
revoke all on function public.review_replenishment_request(bigint, text) from public;
grant execute on function public.dispense_prescription(bigint) to authenticated;
grant execute on function public.review_replenishment_request(bigint, text) to authenticated;

commit;
