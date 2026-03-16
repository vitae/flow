import crypto from 'crypto';
import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';

/**
 * Feed Bot — Discovers trending/viral reels from multiple sources and queues
 * them into the curated_posts pipeline. Runs on a timer, deduplicates against
 * existing posts, and feeds the scout pipeline with fresh URLs.
 *
 * Sources:
 *  1. Instagram Graph API — top_media for massive viral hashtags (weekly trending)
 *  2. Instagram Private API — clips/trending endpoint (algorithmically trending)
 *  3. Instagram Private API — clips/search for viral keywords
 *  4. TikTok trending feed (logged for future use)
 */

const FEED_INTERVAL_MS = 30 * 60 * 1000; // Every 30 min
const MAX_QUEUE_PER_RUN = 8;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_LIKES = 5_000; // Minimum likes to consider "trending"

let lastHeartbeat = 0;

// ── Source 1: Instagram Graph API — weekly top reels for viral hashtags ─────

// These are MASSIVE hashtags — Graph API top_media returns the best-performing
// posts from the past week, so we get genuinely trending weekly content.
const GRAPH_API_VIRAL_HASHTAGS = [
  'viral', 'viralreels', 'trending', 'trendingreels',
  'reels', 'reelsviral', 'explore', 'explorepage',
  'fyp', 'foryou', 'foryoupage',
  'satisfying', 'oddlysatisfying',
  'funny', 'funnyvideos', 'comedy',
  'dance', 'talent', 'skills', 'nextlevel',
  'amazing', 'incredible', 'insane',
  'mustwatch', 'watchthis', 'waitforit',
];

// Pick a rotating subset each run to stay within the 30 unique hashtags / 7-day window
const GRAPH_HASHTAGS_PER_RUN = 4;

async function fetchWeeklyTrendingViaGraphAPI(): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];
  const supabase = getSupabase();

  // Get the IG Graph API token from social_connections
  const { data: igConn } = await supabase
    .from('social_connections')
    .select('access_token, platform_user_id')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!igConn?.access_token || !igConn?.platform_user_id) {
    console.log('[feed-bot] No active Instagram Graph API connection, skipping weekly trending');
    return reels;
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.log('[feed-bot] No META_APP_SECRET, skipping Graph API source');
    return reels;
  }

  const token = igConn.access_token;
  const igUserId = igConn.platform_user_id;
  const proof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');

  // Pick a rotating subset of hashtags based on the current hour
  const hourIndex = Math.floor(Date.now() / 3600000) % Math.ceil(GRAPH_API_VIRAL_HASHTAGS.length / GRAPH_HASHTAGS_PER_RUN);
  const start = hourIndex * GRAPH_HASHTAGS_PER_RUN;
  const hashtags = GRAPH_API_VIRAL_HASHTAGS.slice(start, start + GRAPH_HASHTAGS_PER_RUN);

  console.log(`[feed-bot] Graph API: searching ${hashtags.map(h => `#${h}`).join(', ')}`);

  for (const hashtag of hashtags) {
    try {
      // Step 1: Get the hashtag ID
      const searchRes = await fetch(
        `https://graph.facebook.com/v21.0/ig_hashtag_search?q=${encodeURIComponent(hashtag)}&user_id=${igUserId}&access_token=${token}&appsecret_proof=${proof}`
      );
      const searchData = await searchRes.json();
      if (searchData.error || !searchData.data?.[0]?.id) {
        console.log(`[feed-bot] Graph API #${hashtag}: ${searchData.error?.message || 'no results'}`);
        continue;
      }

      const hashtagId = searchData.data[0].id;

      // Step 2: Get top_media (best performing posts from past ~week)
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${hashtagId}/top_media?user_id=${igUserId}&fields=id,media_type,permalink,like_count,comments_count,caption,timestamp&access_token=${token}&appsecret_proof=${proof}`
      );
      const mediaData = await mediaRes.json();
      if (mediaData.error) {
        console.log(`[feed-bot] Graph API #${hashtag} media: ${mediaData.error.message}`);
        continue;
      }

      const videos = (mediaData.data || []).filter((m: any) => m.media_type === 'VIDEO');

      for (const v of videos) {
        const likeCount = v.like_count || 0;
        if (likeCount < MIN_LIKES) continue;

        reels.push({
          source: 'ig_graph_weekly',
          media_id: String(v.id),
          permalink: v.permalink,
          username: v.caption?.match(/@(\w+)/)?.[1] || 'creator',
          like_count: likeCount,
          comment_count: v.comments_count || 0,
          caption: v.caption || '',
        });
      }

      console.log(`[feed-bot] Graph API #${hashtag}: ${videos.length} videos, ${reels.length} with ${MIN_LIKES}+ likes`);
    } catch (err: any) {
      console.error(`[feed-bot] Graph API #${hashtag} failed: ${err.message}`);
    }

    // Small delay between hashtag lookups to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[feed-bot] Graph API weekly: ${reels.length} total trending reels`);
  return reels;
}

// ── Source 2: Instagram Explore top reels via private API ───────────────────

/** Scrape public IG explore/reels pages for trending content */
async function scrapeIGExploreReels(): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];

  // Use the Instagram private API to fetch explore/reels feed
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) {
    console.log('[feed-bot] No INSTAGRAM_SESSION_ID, skipping IG explore');
    return reels;
  }

  try {
    const decodedSessionId = decodeURIComponent(sessionId);
    // Fetch the reels tray (trending reels feed)
    const res = await fetch('https://i.instagram.com/api/v1/clips/trending/', {
      method: 'POST',
      headers: {
        'Cookie': `sessionid=${decodedSessionId}; ds_user_id=${decodedSessionId.split(':')[0]}`,
        'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
        'X-IG-App-ID': '936619743392459',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'paging_token=&include_fixed_destinations=true',
    });

    if (!res.ok) {
      console.log(`[feed-bot] IG trending reels API returned ${res.status}`);
      return reels;
    }

    const data = await res.json();
    const items = data?.items || data?.media || [];

    for (const item of items) {
      const media = item?.media || item;
      if (!media?.pk && !media?.id) continue;
      if (media?.media_type !== 2) continue; // 2 = video

      const likeCount = media.like_count || 0;
      if (likeCount < MIN_LIKES) continue;

      const code = media.code || media.shortcode;
      if (!code) continue;

      reels.push({
        source: 'ig_trending',
        media_id: String(media.pk || media.id),
        permalink: `https://www.instagram.com/reel/${code}/`,
        username: media.user?.username || 'unknown',
        like_count: likeCount,
        comment_count: media.comment_count || 0,
        caption: media.caption?.text || '',
      });
    }

    console.log(`[feed-bot] IG trending: ${reels.length} reels with ${MIN_LIKES}+ likes`);
  } catch (err: any) {
    console.error(`[feed-bot] IG trending scrape failed: ${err.message}`);
  }

  return reels;
}

// ── Source 3: Instagram Reels search for broad viral keywords ───────────────

const VIRAL_SEARCH_QUERIES = [
  'viral reel', 'trending now', 'must watch', 'satisfying video',
  'insane skills', 'next level', 'wait for it', 'flow arts',
  'dance viral', 'mind blowing', 'incredible talent', 'fyp',
];

async function searchIGReelsByKeyword(): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) return reels;

  // Pick 3 random queries per run to stay under rate limits
  const queries = [...VIRAL_SEARCH_QUERIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const decodedSessionId = decodeURIComponent(sessionId);

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://i.instagram.com/api/v1/clips/search/?query_text=${encodeURIComponent(query)}&tab_type=clip`,
        {
          headers: {
            'Cookie': `sessionid=${decodedSessionId}; ds_user_id=${decodedSessionId.split(':')[0]}`,
            'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
            'X-IG-App-ID': '936619743392459',
          },
        }
      );

      if (!res.ok) {
        console.log(`[feed-bot] IG search "${query}" returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const items = data?.items || data?.media || [];

      for (const item of items) {
        const media = item?.media || item;
        if (!media?.pk && !media?.id) continue;

        const likeCount = media.like_count || 0;
        if (likeCount < MIN_LIKES) continue;

        const code = media.code || media.shortcode;
        if (!code) continue;

        reels.push({
          source: 'ig_search',
          media_id: String(media.pk || media.id),
          permalink: `https://www.instagram.com/reel/${code}/`,
          username: media.user?.username || 'unknown',
          like_count: likeCount,
          comment_count: media.comment_count || 0,
          caption: media.caption?.text || '',
        });
      }
    } catch (err: any) {
      console.error(`[feed-bot] IG search "${query}" failed: ${err.message}`);
    }

    // Small delay between searches to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[feed-bot] IG search: ${reels.length} reels from ${queries.length} queries`);
  return reels;
}

// ── Source 4: TikTok trending → find IG cross-posts ────────────────────────

async function scrapeTikTokTrending(): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];

  // TikTok public trending page doesn't require auth — scrape the embed page
  try {
    const res = await fetch('https://www.tiktok.com/api/recommend/item_list/?count=30&aid=1988', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    if (!res.ok) {
      console.log(`[feed-bot] TikTok trending API returned ${res.status}`);
      return reels;
    }

    const data = await res.json();
    const items = data?.itemList || [];

    for (const item of items) {
      const stats = item.stats || {};
      const likeCount = stats.diggCount || 0;
      if (likeCount < 50_000) continue; // TikTok numbers are higher — 50k+ filter

      // Build a TikTok URL we can use to find the content
      const author = item.author?.uniqueId;
      const videoId = item.id;
      if (!author || !videoId) continue;

      reels.push({
        source: 'tiktok_trending',
        media_id: `tiktok_${videoId}`,
        permalink: `https://www.tiktok.com/@${author}/video/${videoId}`,
        username: author,
        like_count: likeCount,
        comment_count: stats.commentCount || 0,
        caption: item.desc || '',
      });
    }

    console.log(`[feed-bot] TikTok trending: ${reels.length} videos with 50k+ likes`);
  } catch (err: any) {
    console.error(`[feed-bot] TikTok trending scrape failed: ${err.message}`);
  }

  return reels;
}

// ── Core: collect from all sources, deduplicate, and queue ─────────────────

interface DiscoveredReel {
  source: string;
  media_id: string;
  permalink: string;
  username: string;
  like_count: number;
  comment_count: number;
  caption: string;
}

async function discoverAndQueue(): Promise<{ sources: Record<string, number>; queued: number }> {
  const supabase = getSupabase();
  const sourceCounts: Record<string, number> = {};

  // Collect from all sources in parallel
  const [igGraphWeekly, igTrending, igSearch, tiktok] = await Promise.all([
    fetchWeeklyTrendingViaGraphAPI(),
    scrapeIGExploreReels(),
    searchIGReelsByKeyword(),
    scrapeTikTokTrending(),
  ]);

  sourceCounts.ig_graph_weekly = igGraphWeekly.length;
  sourceCounts.ig_trending = igTrending.length;
  sourceCounts.ig_search = igSearch.length;
  sourceCounts.tiktok_trending = tiktok.length;

  // Merge all results — Graph API (weekly) first since it's the most reliable source
  const allReels = [...igGraphWeekly, ...igTrending, ...igSearch, ...tiktok];

  if (!allReels.length) {
    console.log('[feed-bot] No reels found across any source');
    return { sources: sourceCounts, queued: 0 };
  }

  // Deduplicate by media_id (same reel from multiple sources)
  const unique = [...new Map(allReels.map(r => [r.media_id, r])).values()];

  // Sort by engagement — most viral first
  unique.sort((a, b) => {
    const scoreA = a.like_count + a.comment_count * 10;
    const scoreB = b.like_count + b.comment_count * 10;
    return scoreB - scoreA;
  });

  console.log(`[feed-bot] Total unique: ${unique.length} reels`);

  // Only queue Instagram reels (TikTok URLs can't go through our IG download pipeline yet)
  const igReels = unique.filter(r => r.source.startsWith('ig_'));
  const tiktokReels = unique.filter(r => r.source === 'tiktok_trending');

  if (tiktokReels.length) {
    console.log(`[feed-bot] Found ${tiktokReels.length} TikTok trending videos (logged for future cross-post detection)`);
    // Log TikTok discoveries for analysis — we can't pipeline these yet but they're
    // useful for understanding what's trending
    await logActivity('feed-bot', 'tiktok_trending', {
      count: tiktokReels.length,
      top: tiktokReels.slice(0, 3).map(r => ({
        url: r.permalink,
        likes: r.like_count,
        user: r.username,
      })),
    });
  }

  if (!igReels.length) {
    console.log('[feed-bot] No IG reels to queue');
    return { sources: sourceCounts, queued: 0 };
  }

  // Deduplicate against existing posts in DB
  const mediaIds = igReels.map(r => r.media_id);

  // Also check by permalink pattern (different media IDs might point to same reel)
  const permalinks = igReels.map(r => r.permalink);

  const { data: existingById } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);

  const { data: existingByUrl } = await supabase
    .from('curated_posts')
    .select('ig_permalink')
    .in('ig_permalink', permalinks);

  const existingMediaIds = new Set((existingById || []).map((e: any) => e.ig_media_id));
  const existingPermalinks = new Set((existingByUrl || []).map((e: any) => e.ig_permalink));

  const newReels = igReels.filter(
    r => !existingMediaIds.has(r.media_id) && !existingPermalinks.has(r.permalink)
  );

  if (!newReels.length) {
    console.log(`[feed-bot] ${igReels.length} IG reels found but all already in pipeline`);
    return { sources: sourceCounts, queued: 0 };
  }

  // Queue the top N
  const toQueue = newReels.slice(0, MAX_QUEUE_PER_RUN);

  const rows = toQueue.map(r => ({
    ig_media_id: r.media_id,
    ig_username: r.username,
    ig_permalink: r.permalink,
    ig_like_count: r.like_count,
    status: 'pending',
    hashtags: [],
  }));

  const { error: insertError } = await supabase.from('curated_posts').insert(rows);
  if (insertError) {
    console.error(`[feed-bot] DB insert failed: ${insertError.message}`);
    return { sources: sourceCounts, queued: 0 };
  }

  console.log(`[feed-bot] Queued ${toQueue.length} new reels:`);
  toQueue.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.like_count.toLocaleString()} likes (${r.source}) @${r.username} → ${r.permalink}`);
  });

  await logActivity('feed-bot', 'discovered', {
    sources: sourceCounts,
    total_unique: unique.length,
    new_count: newReels.length,
    queued: toQueue.length,
    top_likes: toQueue[0]?.like_count,
    top_source: toQueue[0]?.source,
  });

  return { sources: sourceCounts, queued: toQueue.length };
}

// ── Public API ──────────────────────────────────────────────────────────────

/** One-shot run (for /feed-bot endpoint) */
export async function runFeedBot(): Promise<{ sources: Record<string, number>; queued: number }> {
  return discoverAndQueue();
}

/** Continuous feed bot loop */
export function startFeedBot() {
  console.log(`[feed-bot] Started — scanning every ${FEED_INTERVAL_MS / 60000} min, max ${MAX_QUEUE_PER_RUN}/run`);

  async function tick() {
    try {
      const result = await discoverAndQueue();
      if (result.queued === 0) {
        const now = Date.now();
        if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          lastHeartbeat = now;
          await logActivity('feed-bot', 'heartbeat', {
            status: 'scanning',
            sources: result.sources,
          });
        }
      } else {
        lastHeartbeat = Date.now();
      }
    } catch (err: any) {
      console.error(`[feed-bot] Error:`, err.message);
    }
  }

  tick(); // Run immediately
  setInterval(tick, FEED_INTERVAL_MS);
}
