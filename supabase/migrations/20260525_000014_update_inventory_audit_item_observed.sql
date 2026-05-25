begin;

create or replace function public.update_inventory_audit_item_observed(
  p_item_id bigint,
  p_observed_stock integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_expected integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'farmaceutico' and v_role is distinct from 'admin' then
    raise exception 'No autorizado';
  end if;

  if p_item_id is null or p_item_id <= 0 then
    raise exception 'Item de auditoria invalido';
  end if;

  if p_observed_stock is null or p_observed_stock < 0 then
    raise exception 'Cantidad observada invalida';
  end if;

  select expected_stock into v_expected
  from public.inventory_audit_items
  where id = p_item_id;

  if not found then
    raise exception 'Item de auditoria no encontrado';
  end if;

  update public.inventory_audit_items
  set observed_stock = p_observed_stock,
      difference = p_observed_stock - v_expected
  where id = p_item_id;

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'observed_stock', p_observed_stock,
    'difference', p_observed_stock - v_expected
  );
end;
$$;

revoke all on function public.update_inventory_audit_item_observed(bigint, integer) from public;
grant execute on function public.update_inventory_audit_item_observed(bigint, integer) to authenticated;

commit;
