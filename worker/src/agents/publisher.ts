import { CuratedPost } from '../shared/types';
import { uploadToYouTube } from '../lib/youtube';
import { publishToInstagramReels, publishToFacebookReels } from '../lib/meta-reels';
import { cleanup } from '../lib/ffmpeg';
import { getSupabase } from '../shared/supabase';
import { sendPostNotification } from '../lib/email';

const MAX_DAILY_UPLOADS = 24;
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour between uploads

async function getDailyUploadCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await getSupabase()
    .from('curated_posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('updated_at', `${today}T00:00:00Z`);
  return count || 0;
}

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');
  if (!post.title || !post.description) throw new Error('No metadata set');

  console.log(`[publisher] Uploading "${post.title}"`);
  const hashtagStr = (post.hashtags || []).map(h => `#${h}`).join(' ');
  const fullDescription = `${post.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`;

  const ytVideoId = await uploadToYouTube(
    post.video_path,
    post.title,
    fullDescription,
    post.hashtags || [],
  );
  console.log(`[publisher] YouTube: https://youtube.com/shorts/${ytVideoId}`);

  // Cross-post to Instagram Reels
  let igMediaId: string | null = null;
  let igError: string | null = null;
  try {
    const igCaption = `${post.title}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 gwdf.pro`;
    igMediaId = await publishToInstagramReels(post.video_path, igCaption);
    console.log(`[publisher] Instagram Reel posted: ${igMediaId}`);
  } catch (err: any) {
    igError = err.message;
    console.error(`[publisher] IG Reels failed (non-fatal):`, err.message);
  }

  // Cross-post to Facebook Reels
  let fbVideoId: string | null = null;
  let fbError: string | null = null;
  try {
    fbVideoId = await publishToFacebookReels(post.video_path, fullDescription);
    console.log(`[publisher] Facebook Reel posted: ${fbVideoId}`);
  } catch (err: any) {
    fbError = err.message;
    console.error(`[publisher] FB Reels failed (non-fatal):`, err.message);
  }

  // Clean up after all uploads are done
  cleanup(post.video_path);

  return {
    youtube_video_id: ytVideoId,
    ig_reels_id: igMediaId,
    fb_reels_id: fbVideoId,
    _igError: igError,
    _fbError: fbError,
  };
}

// Custom publisher loop with rate limiting
export function startPublisher() {
  const supabase = getSupabase();

  async function tick(): Promise<number> {
    const dailyCount = await getDailyUploadCount();
    if (dailyCount >= MAX_DAILY_UPLOADS) {
      console.log(`[publisher] Daily limit reached (${dailyCount}/${MAX_DAILY_UPLOADS}), sleeping...`);
      return 0;
    }
    console.log(`[publisher] Daily uploads: ${dailyCount}/${MAX_DAILY_UPLOADS}`);

    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', 'metadata_ready')
      .order('ig_like_count', { ascending: false })
      .limit(1);

    if (!posts?.length) return 0;
    const post = posts[0];

    try {
      const { error: claimError } = await supabase
        .from('curated_posts')
        .update({ status: 'uploading' })
        .eq('id', post.id)
        .eq('status', 'metadata_ready');

      if (claimError) {
        console.log(`[publisher] Could not claim ${post.id}, skipping`);
        return 0;
      }

      const updates = await handlePost(post as CuratedPost);
      const { _igError, _fbError, ...dbUpdates } = updates;

      // Build error summary for DB (so we can see IG/FB failures)
      const errors: string[] = [];
      if (_igError) errors.push(`IG: ${_igError}`);
      if (_fbError) errors.push(`FB: ${_fbError}`);

      await supabase
        .from('curated_posts')
        .update({
          ...dbUpdates,
          status: 'posted',
          error_message: errors.length ? errors.join(' | ') : null,
        })
        .eq('id', post.id);

      console.log(`[publisher] ✓ ${post.id} → posted`);

      // Send email notification
      await sendPostNotification({
        title: post.title || 'Untitled',
        igPermalink: post.ig_permalink,
        igLikeCount: post.ig_like_count || 0,
        youtube: { id: updates.youtube_video_id, error: null },
        igReels: { id: updates.ig_reels_id, error: updates._igError || null },
        fbReels: { id: updates.fb_reels_id, error: updates._fbError || null },
        totalPosted: dailyCount + 1,
      });

      return 1;
    } catch (err: any) {
      console.error(`[publisher] ✗ ${post.id}:`, err.message);
      await supabase
        .from('curated_posts')
        .update({
          status: 'failed',
          error_message: err.message,
          failed_at_stage: 'publisher',
        })
        .eq('id', post.id);
      return 0;
    }
  }

  console.log(`[publisher] Agent started — ${POLL_INTERVAL_MS / 60000}min intervals, max ${MAX_DAILY_UPLOADS}/day`);
  tick().catch(err => console.error(`[publisher] Initial tick error:`, err.message));
  setInterval(async () => {
    try { await tick(); } catch (err: any) {
      console.error(`[publisher] Tick error:`, err.message);
    }
  }, POLL_INTERVAL_MS);

  return { tick };
}
