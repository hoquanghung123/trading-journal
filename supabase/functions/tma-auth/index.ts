import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify Telegram WebApp initData signature (HMAC-SHA256)
async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const checkArr: string[] = [];
    params.sort();
    params.forEach((val, key) => checkArr.push(`${key}=${val}`));
    const checkString = checkArr.join('\n');
    console.log('verifyTelegramInitData checkString:\n', checkString);
    const encoder = new TextEncoder();
    const secretKeyData = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secretKey = await crypto.subtle.sign('HMAC', secretKeyData, encoder.encode(botToken));
    const hmacKey = await crypto.subtle.importKey(
      'raw', secretKey,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(checkString));
    const expectedHash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log(`verifyTelegramInitData: expectedHash=${expectedHash} hash=${hash} botTokenLength=${botToken?.length}`);
    return expectedHash === hash;
  } catch (e) {
    console.error('verifyTelegramInitData error:', e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('tma-auth called');

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(JSON.stringify({ error: 'Missing initData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Verify Telegram signature
    const isValid = await verifyTelegramInitData(initData, BOT_TOKEN);
    if (!isValid) {
      console.error('Invalid initData signature');
      return new Response(JSON.stringify({ error: 'Invalid initData signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Parse Telegram user id
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) {
      return new Response(JSON.stringify({ error: 'No user in initData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const tgUser = JSON.parse(userJson);
    const telegramId = String(tgUser.id);
    console.log('Telegram user ID:', telegramId);

    // 3. Lookup linked user_id (service role bypasses RLS)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: settings, error: dbError } = await admin
      .from('user_settings')
      .select('user_id')
      .eq('telegram_chat_id', telegramId)
      .maybeSingle();

    if (dbError) {
      console.error('DB error:', dbError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!settings?.user_id) {
      console.log('No user found for telegram_chat_id:', telegramId);
      return new Response(JSON.stringify({ error: 'unlinked' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Get user email
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(settings.user_id);
    if (userError || !userData?.user?.email) {
      console.error('getUserById error:', userError);
      return new Response(JSON.stringify({ error: 'User lookup failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const email = userData.user.email;
    console.log('Found user email for telegram_chat_id:', telegramId);

    // 5. Generate a magic link token — Supabase signs it with current keys
    //    Client will exchange this for a real session via verifyOtp()
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { shouldCreateUser: false },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink error:', linkError);
      return new Response(JSON.stringify({ error: 'Failed to generate auth token' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Magic link token generated for user:', settings.user_id);

    return new Response(JSON.stringify({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
      user_id: settings.user_id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('tma-auth error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
