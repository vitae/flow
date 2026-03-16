import { CuratedPost } from '../shared/types';
import { uploadToYouTube } from '../lib/youtube';
import { publishToInstagramReels, publishToFacebookReels } from '../lib/meta-reels';
import { cleanup, ensureLocalFile } from '../lib/ffmpeg';
import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';
import { sendPostNotification } from '../lib/email';

const MAX_DAILY_UPLOADS = 8;
const POLL_INTERVAL_MS = 60 * 1000; // Check every 60s, publish immediately when ready (8/day cap)
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // Heartbeat every 4 min
const MAX_PUBLISH_RETRIES = 2; // Retry YouTube upload up to 2 times before failing

async function getDailyUploadCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  try {
    // Try updated_at first (set by trigger after migration)
    const { count } = await getSupabase()
      .from('curated_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('updated_at', `${today}T00:00:00Z`);
    return count || 0;
  } catch {
    // Fallback: count all posted today by created_at (less accurate but unblocks publishing)
    const { count } = await getSupabase()
      .from('curated_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('created_at', `${today}T00:00:00Z`);
    return count || 0;
  }
}

/** Check if an error is transient and worth retrying */
function isTransientError(err: any): boolean {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  );
}

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');
  if (!post.title || !post.description) throw new Error('No metadata set');

  // Ensure the video file is available locally (handles worker restarts)
  const localVideoPath = await ensureLocalFile(post.video_path);
  console.log(`[publisher] Uploading "${post.title}"`);

  // Append #Shorts to title for reliable YouTube Shorts classification
  const ytTitle = post.title.includes('#Shorts')
    ? post.title
    : `${post.title} #Shorts`.slice(0, 100);

  const hashtagStr = (post.hashtags || []).map(h => `#${h}`).join(' ');
  const fullDescription = `${post.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`;

  // YouTube upload with retry for transient failures
  let ytVideoId: string | undefined;
  let lastYtError: any;
  for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES + 1; attempt++) {
    try {
      ytVideoId = await uploadToYouTube(
        localVideoPath,
        ytTitle,
        fullDescription,
        post.hashtags || [],
      );
      console.log(`[publisher] YouTube: https://youtube.com/shorts/${ytVideoId}`);
      break;
    } catch (err: any) {
      lastYtError = err;
      console.error(`[publisher] YouTube upload attempt ${attempt}/${MAX_PUBLISH_RETRIES + 1} failed:`, err.message);
      if (attempt <= MAX_PUBLISH_RETRIES && isTransientError(err)) {
        const delay = attempt * 5000; // 5s, 10s
        console.log(`[publisher] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (!ytVideoId) {
    throw new Error(`YouTube upload failed after ${MAX_PUBLISH_RETRIES + 1} attempts: ${lastYtError?.message}`);
  }

  // Cross-post to Instagram Reels
  let igMediaId: string | null = null;
  let igError: string | null = null;
  try {
    const igCaption = `${post.title}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 gwdf.pro`;
    igMediaId = await publishToInstagramReels(localVideoPath, igCaption);
    console.log(`[publisher] Instagram Reel posted: ${igMediaId}`);
  } catch (err: any) {
    igError = err.message;
    console.error(`[publisher] IG Reels failed (non-fatal):`, err.message);
  }

  // Cross-post to Facebook Reels
  let fbVideoId: string | null = null;
  let fbError: string | null = null;
  try {
    fbVideoId = await publishToFacebookReels(localVideoPath, fullDescription);
    console.log(`[publisher] Facebook Reel posted: ${fbVideoId}`);
  } catch (err: any) {
    fbError = err.message;
    console.error(`[publisher] FB Reels failed (non-fatal):`, err.message);
  }

  // Clean up after all uploads are done
  cleanup(localVideoPath);

  // Log cross-post results (columns may not exist in DB yet)
  if (igMediaId) console.log(`[publisher] IG Reels ID: ${igMediaId}`);
  if (fbVideoId) console.log(`[publisher] FB Reels ID: ${fbVideoId}`);

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
  let lastHeartbeat = 0;

  async function tick(): Promise<number> {
    const dailyCount = await getDailyUploadCount();
    if (dailyCount >= MAX_DAILY_UPLOADS) {
      console.log(`[publisher] Daily limit reached (${dailyCount}/${MAX_DAILY_UPLOADS}), sleeping...`);
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = now;
        await logActivity('publisher', 'heartbeat', { status: 'rate_limited', daily: `${dailyCount}/${MAX_DAILY_UPLOADS}` });
      }
      return 0;
    }
    console.log(`[publisher] Daily uploads: ${dailyCount}/${MAX_DAILY_UPLOADS}`);

    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', 'metadata_ready')
      .order('ig_like_count', { ascending: false })
      .limit(1);

    if (!posts?.length) {
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = now;
        await logActivity('publisher', 'heartbeat', { status: 'waiting', daily: `${dailyCount}/${MAX_DAILY_UPLOADS}` });
      }
      return 0;
    }
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
      await logActivity('publisher', 'published', {
        post_id: post.id,
        title: post.title,
        youtube_id: updates.youtube_video_id,
        ig_reels_id: updates.ig_reels_id,
        fb_reels_id: updates.fb_reels_id,
        ig_error: updates._igError,
        fb_error: updates._fbError,
      });

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
      await logActivity('publisher', 'error', { post_id: post.id, error: err.message });
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
