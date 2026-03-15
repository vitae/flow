import { getSupabase } from '../shared/supabase';
import { discoverViralVideos } from '../lib/instagram';

export async function runScout(): Promise<{ discovered: number; queued: number }> {
  const supabase = getSupabase();

  console.log('[scout] Starting discovery...');
  const videos = await discoverViralVideos();
  if (!videos.length) {
    console.log('[scout] No videos found');
    return { discovered: 0, queued: 0 };
  }

  // Deduplicate against existing posts
  const mediaIds = videos.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = videos.filter(v => !existingIds.has(v.id));

  console.log(`[scout] ${videos.length} discovered, ${newVideos.length} new`);

  const toQueue = newVideos.slice(0, 3);
  if (toQueue.length > 0) {
    const rows = toQueue.map(v => ({
      ig_media_id: v.id,
      ig_username: v.caption?.match(/@(\w+)/)?.[1] || 'unknown',
      ig_permalink: v.permalink,
      ig_like_count: v.like_count || 0,
      status: 'pending',
      hashtags: [],
    }));
    await supabase.from('curated_posts').insert(rows);
    console.log(`[scout] Queued ${rows.length} posts`);
  }

  return { discovered: videos.length, queued: toQueue.length };
}
