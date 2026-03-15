import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/twitter/callback`;

const SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
].join(' ');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // PKCE challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const state = Buffer.from(JSON.stringify({
    token: authHeader.replace('Bearer ', ''),
    code_verifier: codeVerifier,
  })).toString('base64');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return NextResponse.json({
    auth_url: `https://twitter.com/i/oauth2/authorize?${params}`,
  });
}
