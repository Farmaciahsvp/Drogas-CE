begin;

create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'farmaceutico' and v_role is distinct from 'admin' then
    raise exception 'No autorizado';
  end if;

  with meds as (
    select id, name, active_principle, category, stock, min_stock, unit
    from public.medications
  ),
  category_distribution as (
    select category, count(*)::int as count, coalesce(sum(stock), 0)::int as stock
    from meds
    group by category
  ),
  critical_meds as (
    select id, name, active_principle, stock, min_stock, unit
    from meds
    where stock <= min_stock
    order by stock asc
    limit 5
  )
  select jsonb_build_object(
    'totalMedications', (select count(*)::int from meds),
    'totalStock', (select coalesce(sum(stock), 0)::int from meds),
    'totalAmpollas', (select coalesce(sum(stock), 0)::int from meds where lower(coalesce(unit, '')) = 'ampollas'),
    'totalTabletas', (select coalesce(sum(stock), 0)::int from meds where lower(coalesce(unit, '')) = 'tabletas'),
    'lowStockAlerts', (select count(*)::int from meds where stock <= min_stock),
    'pendingPrescriptions', (select count(*)::int from public.prescriptions where status = 'pending'),
    'categoryDistribution', coalesce((select jsonb_agg(row_to_json(cd)) from category_distribution cd), '[]'::jsonb),
    'criticalMeds', coalesce((select jsonb_agg(row_to_json(cm)) from critical_meds cm), '[]'::jsonb)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_dashboard_stats() from public;
grant execute on function public.get_dashboard_stats() to authenticated;

commit;
