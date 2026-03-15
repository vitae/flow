import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET() {
  const supabase = createServerClient();

  const [pipelineRes, activityRes, postsRes] = await Promise.all([
    // Pipeline status counts
    supabase.rpc('get_pipeline_counts'),
    // Recent activity (last 50 events)
    supabase
      .from('agent_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    // Recent posts with details
    supabase
      .from('curated_posts')
      .select('id, status, title, ig_like_count, ig_permalink, youtube_video_id, ig_reels_id, fb_reels_id, error_message, failed_at_stage, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Fallback: if RPC doesn't exist, query manually
  let pipeline = pipelineRes.data;
  if (pipelineRes.error) {
    const { data } = await supabase
      .from('curated_posts')
      .select('status');
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.status] = (counts[row.status] || 0) + 1;
    }
    pipeline = counts;
  }

  return NextResponse.json({
    pipeline,
    activity: activityRes.data || [],
    posts: postsRes.data || [],
  });
}
