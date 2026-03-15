import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/instagram/callback`;

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

    if (!page) throw new Error('No Facebook Page found. Instagram requires a linked Facebook Page.');

    // Get Instagram Business Account linked to the Page
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    const igData = await igRes.json();
    const igAccountId = igData.instagram_business_account?.id;

    if (!igAccountId) throw new Error('No Instagram Business Account linked to your Facebook Page.');

    // Get IG username
    const igProfileRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}?fields=username&access_token=${page.access_token}`
    );
    const igProfile = await igProfileRes.json();

    // Upsert social connection (use the Page token for IG API calls)
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      platform: 'instagram',
      platform_user_id: igAccountId,
      platform_username: igProfile.username || null,
      access_token: page.access_token, // Page token has IG permissions
      refresh_token: null,
      token_expires_at: null, // Long-lived page tokens don't expire
      page_id: igAccountId, // IG Business Account ID
      page_name: page.name,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?connected=instagram`);
  } catch (err: any) {
    console.error('Instagram OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=${encodeURIComponent(err.message)}`
    );
  }
}
