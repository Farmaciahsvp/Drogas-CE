begin;

alter table public.medications
  add column if not exists initial_stock integer not null default 0 check (initial_stock >= 0);

-- Backfill existing rows: if initial_stock was default 0, align it with current stock.
update public.medications
set initial_stock = stock
where initial_stock = 0 and stock >= 0;

commit;
