# Supabase Edge Functions

## create-pharmacist
Funcion para crear usuarios farmaceuticos de forma segura usando `auth.admin.createUser`.

### Requisitos
1. Usuario invocador autenticado y con rol `admin` en `public.profiles`.
2. Secrets configurados en Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deploy
```bash
supabase functions deploy create-pharmacist
```

### Invocacion (cliente)
Se usa desde `client/src/utils/api.js` con:
```js
supabase.functions.invoke('create-pharmacist', { body: { name, username, password } })
```

La funcion construye correo interno:
`<username>@drogasce.local`.
