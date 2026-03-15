import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/twitter/callback`;

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

    // Exchange code for token (with PKCE verifier)
    const basicAuth = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: state.code_verifier,
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get Twitter user profile
    const profileRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profileData = await profileRes.json();
    const profile = profileData.data;

    // Upsert social connection
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      platform: 'twitter',
      platform_user_id: profile?.id || 'unknown',
      platform_username: profile?.username || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?connected=twitter`);
  } catch (err: any) {
    console.error('Twitter OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=${encodeURIComponent(err.message)}`
    );
  }
}
