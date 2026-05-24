import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SB_SUPABASE_SERVICE_ROLE_KEY') ??
      '';

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerData, error: callerError } = await client.auth.getUser();
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: 'Sesion invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: callerProfile, error: roleError } = await client
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .single();

    if (roleError || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Solo admin puede crear farmacéuticos.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { name, username, password } = await req.json();
    if (!name || !username || !password) {
      return new Response(JSON.stringify({ error: 'Campos requeridos incompletos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rawUsername = String(username).trim().toLowerCase();
    const normalizedUsername = rawUsername.includes('@')
      ? rawUsername.split('@')[0]
      : rawUsername;
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return new Response(JSON.stringify({ error: 'Nombre de usuario invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const email = `${normalizedUsername}@drogasce.local`;

    const cleanName = String(name).trim();

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        name: cleanName
      }
    });

    let userId = created.user?.id;
    if (createError) {
      const alreadyExists = createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('registered');
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing?.id) {
        return new Response(JSON.stringify({ error: 'Usuario existente no encontrado para actualizar.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = existing.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No se pudo crear usuario.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        username: normalizedUsername,
        name: cleanName
      }
    });

    await adminClient
      .from('profiles')
      .upsert({ id: userId, role: 'farmaceutico', username: normalizedUsername, name: cleanName }, { onConflict: 'id' });

    return new Response(JSON.stringify({ id: userId, email, role: 'farmaceutico' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
