import { getSupabase } from '../shared/supabase';
import { getTodaysHashtags, getIGAccessToken, searchHashtag, IGMedia } from '../lib/instagram';

const SCOUT_INTERVAL_MS = 10_000; // 10 seconds between hashtag searches
const MIN_LIKES_FOR_VIRAL = 10_000;
const MIN_LIKES_FALLBACK = 5_000;

let hashtagIndex = 0;

async function scoutOneHashtag(): Promise<{ hashtag: string; queued: number }> {
  const supabase = getSupabase();
  const hashtags = getTodaysHashtags();
  const hashtag = hashtags[hashtagIndex % hashtags.length];
  hashtagIndex++;

  const { token, igUserId } = await getIGAccessToken();
  console.log(`[scout] Searching #${hashtag} (${hashtagIndex}/${hashtags.length})...`);

  const videos = await searchHashtag(hashtag, token, igUserId);
  if (!videos.length) return { hashtag, queued: 0 };

  // Filter for viral videos
  let viral = videos.filter(v => (v.like_count || 0) >= MIN_LIKES_FOR_VIRAL);
  if (!viral.length) {
    viral = videos.filter(v => (v.like_count || 0) >= MIN_LIKES_FALLBACK);
  }
  if (!viral.length) return { hashtag, queued: 0 };

  // Deduplicate against existing posts
  const mediaIds = viral.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = viral.filter(v => !existingIds.has(v.id));

  if (!newVideos.length) {
    console.log(`[scout] #${hashtag}: ${viral.length} viral but all already queued`);
    return { hashtag, queued: 0 };
  }

  // Queue new videos sorted by likes (best first)
  const toQueue = newVideos
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    .slice(0, 5);

  const rows = toQueue.map(v => {
    const mentionMatch = v.caption?.match(/@(\w+)/);
    const username = mentionMatch?.[1] || 'creator';
    return {
      ig_media_id: v.id,
      ig_username: username,
      ig_permalink: v.permalink,
      ig_like_count: v.like_count || 0,
      status: 'pending',
      hashtags: [],
    };
  });

  await supabase.from('curated_posts').insert(rows);
  console.log(`[scout] #${hashtag}: queued ${rows.length} new videos (top: ${toQueue[0].like_count?.toLocaleString()} likes)`);
  return { hashtag, queued: rows.length };
}

// Legacy one-shot function (for /scout endpoint)
export async function runScout(): Promise<{ discovered: number; queued: number }> {
  let totalQueued = 0;
  const hashtags = getTodaysHashtags();
  for (const _h of hashtags) {
    const { queued } = await scoutOneHashtag();
    totalQueued += queued;
  }
  return { discovered: hashtags.length, queued: totalQueued };
}

// Continuous scouting loop — one hashtag every 10s
export function startScout() {
  console.log(`[scout] Continuous scout started — 1 hashtag every ${SCOUT_INTERVAL_MS / 1000}s`);

  async function tick() {
    try {
      await scoutOneHashtag();
    } catch (err: any) {
      console.error(`[scout] Error:`, err.message);
    }
  }

  tick(); // Start immediately
  setInterval(tick, SCOUT_INTERVAL_MS);
}
