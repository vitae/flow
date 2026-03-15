import crypto from 'crypto';
import { getSupabase } from '../shared/supabase';

const FLOW_HASHTAGS = [
  'flowarts', 'flowartsfriday', 'hulahoop', 'poi', 'juggling',
  'firedance', 'fans', 'firespinner', 'leviwand', 'staffspinning',
  'hooping', 'ledflow', 'whips', 'buugeng', 'contactjuggling',
];
const HASHTAGS_PER_DAY = 5;

function appsecretProof(token: string): string {
  return crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(token).digest('hex');
}

export function getTodaysHashtags(): string[] {
  const dayIndex = Math.floor(Date.now() / 86400000) % Math.ceil(FLOW_HASHTAGS.length / HASHTAGS_PER_DAY);
  const start = dayIndex * HASHTAGS_PER_DAY;
  return FLOW_HASHTAGS.slice(start, start + HASHTAGS_PER_DAY);
}

export interface IGMedia {
  id: string;
  media_type: string;
  permalink: string;
  like_count: number;
  caption: string;
  timestamp: string;
}

async function getIGAccessToken(): Promise<{ token: string; igUserId: string }> {
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

async function searchHashtag(hashtag: string, token: string, igUserId: string): Promise<IGMedia[]> {
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
  unique.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
  console.log(`[scout] Total unique videos: ${unique.length}`);
  return unique.slice(0, 5);
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
