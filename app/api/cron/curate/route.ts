import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { discoverViralVideos } from '@/lib/instagram/hashtag-search';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 1. Discover viral videos
  let videos;
  try {
    videos = await discoverViralVideos();
  } catch (err: any) {
    console.error('Discovery failed:', err.message);
    return NextResponse.json({ error: 'Discovery failed', detail: err.message }, { status: 500 });
  }
  if (videos.length === 0) {
    return NextResponse.json({ message: 'No new videos found' });
  }

  // 2. Filter out already-curated videos
  const mediaIds = videos.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = videos.filter(v => !existingIds.has(v.id));

  // 3. Take top 3 new videos
  const toProcess = newVideos.slice(0, 3);

  // 4. Insert into curated_posts
  const rows = toProcess.map(v => ({
    ig_media_id: v.id,
    ig_username: v.permalink.split('/')[3] || 'unknown',
    ig_permalink: v.permalink,
    ig_like_count: v.like_count || 0,
    ig_media_url: null,
    status: 'pending' as const,
    hashtags: [],
  }));

  if (rows.length > 0) {
    await supabase.from('curated_posts').insert(rows);
  }

  // 5. Trigger Railway worker for processing
  const railwayWebhookUrl = process.env.RAILWAY_WORKER_URL;
  if (railwayWebhookUrl && rows.length > 0) {
    await fetch(`${railwayWebhookUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
      body: JSON.stringify({ count: rows.length }),
    });
  }

  return NextResponse.json({
    discovered: videos.length,
    new: toProcess.length,
    queued: rows.length,
  });
}
