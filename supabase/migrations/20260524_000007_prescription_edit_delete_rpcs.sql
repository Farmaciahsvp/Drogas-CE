begin;

create or replace function public.update_prescription_record(
  p_prescription_id bigint,
  p_recipe_number text,
  p_patient_id text,
  p_doctor_name text,
  p_medication_id bigint,
  p_quantity integer,
  p_instructions text default null
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
  v_old_item record;
  v_new_med record;
  v_dispensed_qty integer := 0;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if coalesce(trim(p_recipe_number), '') = '' then
    raise exception 'Numero de receta requerido';
  end if;
  if coalesce(trim(p_patient_id), '') = '' then
    raise exception 'Identificacion requerida';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Cantidad invalida';
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

  select *
  into v_old_item
  from public.prescription_items
  where prescription_id = p_prescription_id
  limit 1
  for update;

  if not found then
    raise exception 'Receta sin detalle';
  end if;

  if v_prescription.status = 'dispensed' then
    update public.medications
    set stock = stock + coalesce(v_old_item.quantity_dispensed, 0)
    where id = v_old_item.medication_id;

    delete from public.transactions
    where reference_type = 'prescription'
      and reference_id = v_prescription.code;
  end if;

  select id, stock, name into v_new_med
  from public.medications
  where id = p_medication_id
  for update;

  if not found then
    raise exception 'Medicamento no encontrado';
  end if;

  if v_prescription.status = 'dispensed' and v_new_med.stock < p_quantity then
    raise exception 'Stock insuficiente para medicamento %', v_new_med.name;
  end if;

  v_dispensed_qty := case when v_prescription.status = 'dispensed' then p_quantity else 0 end;

  update public.prescriptions
  set
    patient_name = 'Receta ' || trim(p_recipe_number),
    patient_id = trim(p_patient_id),
    doctor_name = coalesce(nullif(trim(p_doctor_name), ''), 'No especificado')
  where id = p_prescription_id;

  update public.prescription_items
  set
    medication_id = p_medication_id,
    quantity_prescribed = p_quantity,
    quantity_dispensed = v_dispensed_qty,
    instructions = coalesce(nullif(trim(p_instructions), ''), 'Dispensacion segun receta fisica.')
  where id = v_old_item.id;

  if v_prescription.status = 'dispensed' then
    update public.medications
    set stock = stock - p_quantity
    where id = p_medication_id;

    insert into public.transactions (
      medication_id, type, quantity, reference_type, reference_id, user_id, notes
    ) values (
      p_medication_id,
      'egreso',
      p_quantity,
      'prescription',
      v_prescription.code,
      v_uid,
      'Correccion de receta ' || trim(p_recipe_number)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'prescription_id', p_prescription_id,
    'status', v_prescription.status
  );
end;
$$;

create or replace function public.delete_prescription_record(
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

  if v_prescription.status = 'dispensed' then
    for v_item in
      select id, medication_id, quantity_dispensed
      from public.prescription_items
      where prescription_id = p_prescription_id
      for update
    loop
      update public.medications
      set stock = stock + coalesce(v_item.quantity_dispensed, 0)
      where id = v_item.medication_id;
    end loop;
  end if;

  delete from public.transactions
  where reference_type = 'prescription'
    and reference_id = v_prescription.code;

  delete from public.prescription_items
  where prescription_id = p_prescription_id;

  delete from public.prescriptions
  where id = p_prescription_id;

  return jsonb_build_object(
    'ok', true,
    'deleted_prescription_id', p_prescription_id
  );
end;
$$;

revoke all on function public.update_prescription_record(bigint, text, text, text, bigint, integer, text) from public;
revoke all on function public.delete_prescription_record(bigint) from public;
grant execute on function public.update_prescription_record(bigint, text, text, text, bigint, integer, text) to authenticated;
grant execute on function public.delete_prescription_record(bigint) to authenticated;

commit;
