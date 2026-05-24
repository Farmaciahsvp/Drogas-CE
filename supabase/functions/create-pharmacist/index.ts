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

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ??
      Deno.env.get('SB_SUPABASE_URL') ??
      '';
    const anonKey =
      Deno.env.get('SUPABASE_ANON_KEY') ??
      Deno.env.get('SB_SUPABASE_ANON_KEY') ??
      '';
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
    const isEmailLogin = rawUsername.includes('@');
    const normalizedUsername = isEmailLogin
      ? rawUsername.split('@')[0]
      : rawUsername;
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return new Response(JSON.stringify({ error: 'Nombre de usuario invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (String(password).length < 8) {
      return new Response(JSON.stringify({ error: 'La contrasena debe tener al menos 8 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const email = isEmailLogin ? rawUsername : `${normalizedUsername}@drogasce.local`;

    const cleanName = String(name).trim();
    const { data: usernameInUse } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .limit(1);
    if ((usernameInUse || []).length > 0) {
      return new Response(JSON.stringify({ error: 'El nombre de usuario ya existe.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
      const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing?.id) {
        userId = existing.id;
      } else {
        return new Response(JSON.stringify({ error: createError.message || 'No se pudo crear ni localizar usuario existente.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
