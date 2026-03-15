import crypto from 'crypto';
import { getSupabase } from '../shared/supabase';

// Viral content across flow arts, dance, extreme sports, rave culture
const VIRAL_HASHTAGS = [
  // Flow arts core
  'flowarts', 'flowartsfriday', 'hulahoop', 'hulahoops', 'hooping',
  'poi', 'poispinning', 'leviwand', 'staffspinning', 'buugeng',
  'contactjuggling', 'juggling', 'firespinner', 'firedance', 'fireperformance',
  'ledflow', 'gloving', 'whip', 'whipcracking', 'fans',
  // Dance & performance
  'dance', 'dancer', 'dancing', 'choreography', 'shuffle',
  'shuffledance', 'popping', 'breaking', 'hiphop', 'contemporary',
  // Swords & martial arts
  'sword', 'swordsmanship', 'katana', 'martialarts', 'lightsaber',
  // Extreme sports
  'snowboard', 'snowboarding', 'skateboarding', 'surfing', 'parkour',
  'bmx', 'skiing', 'wakeboarding', 'motocross', 'climbing',
  // Rave & music culture
  'dj', 'edm', 'rave', 'plur', 'festival',
  'ravefashion', 'bassmusic', 'dubstep', 'techno', 'housemusic',
  'raver', 'festivalseason', 'raveparty', 'edmfamily', 'totems',
  // Viral amplifiers
  'viral', 'viralreels', 'satisfying', 'oddlysatisfying', 'nextlevel',
  'mindblowing', 'skills', 'talent', 'insane', 'amazing',
];
const HASHTAGS_PER_DAY = 15;

function appsecretProof(token: string): string {
  return crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(token).digest('hex');
}

export function getTodaysHashtags(): string[] {
  const dayIndex = Math.floor(Date.now() / 86400000) % Math.ceil(VIRAL_HASHTAGS.length / HASHTAGS_PER_DAY);
  const start = dayIndex * HASHTAGS_PER_DAY;
  return VIRAL_HASHTAGS.slice(start, start + HASHTAGS_PER_DAY);
}

export interface IGMedia {
  id: string;
  media_type: string;
  permalink: string;
  like_count: number;
  caption: string;
  timestamp: string;
}

export async function getIGAccessToken(): Promise<{ token: string; igUserId: string }> {
  const { data } = await getSupabase()
    .from('social_connections')
    .select('*')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!data) throw new Error('No active Instagram connection found');
  return { token: data.access_token, igUserId: data.platform_user_id };
}

export async function searchHashtag(hashtag: string, token: string, igUserId: string): Promise<IGMedia[]> {
  const proof = appsecretProof(token);

  const searchRes = await fetch(
    `https://graph.facebook.com/v21.0/ig_hashtag_search?q=${encodeURIComponent(hashtag)}&user_id=${igUserId}&access_token=${token}&appsecret_proof=${proof}`
  );
  const searchData = await searchRes.json();
  if (searchData.error || !searchData.data?.[0]?.id) {
    console.log(`[scout] No results for #${hashtag}:`, searchData.error?.message || 'empty');
    return [];
  }

  const hashtagId = searchData.data[0].id;
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${hashtagId}/recent_media?user_id=${igUserId}&fields=id,media_type,permalink,like_count,caption,timestamp&access_token=${token}&appsecret_proof=${proof}`
  );
  const mediaData = await mediaRes.json();
  if (mediaData.error) {
    console.log(`[scout] Media fetch error for #${hashtag}:`, mediaData.error.message);
    return [];
  }
  return (mediaData.data || []).filter((m: IGMedia) => m.media_type === 'VIDEO');
}

const MIN_LIKES_FOR_VIRAL = 10_000; // Viral threshold for niche content (10k+ likes)

export async function discoverViralVideos(): Promise<IGMedia[]> {
  const { token, igUserId } = await getIGAccessToken();
  const hashtags = getTodaysHashtags();
  const allVideos: IGMedia[] = [];

  for (const hashtag of hashtags) {
    console.log(`[scout] Searching #${hashtag}...`);
    const videos = await searchHashtag(hashtag, token, igUserId);
    console.log(`[scout] #${hashtag}: ${videos.length} videos`);
    allVideos.push(...videos);
  }

  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];
  // Only keep truly viral videos (10k+ likes = likely millions of views)
  const viral = unique.filter(v => (v.like_count || 0) >= MIN_LIKES_FOR_VIRAL);
  viral.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
  console.log(`[scout] Total unique: ${unique.length}, viral (${MIN_LIKES_FOR_VIRAL}+ likes): ${viral.length}`);

  // If no 10k+ videos found, lower threshold to 1k+
  if (viral.length === 0) {
    const decent = unique.filter(v => (v.like_count || 0) >= 1_000);
    decent.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    console.log(`[scout] No 50k+ viral, falling back to ${decent.length} with 10k+ likes`);
    return decent.slice(0, 20);
  }

  return viral.slice(0, 20);
}

// --- Private API for video URL extraction ---

export function shortcodeToMediaId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (const ch of shortcode) {
    id = id * BigInt(64) + BigInt(alphabet.indexOf(ch));
  }
  return id.toString();
}

export async function getVideoUrl(permalink: string): Promise<{ url: string; width: number; height: number }> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) throw new Error('INSTAGRAM_SESSION_ID required');

  const shortcode = permalink.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)?.[2];
  if (!shortcode) throw new Error(`Cannot extract shortcode from: ${permalink}`);

  const mediaId = shortcodeToMediaId(shortcode);
  const decodedSessionId = decodeURIComponent(sessionId);
  console.log(`[downloader] IG media: ${shortcode} → ${mediaId}`);

  const res = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
    headers: {
      'Cookie': `sessionid=${decodedSessionId}; ds_user_id=${decodedSessionId.split(':')[0]}`,
      'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
      'X-IG-App-ID': '936619743392459',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[downloader] IG API error:', res.status, body.substring(0, 500));
    throw new Error(`IG API returned ${res.status}. Session may have expired.`);
  }

  const data = await res.json();
  const item = data?.items?.[0];
  if (!item?.video_versions?.length) throw new Error('No video versions found — not a video');

  const best = item.video_versions.sort((a: any, b: any) =>
    (b.width * b.height) - (a.width * a.height)
  )[0];

  return { url: best.url, width: best.width, height: best.height };
}
