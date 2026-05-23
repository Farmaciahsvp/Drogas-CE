-- Enforce medication code format: 000-00-0000

begin;

alter table public.medications
  add constraint medications_name_code_format_check
  check (name ~ '^[0-9]{3}-[0-9]{2}-[0-9]{4}$');

commit;
