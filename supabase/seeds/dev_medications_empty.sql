-- Keep medications catalog empty.
-- The app will create medications through the Settings/Inventory forms.

delete from public.transactions;
delete from public.prescription_items;
delete from public.prescriptions;
delete from public.replenishment_requests;
delete from public.medications;
