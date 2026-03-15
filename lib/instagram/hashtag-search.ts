import { createServerClient } from '@/lib/supabase/client';
import crypto from 'crypto';

function appsecretProof(token: string): string {
  const secret = process.env.META_APP_SECRET!;
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

const FLOW_HASHTAGS = [
  'flowarts', 'flowartsfriday', 'hulahoop', 'poi', 'juggling',
  'firedance', 'fans', 'firespinner', 'leviwand', 'staffspinning',
  'hooping', 'ledflow', 'whips', 'buugeng', 'contactjuggling',
];

const HASHTAGS_PER_DAY = 5;

export interface IGMedia {
  id: string;
  media_type: string;
  media_url: string;
  permalink: string;
  like_count: number;
  comments_count: number;
  username: string;
  timestamp: string;
}

export function getTodaysHashtags(): string[] {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % Math.ceil(FLOW_HASHTAGS.length / HASHTAGS_PER_DAY);
  const start = dayIndex * HASHTAGS_PER_DAY;
  return FLOW_HASHTAGS.slice(start, start + HASHTAGS_PER_DAY);
}

async function getIGAccessToken(): Promise<{ token: string; igUserId: string }> {
  const supabase = createServerClient();
  const { data } = await supabase
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
  // 1. Get hashtag ID
  const searchRes = await fetch(
    `https://graph.facebook.com/v21.0/ig_hashtag_search?q=${encodeURIComponent(hashtag)}&user_id=${igUserId}&access_token=${token}&appsecret_proof=${appsecretProof(token)}`
  );
  const searchData = await searchRes.json();
  if (searchData.error) {
    console.error(`IG hashtag search error for #${hashtag}:`, searchData.error);
    return [];
  }
  if (!searchData.data?.[0]?.id) return [];
  const hashtagId = searchData.data[0].id;

  // 2. Get top media for this hashtag
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${hashtagId}/top_media?user_id=${igUserId}&fields=id,media_type,media_url,permalink,like_count,comments_count,username,timestamp&access_token=${token}&appsecret_proof=${appsecretProof(token)}`
  );
  const mediaData = await mediaRes.json();
  return (mediaData.data || []).filter((m: IGMedia) => m.media_type === 'VIDEO');
}

export async function discoverViralVideos(): Promise<IGMedia[]> {
  const { token, igUserId } = await getIGAccessToken();
  const hashtags = getTodaysHashtags();
  const allVideos: IGMedia[] = [];

  for (const hashtag of hashtags) {
    const videos = await searchHashtag(hashtag, token, igUserId);
    allVideos.push(...videos);
  }

  // Deduplicate by media ID, sort by likes descending
  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];
  unique.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

  // Return top 5 most viral
  return unique.slice(0, 5);
}
