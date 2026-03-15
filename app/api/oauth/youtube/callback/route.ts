import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const YOUTUBE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const YOUTUBE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/youtube/callback`;

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

    // Verify the user (allow "skip" token for CLI-based OAuth)
    let userId: string;
    if (state.token === 'skip') {
      // CLI OAuth flow — use the glowwitdaflow account
      userId = '93ff5bbe-7b43-4f46-9d24-40a55d60bca3';
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser(state.token);
      if (authError || !user) throw new Error('Invalid session');
      userId = user.id;
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get YouTube channel info
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    // Upsert social connection
    await supabase.from('social_connections').upsert({
      user_id: userId,
      platform: 'youtube',
      platform_user_id: channel?.id || 'unknown',
      platform_username: channel?.snippet?.title || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?connected=youtube`);
  } catch (err: any) {
    console.error('YouTube OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connections?error=${encodeURIComponent(err.message)}`
    );
  }
}
