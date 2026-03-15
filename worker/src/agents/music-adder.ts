import { chromium, type Browser } from 'playwright';
import { google } from 'googleapis';
import { getSupabase } from '../shared/supabase';
import { getStoredCookies } from './cookie-refresher';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MUSIC_QUERIES = [
  'most popular', 'trending', 'viral',
  'popular edm', 'top hits', 'trending 2025',
];

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

async function getGoogleAccessToken(): Promise<string> {
  // Use the same OAuth flow as YouTube uploads — tokens auto-refresh
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

  return credentials.access_token!;
}

async function getUsedTrackNames(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('curated_posts')
    .select('youtube_audio_title')
    .not('youtube_audio_title', 'is', null)
    .neq('youtube_audio_title', 'unknown')
    .neq('youtube_audio_title', 'silent');
  return new Set((data || []).map((r: any) => r.youtube_audio_title?.toLowerCase()));
}

async function addMusicToShort(videoId: string): Promise<string> {
  const br = await getBrowser();
  const context = await br.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  // Load cookies from cookie-refresher agent (primary) or static env (fallback)
  const storedCookies = await getStoredCookies();
  if (storedCookies?.cookies?.length) {
    await context.addCookies(storedCookies.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })));
    console.log(`[music_adder] Loaded ${storedCookies.cookies.length} cookies from refresher (refreshed: ${storedCookies.refreshed_at})`);
  } else {
    // Fallback to static cookies from env
    const raw = process.env.YOUTUBE_STUDIO_COOKIES;
    if (raw) {
      try {
        const staticCookies = JSON.parse(raw);
        await context.addCookies(staticCookies.map((c: any) => ({
          ...c,
          domain: c.domain || '.youtube.com',
          path: c.path || '/',
        })));
        console.log(`[music_adder] Loaded ${staticCookies.length} static cookies from env`);
      } catch {}
    }
  }

  // Also try OAuth flow as belt-and-suspenders
  const accessToken = await getGoogleAccessToken();

  const page = await context.newPage();
  let addedTrack = 'unknown';

  try {
    // Try OAuth flow to establish session if cookies aren't enough
    await page.goto(`https://accounts.google.com/o/oauth2/auth?access_token=${accessToken}&response_type=token&client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://studio.youtube.com')}&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube')}`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    }).catch(() => {});
    await page.waitForTimeout(2000);

    // Navigate to the editor
    const editorUrl = `https://studio.youtube.com/video/${videoId}/editor`;
    console.log(`[music_adder] Navigating to ${editorUrl}`);
    await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    if (page.url().includes('accounts.google.com')) {
      throw new Error('Not authenticated — cookies expired, cookie-refresher needs to run');
    }

    // Look for the Audio section / "+" button
    const addAudioBtn = await page.locator('button:has-text("Audio"), [aria-label*="audio" i], [aria-label*="Add music" i], #add-audio-button').first();

    if (await addAudioBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addAudioBtn.click();
      console.log('[music_adder] Clicked add audio button');
    } else {
      const plusBtn = await page.locator('[icon="add"], .add-button, ytcp-icon-button[icon="add"]').first();
      if (await plusBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await plusBtn.click();
        console.log('[music_adder] Clicked + button');
      } else {
        await page.screenshot({ path: `/tmp/flow-curation/music-adder-debug-${videoId}.png` });
        throw new Error('Could not find add audio button in editor');
      }
    }

    await page.waitForTimeout(2000);

    // Search for music
    const query = MUSIC_QUERIES[Math.floor(Math.random() * MUSIC_QUERIES.length)];
    console.log(`[music_adder] Searching for "${query}" music`);

    const searchInput = await page.locator('input[placeholder*="Search" i], input[aria-label*="Search" i], #search-input').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);

      const sortBtn = await page.locator('button:has-text("Sort"), [aria-label*="Sort" i]').first();
      if (await sortBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sortBtn.click();
        await page.waitForTimeout(1000);
        const popOption = await page.locator('text=/popular/i, text=/most used/i, text=/trending/i').first();
        if (await popOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await popOption.click();
          await page.waitForTimeout(2000);
          console.log('[music_adder] Sorted by popularity');
        }
      }
    }

    // Deduplicate — skip tracks already used
    const usedTracks = await getUsedTrackNames();
    console.log(`[music_adder] ${usedTracks.size} tracks already used, will skip duplicates`);

    const addButtons = await page.locator('button:has-text("Add"), [aria-label*="Add" i]').all();
    let found = false;
    for (const btn of addButtons) {
      if (!(await btn.isVisible().catch(() => false))) continue;
      const trackRow = await btn.locator('..').locator('..').textContent().catch(() => '');
      const trackName = trackRow?.trim().substring(0, 100) || '';
      if (usedTracks.has(trackName.toLowerCase())) {
        console.log(`[music_adder] Skipping already-used track: "${trackName}"`);
        continue;
      }
      addedTrack = trackName || query;
      await btn.click();
      console.log(`[music_adder] Added unique trending track: "${addedTrack}"`);
      await page.waitForTimeout(2000);
      found = true;
      break;
    }
    if (!found) {
      throw new Error('No unused tracks found — all results already used');
    }

    // Save
    const saveBtn = await page.locator('button:has-text("Save"), [aria-label*="Save" i]').first();
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('[music_adder] Saved changes');
      await page.waitForTimeout(3000);
      const confirmBtn = await page.locator('button:has-text("Save" i)').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    } else {
      throw new Error('Could not find save button');
    }

    console.log(`[music_adder] ✓ Music added to ${videoId}: "${addedTrack}"`);
  } finally {
    await context.close();
  }

  return addedTrack;
}

// --- Meta Business Suite: Add music to IG/FB Reels ---

function appsecretProof(token: string): string {
  return crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(token).digest('hex');
}

async function getMetaAccessToken(): Promise<{ token: string; proof: string }> {
  const supabase = getSupabase();
  const { data: connection } = await supabase
    .from('social_connections')
    .select('*')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!connection) throw new Error('No Instagram connection found');
  const token = connection.access_token;
  return { token, proof: appsecretProof(token) };
}

async function addMusicToIGReel(igReelsId: string): Promise<string> {
  const br = await getBrowser();
  const { token, proof } = await getMetaAccessToken();
  const context = await br.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  let addedTrack = 'unknown';

  try {
    // Navigate to Meta Business Suite content editor
    console.log(`[music_adder] Opening Meta Business Suite for IG Reel ${igReelsId}`);
    await page.goto('https://business.facebook.com/latest/home', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Navigate to Content > Posts & Reels, find the reel
    await page.goto('https://business.facebook.com/latest/content_management', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Filter to Reels
    const reelsTab = await page.locator('text=/Reels/i, [aria-label*="Reels" i]').first();
    if (await reelsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reelsTab.click();
      await page.waitForTimeout(2000);
    }

    // Click on the reel to edit
    const reelItem = await page.locator(`[data-id="${igReelsId}"], text="${igReelsId}"`).first();
    if (await reelItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reelItem.click();
      await page.waitForTimeout(2000);
    }

    // Look for Edit / Add Music button
    const editBtn = await page.locator('button:has-text("Edit"), [aria-label*="Edit" i]').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(2000);
    }

    // Find music/audio section
    const musicBtn = await page.locator('button:has-text("Music"), button:has-text("Audio"), [aria-label*="Music" i], [aria-label*="Audio" i]').first();
    if (await musicBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await musicBtn.click();
      await page.waitForTimeout(2000);

      // Search for trending music
      const query = MUSIC_QUERIES[Math.floor(Math.random() * MUSIC_QUERIES.length)];
      console.log(`[music_adder] Searching IG music: "${query}"`);
      const searchInput = await page.locator('input[placeholder*="Search" i], input[aria-label*="Search" i]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);
      }

      // Pick first available trending track (skip used ones)
      const usedTracks = await getUsedTrackNames();
      const trackItems = await page.locator('[role="button"]:has-text("Add"), button:has-text("Use")').all();
      for (const item of trackItems) {
        const trackRow = await item.locator('..').locator('..').textContent().catch(() => '');
        const trackName = trackRow?.trim().substring(0, 100) || '';
        if (usedTracks.has(trackName.toLowerCase())) continue;
        addedTrack = trackName || query;
        await item.click();
        console.log(`[music_adder] Added IG track: "${addedTrack}"`);
        await page.waitForTimeout(2000);
        break;
      }

      // Save
      const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Done"), button:has-text("Publish")').first();
      if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
      }
    } else {
      console.log(`[music_adder] No music editor found for IG Reel — Meta Business Suite may not support post-upload music editing`);
      addedTrack = 'not_available';
    }

    console.log(`[music_adder] ✓ IG Reel ${igReelsId} music: "${addedTrack}"`);
  } finally {
    await context.close();
  }
  return addedTrack;
}

async function addMusicToFBReel(fbReelsId: string): Promise<string> {
  const br = await getBrowser();
  const context = await br.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  let addedTrack = 'unknown';

  try {
    console.log(`[music_adder] Opening Meta Business Suite for FB Reel ${fbReelsId}`);
    await page.goto('https://business.facebook.com/latest/content_management', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Filter to Reels on Facebook
    const fbReelsTab = await page.locator('text=/Facebook/i').first();
    if (await fbReelsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fbReelsTab.click();
      await page.waitForTimeout(2000);
    }

    const reelsFilter = await page.locator('text=/Reels/i').first();
    if (await reelsFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reelsFilter.click();
      await page.waitForTimeout(2000);
    }

    // Find and edit the specific reel
    const reelItem = await page.locator(`[data-id="${fbReelsId}"]`).first();
    if (await reelItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reelItem.click();
      await page.waitForTimeout(2000);
    }

    const editBtn = await page.locator('button:has-text("Edit"), [aria-label*="Edit" i]').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(2000);
    }

    // Add music - same flow as IG
    const musicBtn = await page.locator('button:has-text("Music"), button:has-text("Audio"), [aria-label*="Music" i]').first();
    if (await musicBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await musicBtn.click();
      await page.waitForTimeout(2000);

      const query = MUSIC_QUERIES[Math.floor(Math.random() * MUSIC_QUERIES.length)];
      const searchInput = await page.locator('input[placeholder*="Search" i]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);
      }

      const usedTracks = await getUsedTrackNames();
      const trackItems = await page.locator('[role="button"]:has-text("Add"), button:has-text("Use")').all();
      for (const item of trackItems) {
        const trackRow = await item.locator('..').locator('..').textContent().catch(() => '');
        const trackName = trackRow?.trim().substring(0, 100) || '';
        if (usedTracks.has(trackName.toLowerCase())) continue;
        addedTrack = trackName || query;
        await item.click();
        console.log(`[music_adder] Added FB track: "${addedTrack}"`);
        await page.waitForTimeout(2000);
        break;
      }

      const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Done")').first();
      if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
      }
    } else {
      addedTrack = 'not_available';
    }

    console.log(`[music_adder] ✓ FB Reel ${fbReelsId} music: "${addedTrack}"`);
  } finally {
    await context.close();
  }
  return addedTrack;
}

export function startMusicAdder() {
  const supabase = getSupabase();

  async function tick(): Promise<number> {
    // Find posts that need music on ANY platform
    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', 'posted')
      .or('youtube_audio_title.is.null,youtube_audio_title.eq.silent')
      .not('youtube_video_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!posts?.length) {
      // Also check for posts that have YouTube music but need IG/FB music
      const { data: metaPosts } = await supabase
        .from('curated_posts')
        .select('*')
        .eq('status', 'music_added')
        .or('ig_reels_audio.is.null,fb_reels_audio.is.null')
        .order('created_at', { ascending: true })
        .limit(1);

      if (!metaPosts?.length) return 0;

      const post = metaPosts[0];
      let updated: Record<string, string> = {};

      // Add music to IG Reel if needed
      if (!post.ig_reels_audio && post.ig_reels_id) {
        try {
          const igTrack = await addMusicToIGReel(post.ig_reels_id);
          updated.ig_reels_audio = igTrack;
          console.log(`[music_adder] ✓ IG Reel music: "${igTrack}"`);
        } catch (err: any) {
          console.error(`[music_adder] IG music failed:`, err.message);
          updated.ig_reels_audio = 'failed';
        }
      }

      // Add music to FB Reel if needed
      if (!post.fb_reels_audio && post.fb_reels_id) {
        try {
          const fbTrack = await addMusicToFBReel(post.fb_reels_id);
          updated.fb_reels_audio = fbTrack;
          console.log(`[music_adder] ✓ FB Reel music: "${fbTrack}"`);
        } catch (err: any) {
          console.error(`[music_adder] FB music failed:`, err.message);
          updated.fb_reels_audio = 'failed';
        }
      }

      if (Object.keys(updated).length > 0) {
        await supabase
          .from('curated_posts')
          .update(updated)
          .eq('id', post.id);
      }
      return 1;
    }

    const post = posts[0];

    try {
      // Step 1: Add music to YouTube Short
      console.log(`[music_adder] Adding music to YT ${post.youtube_video_id} ("${post.title}")`);
      const trackName = await addMusicToShort(post.youtube_video_id);

      const updates: Record<string, any> = {
        youtube_audio_title: trackName,
        status: 'music_added',
      };

      // Step 2: Add music to IG Reel if available
      if (post.ig_reels_id) {
        try {
          const igTrack = await addMusicToIGReel(post.ig_reels_id);
          updates.ig_reels_audio = igTrack;
        } catch (err: any) {
          console.error(`[music_adder] IG music failed (non-fatal):`, err.message);
          updates.ig_reels_audio = 'failed';
        }
      }

      // Step 3: Add music to FB Reel if available
      if (post.fb_reels_id) {
        try {
          const fbTrack = await addMusicToFBReel(post.fb_reels_id);
          updates.fb_reels_audio = fbTrack;
        } catch (err: any) {
          console.error(`[music_adder] FB music failed (non-fatal):`, err.message);
          updates.fb_reels_audio = 'failed';
        }
      }

      await supabase
        .from('curated_posts')
        .update(updates)
        .eq('id', post.id);

      console.log(`[music_adder] ✓ ${post.id} → music_added (YT: "${trackName}")`);
      return 1;
    } catch (err: any) {
      console.error(`[music_adder] ✗ ${post.id}:`, err.message);
      await supabase
        .from('curated_posts')
        .update({ error_message: `music_adder: ${err.message}` })
        .eq('id', post.id);
      return 0;
    }
  }

  console.log(`[music_adder] Agent started — polling every ${POLL_INTERVAL_MS / 60000}min (YT + IG + FB)`);
  tick().catch(err => console.error(`[music_adder] Initial tick error:`, err.message));
  setInterval(async () => {
    try { await tick(); } catch (err: any) {
      console.error(`[music_adder] Tick error:`, err.message);
    }
  }, POLL_INTERVAL_MS);

  return { tick };
}
