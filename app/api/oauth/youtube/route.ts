import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/youtube/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = Buffer.from(JSON.stringify({
    token: authHeader.replace('Bearer ', ''),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.json({
    auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
}
