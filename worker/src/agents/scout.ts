import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';
import { getTodaysHashtags, getIGAccessToken, searchHashtag, IGMedia } from '../lib/instagram';

const SCOUT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours between hashtag searches (4/day = ~8 API calls/day)
const MIN_ENGAGEMENT = 50_000;  // Primary: only truly viral (50k+ engagement score)
const MIN_ENGAGEMENT_FALLBACK = 10_000; // Fallback: still strong (10k+)

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

  // Engagement score = likes + (comments × 10) — comments signal high-view content
  const scored = videos.map(v => ({
    ...v,
    engagementScore: (v.like_count || 0) + (v.comments_count || 0) * 10,
  }));

  // Only keep the most viral — 50k+ engagement, fallback to 10k+
  let viral = scored.filter(v => v.engagementScore >= MIN_ENGAGEMENT);
  if (!viral.length) {
    viral = scored.filter(v => v.engagementScore >= MIN_ENGAGEMENT_FALLBACK);
  }
  if (!viral.length) {
    console.log(`[scout] #${hashtag}: ${scored.length} videos but none hit ${MIN_ENGAGEMENT_FALLBACK.toLocaleString()}+ engagement`);
    return { hashtag, queued: 0 };
  }

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

  // Queue new videos sorted by engagement score (most viral first)
  const toQueue = newVideos
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 3);

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
  console.log(`[scout] #${hashtag}: queued ${rows.length} new videos (top: ${toQueue[0].like_count?.toLocaleString()} likes, ${toQueue[0].comments_count || 0} comments, score: ${toQueue[0].engagementScore.toLocaleString()})`);
  await logActivity('scout', 'discovered', {
    hashtag,
    queued: rows.length,
    top_likes: toQueue[0].like_count,
    top_score: toQueue[0].engagementScore,
  });
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
