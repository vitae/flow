import { NextRequest, NextResponse } from 'next/server';

const THREADS_APP_ID = process.env.THREADS_APP_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/threads/callback`;

const SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_replies',
].join(',');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = Buffer.from(JSON.stringify({
    token: authHeader.replace('Bearer ', ''),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: THREADS_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });

  return NextResponse.json({
    auth_url: `https://threads.net/oauth/authorize?${params}`,
  });
}
