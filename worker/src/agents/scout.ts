import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';
import { getTodaysHashtags, getIGAccessToken, searchHashtag, IGMedia } from '../lib/instagram';

const SCOUT_INTERVAL_MS = 30 * 60 * 1000; // Every 30 minutes — search ALL hashtags
const MAX_QUEUE_PER_RUN = 5; // Queue up to 5 most viral per run
const MIN_ENGAGEMENT = 25_000;  // Primary: viral (25k+ engagement score)
const MIN_ENGAGEMENT_FALLBACK = 5_000; // Fallback: decent traction (5k+)
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

let lastHeartbeat = 0;

/** Search ALL of today's hashtags, rank by engagement, queue the top viral reels */
async function scoutAllHashtags(): Promise<{ searched: number; queued: number }> {
  const supabase = getSupabase();
  const hashtags = getTodaysHashtags();
  const { token, igUserId } = await getIGAccessToken();

  console.log(`[scout] Sweeping ${hashtags.length} hashtags: ${hashtags.map(h => `#${h}`).join(', ')}`);

  // Search every hashtag and collect all videos
  const allVideos: (IGMedia & { engagementScore: number; sourceHashtag: string })[] = [];

  for (const hashtag of hashtags) {
    try {
      const videos = await searchHashtag(hashtag, token, igUserId);
      console.log(`[scout] #${hashtag}: ${videos.length} videos`);

      for (const v of videos) {
        allVideos.push({
          ...v,
          engagementScore: (v.like_count || 0) + (v.comments_count || 0) * 10,
          sourceHashtag: hashtag,
        });
      }
    } catch (err: any) {
      console.error(`[scout] #${hashtag} failed: ${err.message}`);
    }
  }

  if (!allVideos.length) {
    console.log(`[scout] No videos found across any hashtag`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Deduplicate by media ID (same video can appear in multiple hashtags)
  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];

  // Filter by engagement threshold
  let viral = unique.filter(v => v.engagementScore >= MIN_ENGAGEMENT);
  if (!viral.length) {
    viral = unique.filter(v => v.engagementScore >= MIN_ENGAGEMENT_FALLBACK);
  }
  if (!viral.length) {
    console.log(`[scout] ${unique.length} videos but none hit ${MIN_ENGAGEMENT_FALLBACK.toLocaleString()}+ engagement`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Sort by engagement — most viral first
  viral.sort((a, b) => b.engagementScore - a.engagementScore);

  // Deduplicate against existing posts in DB
  const mediaIds = viral.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = viral.filter(v => !existingIds.has(v.id));

  if (!newVideos.length) {
    console.log(`[scout] ${viral.length} viral videos but all already queued`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Queue the top N most viral
  const toQueue = newVideos.slice(0, MAX_QUEUE_PER_RUN);

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

  console.log(`[scout] ✓ Queued ${rows.length} viral reels from ${hashtags.length} hashtags:`);
  toQueue.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.like_count?.toLocaleString()} likes, score ${v.engagementScore.toLocaleString()} (#${v.sourceHashtag}) → ${v.permalink}`);
  });

  await logActivity('scout', 'discovered', {
    hashtags_searched: hashtags.length,
    total_found: unique.length,
    viral_count: viral.length,
    queued: rows.length,
    top_score: toQueue[0].engagementScore,
    top_likes: toQueue[0].like_count,
  });

  return { searched: hashtags.length, queued: rows.length };
}

// Legacy one-shot function (for /scout endpoint)
export async function runScout(): Promise<{ discovered: number; queued: number }> {
  const result = await scoutAllHashtags();
  return { discovered: result.searched, queued: result.queued };
}

// Continuous scouting loop — all hashtags every 30 minutes
export function startScout() {
  console.log(`[scout] Continuous scout started — ALL hashtags every ${SCOUT_INTERVAL_MS / 60000} minutes, top ${MAX_QUEUE_PER_RUN} per run`);

  async function tick() {
    try {
      const result = await scoutAllHashtags();
      if (result.queued === 0) {
        const now = Date.now();
        if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          lastHeartbeat = now;
          await logActivity('scout', 'heartbeat', { status: 'scanning', searched: result.searched });
        }
      } else {
        lastHeartbeat = Date.now();
      }
    } catch (err: any) {
      console.error(`[scout] Error:`, err.message);
    }
  }

  tick(); // Start immediately
  setInterval(tick, SCOUT_INTERVAL_MS);
}
