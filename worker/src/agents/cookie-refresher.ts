import { chromium } from 'playwright';
import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';

// Refresh every 45 minutes — visiting YouTube Studio keeps Google session cookies alive
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export interface StoredCookies {
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
  authenticated: boolean;
}

// Google session cookie names that indicate a valid authenticated session
const SESSION_COOKIE_NAMES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID'];

async function loadBaseCookies(context: any): Promise<number> {
  // Try stored cookies from DB first (fresher), then fall back to env var
  const stored = await getStoredCookies();
  if (stored?.cookies?.length) {
    await context.addCookies(stored.cookies);
    console.log(`[cookie-refresher] Loaded ${stored.cookies.length} cookies from DB (stored: ${stored.refreshed_at})`);
    return stored.cookies.length;
  }

  const raw = process.env.YOUTUBE_STUDIO_COOKIES;
  if (raw) {
    try {
      const staticCookies: any[] = JSON.parse(raw);
      await context.addCookies(staticCookies.map(c => ({
        ...c,
        domain: c.domain || '.youtube.com',
        path: c.path || '/',
      })));
      console.log(`[cookie-refresher] Loaded ${staticCookies.length} static cookies from env`);
      return staticCookies.length;
    } catch {}
  }

  return 0;
}

async function refreshCookies(): Promise<StoredCookies> {
  console.log('[cookie-refresher] Starting cookie refresh...');

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
    const loadedCount = await loadBaseCookies(context);

    if (loadedCount === 0) {
      throw new Error('No base cookies available — set YOUTUBE_STUDIO_COOKIES env var with exported browser cookies');
    }

    // Navigate directly to YouTube Studio — the stored cookies should authenticate us
    console.log('[cookie-refresher] Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    const authenticated = finalUrl.includes('studio.youtube.com') && !finalUrl.includes('accounts.google.com');
    console.log(`[cookie-refresher] URL: ${finalUrl} (authenticated: ${authenticated})`);

    if (!authenticated) {
      // Take screenshot for debugging
      await page.screenshot({ path: `/tmp/flow-curation/cookie-refresher-auth-fail.png` }).catch(() => {});
      throw new Error(`Not authenticated — landed on ${finalUrl}. Refresh YOUTUBE_STUDIO_COOKIES env var with fresh browser cookies.`);
    }

    // Visit a couple pages to ensure all cookies get refreshed
    await page.goto('https://studio.youtube.com/channel/videos', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Extract all cookies from the browser context
    const allCookies = await context.cookies();
    const relevantCookies = allCookies.filter((c: any) =>
      c.domain.includes('youtube.com') ||
      c.domain.includes('google.com') ||
      c.domain.includes('googleapis.com')
    );

    // Verify we have real session cookies, not just tracking cookies
    const hasSessionCookies = relevantCookies.some((c: any) =>
      SESSION_COOKIE_NAMES.includes(c.name)
    );

    console.log(`[cookie-refresher] Captured ${relevantCookies.length} cookies (session cookies present: ${hasSessionCookies})`);

    if (!hasSessionCookies) {
      throw new Error('Captured cookies but missing session cookies (SID/HSID/etc) — session is not authenticated');
    }

    const stored: StoredCookies = {
      cookies: relevantCookies.map((c: any) => ({
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
      authenticated,
    };

    // Store cookies in Supabase kv_store
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
      await logActivity('cookie_refresher', 'refreshed', { cookies_count: result.cookies.length, authenticated: result.authenticated });
    } catch (err: any) {
      console.error(`[cookie-refresher] ✗ Error:`, err.message);
      await logActivity('cookie_refresher', 'error', { error: err.message });
    }
  }

  tick();
  setInterval(tick, REFRESH_INTERVAL_MS);
}
