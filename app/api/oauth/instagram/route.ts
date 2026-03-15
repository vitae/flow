import { NextRequest, NextResponse } from 'next/server';

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/instagram/callback`;

const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
].join(',');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = Buffer.from(JSON.stringify({
    token: authHeader.replace('Bearer ', ''),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });

  return NextResponse.json({
    auth_url: `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
  });
}
