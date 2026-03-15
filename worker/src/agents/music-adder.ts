import { chromium, type Browser, type Page } from 'playwright';
import { getSupabase } from '../shared/supabase';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Search queries targeting the most viral/trending audio on YouTube Shorts
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

function getYouTubeCookies(): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
}> {
  const raw = process.env.YOUTUBE_STUDIO_COOKIES;
  if (!raw) throw new Error('YOUTUBE_STUDIO_COOKIES env var not set');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('YOUTUBE_STUDIO_COOKIES is not valid JSON');
  }
}

async function getUsedTrackNames(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('curated_posts')
    .select('youtube_audio_title')
    .not('youtube_audio_title', 'is', null)
    .neq('youtube_audio_title', 'unknown');
  return new Set((data || []).map((r: any) => r.youtube_audio_title?.toLowerCase()));
}

async function addMusicToShort(videoId: string): Promise<string> {
  const br = await getBrowser();
  const context = await br.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const cookies = getYouTubeCookies();
  await context.addCookies(cookies.map(c => ({
    ...c,
    domain: c.domain || '.youtube.com',
    path: c.path || '/',
  })));

  const page = await context.newPage();
  let addedTrack = 'unknown';

  try {
    // Navigate to YouTube Studio editor for this video
    const editorUrl = `https://studio.youtube.com/video/${videoId}/editor`;
    console.log(`[music_adder] Navigating to ${editorUrl}`);
    await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the editor to load
    await page.waitForTimeout(3000);

    // Check if we're on a login page
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Not authenticated — cookies expired or invalid');
    }

    // Look for the Audio section / "+" button to add audio
    // YouTube Studio editor has an "Audio" row in the timeline with a "+" to add tracks
    const addAudioBtn = await page.locator('button:has-text("Audio"), [aria-label*="audio" i], [aria-label*="Add music" i], #add-audio-button').first();

    if (await addAudioBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addAudioBtn.click();
      console.log('[music_adder] Clicked add audio button');
    } else {
      // Try the "+" icon in the audio track area
      const plusBtn = await page.locator('[icon="add"], .add-button, ytcp-icon-button[icon="add"]').first();
      if (await plusBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await plusBtn.click();
        console.log('[music_adder] Clicked + button');
      } else {
        // Take a screenshot for debugging
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

      // Try to sort by "Most popular" / "Popularity" if a sort option exists
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

    // Get already-used track names to avoid duplicates
    const usedTracks = await getUsedTrackNames();
    console.log(`[music_adder] ${usedTracks.size} tracks already used, will skip duplicates`);

    // Find all "Add" buttons and pick the first track not already used
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

    // Save changes
    const saveBtn = await page.locator('button:has-text("Save"), [aria-label*="Save" i]').first();
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('[music_adder] Saved changes');
      await page.waitForTimeout(3000);

      // Handle confirmation dialog if present
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

export function startMusicAdder() {
  const supabase = getSupabase();

  async function tick(): Promise<number> {
    // Find posted videos that don't have music added yet
    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', 'posted')
      .is('youtube_audio_title', null)
      .not('youtube_video_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!posts?.length) return 0;
    const post = posts[0];

    try {
      console.log(`[music_adder] Adding music to ${post.youtube_video_id} ("${post.title}")`);

      const trackName = await addMusicToShort(post.youtube_video_id);

      await supabase
        .from('curated_posts')
        .update({
          youtube_audio_title: trackName,
          status: 'music_added',
        })
        .eq('id', post.id);

      console.log(`[music_adder] ✓ ${post.id} → music_added`);
      return 1;
    } catch (err: any) {
      console.error(`[music_adder] ✗ ${post.id}:`, err.message);
      // Don't fail the post — just log error and skip, try again later
      await supabase
        .from('curated_posts')
        .update({
          error_message: `music_adder: ${err.message}`,
        })
        .eq('id', post.id);
      return 0;
    }
  }

  console.log(`[music_adder] Agent started — polling every ${POLL_INTERVAL_MS / 60000}min for posted videos without music`);
  tick().catch(err => console.error(`[music_adder] Initial tick error:`, err.message));
  setInterval(async () => {
    try { await tick(); } catch (err: any) {
      console.error(`[music_adder] Tick error:`, err.message);
    }
  }, POLL_INTERVAL_MS);

  return { tick };
}
