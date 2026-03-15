import { chromium } from 'playwright';
import { google } from 'googleapis';
import { getSupabase } from '../shared/supabase';

// Refresh every 45 minutes (keep cookies fresh before they expire)
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

interface StoredCookies {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  refreshed_at: string;
}

async function getOAuth2Client() {
  const supabase = getSupabase();
  const { data: connection } = await supabase
    .from('social_connections')
    .select('*')
    .eq('platform', 'youtube')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!connection) throw new Error('No YouTube connection found');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
  });

  // Always refresh to get a fresh token
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (credentials.access_token !== connection.access_token) {
    await supabase.from('social_connections').update({
      access_token: credentials.access_token,
      token_expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
    }).eq('id', connection.id);
  }

  return { accessToken: credentials.access_token!, connection };
}

async function refreshCookies(): Promise<StoredCookies> {
  console.log('[cookie-refresher] Starting cookie refresh...');
  const { accessToken } = await getOAuth2Client();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Load static cookies first if available (helps establish initial session)
    const raw = process.env.YOUTUBE_STUDIO_COOKIES;
    if (raw) {
      try {
        const staticCookies = JSON.parse(raw);
        await context.addCookies(staticCookies.map((c: any) => ({
          ...c,
          domain: c.domain || '.youtube.com',
          path: c.path || '/',
        })));
        console.log(`[cookie-refresher] Loaded ${staticCookies.length} static cookies as base`);
      } catch {}
    }

    // Navigate through OAuth flow to establish Google session
    const oauthUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `access_token=${accessToken}` +
      `&response_type=token` +
      `&client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent('https://studio.youtube.com')}` +
      `&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube')}`;

    console.log('[cookie-refresher] Navigating through OAuth flow...');
    await page.goto(oauthUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Check if we landed on YouTube Studio (authenticated)
    const url = page.url();
    if (url.includes('accounts.google.com')) {
      // Try navigating directly to studio
      await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const finalUrl = page.url();
    const authenticated = finalUrl.includes('studio.youtube.com') && !finalUrl.includes('accounts.google.com');
    console.log(`[cookie-refresher] Final URL: ${finalUrl} (authenticated: ${authenticated})`);

    // Extract all cookies from the browser context
    const allCookies = await context.cookies();
    const relevantCookies = allCookies.filter(c =>
      c.domain.includes('youtube.com') ||
      c.domain.includes('google.com') ||
      c.domain.includes('googleapis.com')
    );

    console.log(`[cookie-refresher] Captured ${relevantCookies.length} cookies (${allCookies.length} total)`);

    if (relevantCookies.length === 0) {
      throw new Error('No cookies captured — authentication likely failed');
    }

    const stored: StoredCookies = {
      cookies: relevantCookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      })),
      refreshed_at: new Date().toISOString(),
    };

    // Store cookies in Supabase (using a key-value style in social_connections metadata)
    const supabase = getSupabase();
    await supabase.from('kv_store').upsert({
      key: 'youtube_studio_cookies',
      value: JSON.stringify(stored),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    console.log(`[cookie-refresher] ✓ Stored ${relevantCookies.length} fresh cookies`);
    return stored;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Export for music-adder to use
export async function getStoredCookies(): Promise<StoredCookies | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('kv_store')
    .select('value')
    .eq('key', 'youtube_studio_cookies')
    .single();

  if (!data?.value) return null;
  return JSON.parse(data.value) as StoredCookies;
}

export function startCookieRefresher() {
  console.log(`[cookie-refresher] Agent started — refreshing every ${REFRESH_INTERVAL_MS / 60000}min`);

  async function tick() {
    try {
      const result = await refreshCookies();
      console.log(`[cookie-refresher] ✓ Refresh complete — ${result.cookies.length} cookies stored`);
    } catch (err: any) {
      console.error(`[cookie-refresher] ✗ Error:`, err.message);
    }
  }

  // Refresh immediately on startup, then every 45 minutes
  tick();
  setInterval(tick, REFRESH_INTERVAL_MS);
}
