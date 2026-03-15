import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const THREADS_APP_ID = process.env.THREADS_APP_ID!;
const THREADS_APP_SECRET = process.env.THREADS_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/threads/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=no_code`);
  }

  try {
    const state = JSON.parse(Buffer.from(stateRaw, 'base64').toString());
    const supabase = createServerClient();

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(state.token);
    if (authError || !user) throw new Error('Invalid session');

    // Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: THREADS_APP_ID,
        client_secret: THREADS_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    const shortLivedTokens = await tokenRes.json();
    if (shortLivedTokens.error_message) throw new Error(shortLivedTokens.error_message);

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${THREADS_APP_SECRET}&access_token=${shortLivedTokens.access_token}`
    );
    const longLivedTokens = await longLivedRes.json();
    const accessToken = longLivedTokens.access_token || shortLivedTokens.access_token;
    const expiresIn = longLivedTokens.expires_in || 5184000; // default 60 days

    // Get Threads user profile
    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
    );
    const profile = await profileRes.json();

    // Upsert social connection
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      platform: 'threads',
      platform_user_id: profile.id || shortLivedTokens.user_id,
      platform_username: profile.username || null,
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?connected=threads`);
  } catch (err: any) {
    console.error('Threads OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=${encodeURIComponent(err.message)}`
    );
  }
}
