# Supabase Setup - Fase 1

## Archivos incluidos
- `migrations/20260523_000001_initial_schema.sql`
- `migrations/20260523_000002_medication_code_format.sql`
- `migrations/20260523_000003_auth_profiles.sql`
- `migrations/20260523_000004_business_rls.sql`
- `migrations/20260523_000005_business_rpcs.sql`
- `seeds/dev_medications_empty.sql`

## Opcion A: SQL Editor (rapido)
1. Abre tu proyecto Supabase.
2. Ve a `SQL Editor`.
3. Ejecuta primero `migrations/20260523_000001_initial_schema.sql`.
4. Ejecuta despues `seeds/dev_medications_empty.sql` para dejar catalogo vacio.

## Opcion B: Supabase CLI
1. Instala y autentica CLI.
2. Enlaza el proyecto:
```bash
supabase link --project-ref <project-ref>
```
3. Ejecuta migraciones:
```bash
supabase db push
```
4. Ejecuta seed manual:
```bash
supabase db query < supabase/seeds/dev_medications_empty.sql
```

## Nota
- Esta fase crea el modelo relacional, constraints e indices.
- El campo `medications.name` queda validado en DB con formato `000-00-0000`.
- El catalogo de medicamentos queda vacio para poblarlo desde la app.
- Fase 2 agrega Auth/profiles: trigger de creacion automatica de perfil y RLS base para `profiles`.
- Fase 3 agrega RLS del resto de tablas de negocio.

## Fase 2 - Auth (resumen)
1. Crear usuarios con Supabase Auth (email/password).
2. En el alta, se crea automaticamente `public.profiles` con rol `farmaceutico`.
3. Para promover admin:
```sql
update public.profiles set role = 'admin' where username = '<usuario>';
```
4. Login/logout en cliente con SDK Supabase:
`signInWithPassword` y `signOut`.

## Fase 3 - RLS negocio (resumen)
- `medications`:
  - `select`: admin y farmaceutico
  - `insert/update`: solo admin
- `prescriptions` y `prescription_items`:
  - `select/insert/update`: admin y farmaceutico
  - `prescriptions.created_by` debe ser `auth.uid()` en inserts
- `transactions`:
  - `select`: admin y farmaceutico
  - `insert`: admin/farmaceutico solo para `user_id = auth.uid()`
- `replenishment_requests`:
  - `select`: admin y farmaceutico
  - `insert`: admin/farmaceutico solo para `user_id = auth.uid()`
  - `update`: solo admin

## Fase 4 - RPC transaccionales (resumen)
- `public.dispense_prescription(p_prescription_id bigint)`
  - Valida rol (`admin` o `farmaceutico`)
  - Valida estado `pending`
  - Valida stock de todos los items
  - Descuenta stock, marca items como dispensados, registra transacciones y cambia receta a `dispensed`

- `public.review_replenishment_request(p_request_id bigint, p_decision text)`
  - Solo `admin`
  - `p_decision`: `approved` o `rejected`
  - Si `approved`: incrementa stock y registra transaccion
  - Actualiza estado y auditoria (`reviewed_by`, `reviewed_at`)

Ejemplo Supabase JS:
```js
await supabase.rpc('dispense_prescription', { p_prescription_id: 123 });
await supabase.rpc('review_replenishment_request', { p_request_id: 99, p_decision: 'approved' });
```
