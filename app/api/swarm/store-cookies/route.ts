import { NextResponse } from 'next/server';

// Known Google/YouTube cookie names
const KNOWN_COOKIE_NAMES = [
  '__Secure-1PAPISID', '__Secure-3PAPISID',
  '__Secure-1PSIDTS', '__Secure-3PSIDTS',
  '__Secure-1PSIDCC', '__Secure-3PSIDCC',
  '__Secure-1PSID', '__Secure-3PSID',
  '__Secure-BUCKET', '__Secure-ROLLOUT_TOKEN', '__Secure-YNID',
  'LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'VISITOR_PRIVACY_METADATA',
  'SEARCH_SAMESITE', 'PLAY_ACTIVE_ACCOUNT',
  'APISID', 'HSID', 'NID', 'OTZ', 'PREF', 'SAPISID',
  'SIDCC', 'SID', 'SSID', 'AEC', 'UULE',
  'ST-stywpl',
];

// Sort by length descending so longer names match first
const SORTED_NAMES = [...KNOWN_COOKIE_NAMES].sort((a, b) => b.length - a.length);

interface ParsedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

function parseRawCookies(raw: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];

  // Match domain + expiry patterns to find boundaries between cookies
  // Pattern: .domain.com/pathYYYY-MM-DDTHH:MM:SS.sssZ then size, flags, sameSite, priority
  const domainExpiryPattern = /(\.[a-z.]+\.(?:google|youtube|play\.google)\.com|studio\.youtube\.com|www\.google\.com)\/([\w-]*)(\d{4}-\d{2}-\d{2}T[\d:.]+Z)(\d+)(✓?)(✓?)(None|Lax|Strict|)(https?:\/\/youtube\.com|)(High|Medium|Low)/g;

  const boundaries: { index: number; domain: string; path: string; expires: string; httpOnly: boolean; secure: boolean; sameSite: string; endIndex: number }[] = [];

  let match;
  while ((match = domainExpiryPattern.exec(raw)) !== null) {
    boundaries.push({
      index: match.index,
      domain: match[1],
      path: '/' + (match[2] || ''),
      expires: match[3],
      httpOnly: match[5] === '✓',
      secure: match[6] === '✓',
      sameSite: match[7] || 'Lax',
      endIndex: match.index + match[0].length,
    });
  }

  // For each boundary, extract the name+value from the text before the domain
  let lastEnd = 0;
  for (const b of boundaries) {
    const beforeDomain = raw.substring(lastEnd, b.index);
    lastEnd = b.endIndex;

    if (!beforeDomain) continue;

    // Find which known cookie name this text starts with
    let cookieName: string | null = null;
    let cookieValue = '';

    for (const name of SORTED_NAMES) {
      if (beforeDomain.startsWith(name)) {
        cookieName = name;
        cookieValue = beforeDomain.substring(name.length);
        break;
      }
    }

    if (!cookieName) continue;

    cookies.push({
      name: cookieName,
      value: cookieValue,
      domain: b.domain,
      path: b.path.replace(/\d{4}-.*/, '') || '/',
      expires: Math.floor(new Date(b.expires).getTime() / 1000),
      httpOnly: b.httpOnly,
      secure: b.secure,
      sameSite: (b.sameSite || 'Lax') as 'Strict' | 'Lax' | 'None',
    });
  }

  return cookies;
}

export async function POST(req: Request) {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  try {
    const body = await req.json();
    let cookies: ParsedCookie[];

    if (body.raw) {
      // Parse raw cookie text from browser
      cookies = parseRawCookies(body.raw);
    } else if (body.cookies) {
      // Already structured
      cookies = body.cookies;
    } else {
      return NextResponse.json({ error: 'Send { raw: "..." } or { cookies: [...] }' }, { status: 400 });
    }

    if (!cookies.length) {
      return NextResponse.json({ error: 'No cookies could be parsed' }, { status: 400 });
    }

    // Forward to worker
    const res = await fetch(`${workerUrl}/store-cookies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
      body: JSON.stringify({ cookies }),
    });

    const data = await res.json();
    return NextResponse.json({ ...data, parsed: cookies.length });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed: ${err.message}` }, { status: 500 });
  }
}
