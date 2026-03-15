import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/facebook/callback`;

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
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error.message || tokens.error);

    // Exchange for long-lived token
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${tokens.access_token}`
    );
    const longLivedTokens = await longLivedRes.json();
    const accessToken = longLivedTokens.access_token || tokens.access_token;

    // Get Facebook Pages the user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0]; // Use first page

    if (!page) throw new Error('No Facebook Page found. You need a Facebook Page to post videos.');

    // Get user profile
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
    );
    const profile = await profileRes.json();

    // Upsert social connection (use Page token for posting)
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      platform: 'facebook',
      platform_user_id: profile.id,
      platform_username: profile.name || null,
      access_token: page.access_token, // Page-scoped token for posting
      refresh_token: null,
      token_expires_at: null, // Long-lived page tokens don't expire
      page_id: page.id,
      page_name: page.name,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?connected=facebook`);
  } catch (err: any) {
    console.error('Facebook OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=${encodeURIComponent(err.message)}`
    );
  }
}
