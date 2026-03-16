import { chromium, type Browser, type Page } from 'playwright';
import { getSupabase } from '../shared/supabase';
import { getStoredCookies } from './cookie-refresher';

const POLL_INTERVAL_MS = 30 * 1000;
const MAX_RETRIES = 2; // Retry a failed video once before giving up

const MUSIC_QUERIES = [
  'most popular', 'trending', 'viral',
  'popular edm', 'top hits', 'trending 2026',
  'dance', 'hip hop beats', 'pop',
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

async function loadCookiesIntoContext(context: any): Promise<boolean> {
  // Try DB-stored cookies first (refreshed by cookie-refresher agent)
  const storedCookies = await getStoredCookies();
  if (storedCookies?.cookies?.length && storedCookies.authenticated) {
    await context.addCookies(storedCookies.cookies);
    console.log(`[music_adder] Loaded ${storedCookies.cookies.length} cookies from DB (refreshed: ${storedCookies.refreshed_at})`);
    return true;
  }

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
      return true;
    } catch {}
  }

  return false;
}

async function getUsedTrackNames(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('curated_posts')
    .select('youtube_audio_title')
    .not('youtube_audio_title', 'is', null)
    .neq('youtube_audio_title', 'unknown')
    .neq('youtube_audio_title', 'silent')
    .neq('youtube_audio_title', 'failed');
  return new Set((data || []).map((r: any) => r.youtube_audio_title?.toLowerCase()));
}

/**
 * Waits for any of the given selectors to become visible.
 * Returns the first matching locator, or null if none found.
 */
async function findFirst(page: Page, selectors: string[], timeoutMs = 8000): Promise<any | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
          return loc;
        }
      } catch {}
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function addMusicToShort(videoId: string): Promise<string> {
  const br = await getBrowser();
  const context = await br.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const hasCookies = await loadCookiesIntoContext(context);
  if (!hasCookies) {
    await context.close();
    throw new Error('No cookies available — cookie-refresher needs to run first');
  }

  const page = await context.newPage();
  let addedTrack = 'unknown';

  try {
    // Step 1: Navigate to the video editor
    const editorUrl = `https://studio.youtube.com/video/${videoId}/editor`;
    console.log(`[music_adder] Navigating to ${editorUrl}`);
    await page.goto(editorUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Check authentication
    if (page.url().includes('accounts.google.com')) {
      await page.screenshot({ path: `/tmp/flow-curation/music-adder-auth-fail-${videoId}.png` }).catch(() => {});
      throw new Error('Not authenticated — cookies expired, cookie-refresher needs to run');
    }

    // Step 2: Handle "Get Started" button (shown on first-time editor use)
    const getStarted = await findFirst(page, [
      'button:has-text("Get started")',
      'button:has-text("Get Started")',
      'ytcp-button:has-text("Get started")',
    ], 3000);
    if (getStarted) {
      await getStarted.click();
      console.log('[music_adder] Clicked "Get Started" button');
      await page.waitForTimeout(2000);
    }

    // Step 3: Click the "+" button next to "Audio" to open the audio library
    // YouTube Studio editor has an "Audio" row with a "+" icon button next to it
    const audioAddBtn = await findFirst(page, [
      // The "+" button next to the Audio label in the editor timeline
      'button[aria-label="Add audio"]',
      'button[aria-label="Add Audio"]',
      'ytcp-icon-button[aria-label="Add audio"]',
      'ytcp-icon-button[aria-label="Add Audio"]',
      // Generic "+" near Audio text — YouTube Studio uses various patterns
      '#add-audio-button',
      'button[data-tooltip="Audio"]',
      // The "Audio" row expand/add button in the timeline
      ':is(#audio-header, [class*="audio-header"], [class*="audio-row"]) :is(button, ytcp-icon-button)',
      // Broader: any "+" icon button in the editor panel
      '#editor-container button[aria-label*="Add" i][aria-label*="audio" i]',
    ]);

    if (!audioAddBtn) {
      // Fallback: look for an "Audio" text label and click the nearest button
      const audioLabel = await findFirst(page, [
        'text=Audio',
        'text=AUDIO',
        ':has-text("Audio"):not(:has-text("Audio Library"))',
      ], 3000);

      if (audioLabel) {
        // Try clicking the + button near the Audio label
        const nearbyBtn = page.locator('button, ytcp-icon-button').filter({ has: page.locator('[icon="add"], iron-icon') }).first();
        if (await nearbyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nearbyBtn.click();
          console.log('[music_adder] Clicked + button near Audio label');
        } else {
          // Just click the Audio label itself — sometimes it's the toggle
          await audioLabel.click();
          console.log('[music_adder] Clicked Audio label directly');
        }
      } else {
        await page.screenshot({ path: `/tmp/flow-curation/music-adder-no-audio-btn-${videoId}.png` }).catch(() => {});
        throw new Error('Could not find Audio add button in editor — UI may have changed');
      }
    } else {
      await audioAddBtn.click();
      console.log('[music_adder] Clicked add audio button');
    }

    await page.waitForTimeout(3000);

    // Step 4: Search for trending music in the audio library
    const query = MUSIC_QUERIES[Math.floor(Math.random() * MUSIC_QUERIES.length)];
    console.log(`[music_adder] Searching for "${query}"`);

    const searchInput = await findFirst(page, [
      'input[placeholder*="Search" i]',
      'input[aria-label*="Search" i]',
      '#search-input',
      'ytcp-text-input input',
      'input[type="text"]',
    ]);

    if (searchInput) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
      await page.waitForTimeout(4000);

      // Try to sort by popularity
      const sortBtn = await findFirst(page, [
        'button:has-text("Sort")',
        '[aria-label*="Sort" i]',
        'ytcp-dropdown-trigger:has-text("Sort")',
      ], 3000);
      if (sortBtn) {
        await sortBtn.click();
        await page.waitForTimeout(1000);
        const popOption = await findFirst(page, [
          'text=/Popular/i',
          'text=/Most used/i',
          'text=/Trending/i',
          'ytcp-text-menu-item:has-text("Popular")',
        ], 2000);
        if (popOption) {
          await popOption.click();
          await page.waitForTimeout(2000);
          console.log('[music_adder] Sorted by popularity');
        }
      }
    } else {
      console.log('[music_adder] No search input found — browsing default tracks');
    }

    // Step 5: Find and click "Add" on a track (skip already-used tracks)
    const usedTracks = await getUsedTrackNames();
    console.log(`[music_adder] ${usedTracks.size} tracks already used, will skip duplicates`);

    // Locate all "Add" buttons in the audio library results
    const addButtons = await page.locator(
      'button:has-text("Add"), ' +
      'ytcp-button:has-text("Add"), ' +
      '[aria-label*="Add" i]:is(button, ytcp-button, ytcp-icon-button)'
    ).all();

    let found = false;
    for (const btn of addButtons) {
      if (!(await btn.isVisible().catch(() => false))) continue;

      // Get the track name from the parent row
      const trackRow = await btn.locator('xpath=ancestor::*[contains(@class, "row") or contains(@class, "track") or contains(@class, "item") or self::tr or self::ytcp-ve]')
        .first().textContent().catch(() => null);
      // Fallback: get text from 2 levels up
      const trackText = trackRow || await btn.locator('..').locator('..').textContent().catch(() => '') || '';
      const trackName = trackText.replace(/Add|Play|Preview/gi, '').trim().substring(0, 100);

      if (trackName && usedTracks.has(trackName.toLowerCase())) {
        console.log(`[music_adder] Skipping already-used: "${trackName}"`);
        continue;
      }

      addedTrack = trackName || query;
      await btn.click();
      console.log(`[music_adder] Added track: "${addedTrack}"`);
      await page.waitForTimeout(3000);
      found = true;
      break;
    }

    if (!found) {
      await page.screenshot({ path: `/tmp/flow-curation/music-adder-no-tracks-${videoId}.png` }).catch(() => {});
      throw new Error(`No unused tracks found for query "${query}" — ${addButtons.length} add buttons found, all either used or invisible`);
    }

    // Step 6: Save changes
    const saveBtn = await findFirst(page, [
      'button:has-text("Save")',
      'ytcp-button:has-text("Save")',
      '#save-button',
      '[aria-label="Save"]',
      '[aria-label="Save changes"]',
    ]);

    if (saveBtn) {
      await saveBtn.click();
      console.log('[music_adder] Clicked Save');
      await page.waitForTimeout(3000);

      // Handle confirmation dialog (YouTube sometimes asks "Save changes?")
      const confirmBtn = await findFirst(page, [
        'button:has-text("Save")',
        'ytcp-button:has-text("SAVE")',
        '#confirm-button',
      ], 5000);
      if (confirmBtn) {
        await confirmBtn.click();
        console.log('[music_adder] Confirmed save');
      }
      await page.waitForTimeout(3000);
    } else {
      await page.screenshot({ path: `/tmp/flow-curation/music-adder-no-save-${videoId}.png` }).catch(() => {});
      throw new Error('Could not find Save button');
    }

    console.log(`[music_adder] ✓ Music added to ${videoId}: "${addedTrack}"`);
  } finally {
    await context.close();
  }

  return addedTrack;
}

export function startMusicAdder() {
  const supabase = getSupabase();

  async function tick(): Promise<number> {
    // Find posts that need music added on YouTube
    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', 'posted')
      .or('youtube_audio_title.is.null,youtube_audio_title.eq.silent')
      .not('youtube_video_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!posts?.length) return 0;

    const post = posts[0];

    // Count retries from error_message prefix to avoid needing a new DB column
    const retryCount = (post.error_message?.match(/^music_adder_retry:(\d+)/)?.[1] || 0) as number;
    if (retryCount >= MAX_RETRIES) {
      console.log(`[music_adder] Skipping ${post.id} — failed ${retryCount} times, marking as failed`);
      await supabase
        .from('curated_posts')
        .update({
          youtube_audio_title: 'failed',
          status: 'music_added',
          error_message: `music_adder: gave up after ${retryCount} retries`,
        })
        .eq('id', post.id);
      return 0;
    }

    try {
      console.log(`[music_adder] Adding music to YT ${post.youtube_video_id} ("${post.title}") [attempt ${retryCount + 1}/${MAX_RETRIES + 1}]`);
      const trackName = await addMusicToShort(post.youtube_video_id);

      await supabase
        .from('curated_posts')
        .update({
          youtube_audio_title: trackName,
          status: 'music_added',
          error_message: null,
        })
        .eq('id', post.id);

      console.log(`[music_adder] ✓ ${post.id} → music_added (YT: "${trackName}")`);
      return 1;
    } catch (err: any) {
      console.error(`[music_adder] ✗ ${post.id}:`, err.message);
      await supabase
        .from('curated_posts')
        .update({
          error_message: `music_adder_retry:${Number(retryCount) + 1} ${err.message}`,
        })
        .eq('id', post.id);
      return 0;
    }
  }

  console.log(`[music_adder] Agent started — polling every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_RETRIES + 1} attempts per video`);
  tick().catch(err => console.error(`[music_adder] Initial tick error:`, err.message));
  setInterval(async () => {
    try { await tick(); } catch (err: any) {
      console.error(`[music_adder] Tick error:`, err.message);
    }
  }, POLL_INTERVAL_MS);

  return { tick };
}
