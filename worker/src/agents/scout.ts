import fs from 'fs';
import { getSupabase } from '../shared/supabase';
import { logActivity } from '../shared/activity-log';
import { getTodaysHashtags, getIGAccessToken, searchHashtag, getVideoUrl, IGMedia } from '../lib/instagram';
import { downloadFile, getVideoDuration, stripAudio, ensureVertical, ensureShortsResolution, trimToShorts, uploadToStorage, cleanup } from '../lib/ffmpeg';
import { uploadToYouTube } from '../lib/youtube';

const SCOUT_INTERVAL_MS = 10 * 60 * 1000; // OVERDRIVE: every 10 minutes
const MAX_QUEUE_PER_RUN = 10; // OVERDRIVE: queue up to 10 most viral per run
const MIN_ENGAGEMENT = 10_000;  // Primary: viral (10k+ engagement score)
const MIN_ENGAGEMENT_FALLBACK = 2_000; // Fallback: decent traction (2k+)
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

let lastHeartbeat = 0;

/** Search ALL of today's hashtags, rank by engagement, queue the top viral reels */
async function scoutAllHashtags(): Promise<{ searched: number; queued: number }> {
  const supabase = getSupabase();
  const hashtags = getTodaysHashtags();
  const { token, igUserId } = await getIGAccessToken();

  console.log(`[scout] Sweeping ${hashtags.length} hashtags: ${hashtags.map(h => `#${h}`).join(', ')}`);

  // Search every hashtag and collect all videos
  const allVideos: (IGMedia & { engagementScore: number; sourceHashtag: string })[] = [];

  for (const hashtag of hashtags) {
    try {
      const videos = await searchHashtag(hashtag, token, igUserId);
      console.log(`[scout] #${hashtag}: ${videos.length} videos`);

      for (const v of videos) {
        allVideos.push({
          ...v,
          engagementScore: (v.like_count || 0) + (v.comments_count || 0) * 10,
          sourceHashtag: hashtag,
        });
      }
    } catch (err: any) {
      console.error(`[scout] #${hashtag} failed: ${err.message}`);
    }
  }

  if (!allVideos.length) {
    console.log(`[scout] No videos found across any hashtag`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Deduplicate by media ID (same video can appear in multiple hashtags)
  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];

  // Filter by engagement threshold
  let viral = unique.filter(v => v.engagementScore >= MIN_ENGAGEMENT);
  if (!viral.length) {
    viral = unique.filter(v => v.engagementScore >= MIN_ENGAGEMENT_FALLBACK);
  }
  if (!viral.length) {
    console.log(`[scout] ${unique.length} videos but none hit ${MIN_ENGAGEMENT_FALLBACK.toLocaleString()}+ engagement`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Sort by engagement — most viral first
  viral.sort((a, b) => b.engagementScore - a.engagementScore);

  // Deduplicate against existing posts in DB
  const mediaIds = viral.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map((e: any) => e.ig_media_id));
  const newVideos = viral.filter(v => !existingIds.has(v.id));

  if (!newVideos.length) {
    console.log(`[scout] ${viral.length} viral videos but all already queued`);
    return { searched: hashtags.length, queued: 0 };
  }

  // Queue the top N most viral
  const toQueue = newVideos.slice(0, MAX_QUEUE_PER_RUN);

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

  console.log(`[scout] ✓ Queued ${rows.length} viral reels from ${hashtags.length} hashtags:`);
  toQueue.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.like_count?.toLocaleString()} likes, score ${v.engagementScore.toLocaleString()} (#${v.sourceHashtag}) → ${v.permalink}`);
  });

  await logActivity('scout', 'discovered', {
    hashtags_searched: hashtags.length,
    total_found: unique.length,
    viral_count: viral.length,
    queued: rows.length,
    top_score: toQueue[0].engagementScore,
    top_likes: toQueue[0].like_count,
  });

  return { searched: hashtags.length, queued: rows.length };
}

const MAX_RAW_SIZE_MB = 200;

const ADJECTIVES = ['Insane', 'Epic', 'Incredible', 'Mind-Blowing', 'Unreal', 'Stunning', 'Next-Level', 'Jaw-Dropping', 'Wild', 'Legendary'];
const HOOKS = ['Wait For It', 'Must Watch', 'INSANE', 'Watch Till The End', 'Next Level', 'Pure Fire', 'How Is This Real'];
const EMOJIS = ['🔥', '✨', '😱', '💯', '⚡', '🤯', '👀', '💫'];
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Push a single post through the entire pipeline inline: download → strip audio →
 * vertical crop → scale → trim → generate metadata → upload to YouTube.
 * This is the reel URL pipeline applied to scout-discovered videos.
 */
async function pushThroughPipeline(postId: string, permalink: string): Promise<string | null> {
  const supabase = getSupabase();
  const tempFiles: string[] = [];

  try {
    // Step 1: Download from Instagram
    console.log(`[scout-pipeline] ${postId} downloading ${permalink}`);
    await supabase.from('curated_posts').update({ status: 'downloading' }).eq('id', postId);

    const { url, width, height } = await getVideoUrl(permalink);
    const videoPath = await downloadFile(url, `scout_${postId}.mp4`);
    tempFiles.push(videoPath);

    const duration = await getVideoDuration(videoPath);
    const rawSizeMB = fs.statSync(videoPath).size / 1024 / 1024;
    console.log(`[scout-pipeline] ${postId} downloaded: ${width}x${height}, ${duration.toFixed(1)}s, ${rawSizeMB.toFixed(1)}MB`);

    if (duration < 3 || duration > 300) {
      throw new Error(`Duration ${duration.toFixed(1)}s out of range (3-300s)`);
    }
    if (rawSizeMB > MAX_RAW_SIZE_MB) {
      throw new Error(`File too large (${rawSizeMB.toFixed(1)}MB > ${MAX_RAW_SIZE_MB}MB), would compress poorly`);
    }

    await supabase.from('curated_posts').update({ status: 'downloaded', video_duration: duration }).eq('id', postId);

    // Step 2: Strip audio
    console.log(`[scout-pipeline] ${postId} stripping audio`);
    await supabase.from('curated_posts').update({ status: 'audio_search' }).eq('id', postId);
    const silentPath = await stripAudio(videoPath);
    tempFiles.push(silentPath);
    await supabase.from('curated_posts').update({ status: 'audio_ready' }).eq('id', postId);

    // Step 3: Edit (vertical crop + scale + trim)
    console.log(`[scout-pipeline] ${postId} editing`);
    await supabase.from('curated_posts').update({ status: 'editing' }).eq('id', postId);

    const verticalPath = await ensureVertical(silentPath);
    if (verticalPath !== silentPath) tempFiles.push(verticalPath);

    const scaledPath = await ensureShortsResolution(verticalPath);
    if (scaledPath !== verticalPath) tempFiles.push(scaledPath);

    const trimmedPath = await trimToShorts(scaledPath, 59);
    if (trimmedPath !== scaledPath) tempFiles.push(trimmedPath);

    const finalDuration = await getVideoDuration(trimmedPath);
    const finalStoragePath = `processed/${postId}_final.mp4`;
    await uploadToStorage(trimmedPath, finalStoragePath);
    await supabase.from('curated_posts').update({ status: 'edited', video_path: finalStoragePath, video_duration: finalDuration }).eq('id', postId);
    console.log(`[scout-pipeline] ${postId} edited: ${finalDuration.toFixed(1)}s`);

    // Step 4: Generate metadata
    await supabase.from('curated_posts').update({ status: 'writing' }).eq('id', postId);
    const title = `${pick(EMOJIS)} ${pick(ADJECTIVES)}! ${pick(HOOKS)}`;
    const description = `This might be the most viral video you see today.\n\nOriginal: ${permalink}\n\n#shorts #viral #trending #fyp #mustwatch`;
    const hashtags = ['shorts', 'viral', 'trending', 'fyp', 'mustwatch', 'flowarts', 'dance', 'edm', 'satisfying', 'nextlevel'];
    await supabase.from('curated_posts').update({ status: 'metadata_ready', title, description, hashtags }).eq('id', postId);

    // Step 5: Upload to YouTube
    console.log(`[scout-pipeline] ${postId} uploading to YouTube: "${title}"`);
    await supabase.from('curated_posts').update({ status: 'uploading' }).eq('id', postId);

    const ytTitle = `${title} #Shorts`.slice(0, 100);
    const hashtagStr = hashtags.map(h => `#${h}`).join(' ');
    const fullDesc = `${description}\n\n${hashtagStr}\n\nOriginal: ${permalink}\n🌊 Discover more at gwdf.pro`;

    const ytVideoId = await uploadToYouTube(trimmedPath, ytTitle, fullDesc, hashtags);
    const ytUrl = `https://youtube.com/shorts/${ytVideoId}`;

    await supabase.from('curated_posts').update({
      status: 'posted',
      youtube_video_id: ytVideoId,
      error_message: null,
    }).eq('id', postId);

    console.log(`[scout-pipeline] ✓ ${postId} → ${ytUrl}`);
    await logActivity('scout-pipeline', 'published', { post_id: postId, youtube_url: ytUrl, title });
    return ytUrl;

  } catch (err: any) {
    console.error(`[scout-pipeline] ✗ ${postId}: ${err.message}`);
    await supabase.from('curated_posts').update({
      status: 'failed',
      error_message: err.message,
      failed_at_stage: 'scout-pipeline',
    }).eq('id', postId);
    await logActivity('scout-pipeline', 'error', { post_id: postId, error: err.message });
    return null;
  } finally {
    for (const f of new Set(tempFiles)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

// Legacy one-shot function (for /scout endpoint)
export async function runScout(): Promise<{ discovered: number; queued: number }> {
  const result = await scoutAllHashtags();
  return { discovered: result.searched, queued: result.queued };
}

// Continuous scouting loop — discovers viral reels and pushes them through
// the full pipeline to YouTube immediately (reel URL → YouTube Short)
export function startScout() {
  console.log(`[scout] OVERDRIVE scout started — ALL hashtags every ${SCOUT_INTERVAL_MS / 60000} min, top ${MAX_QUEUE_PER_RUN}/run, inline pipeline to YouTube`);

  async function tick() {
    try {
      const result = await scoutAllHashtags();
      if (result.queued === 0) {
        const now = Date.now();
        if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          lastHeartbeat = now;
          await logActivity('scout', 'heartbeat', { status: 'scanning', searched: result.searched });
        }
        return;
      }

      lastHeartbeat = Date.now();

      // Push newly queued posts through the full pipeline immediately
      const supabase = getSupabase();
      const { data: pending } = await supabase
        .from('curated_posts')
        .select('id, ig_permalink')
        .eq('status', 'pending')
        .order('ig_like_count', { ascending: false })
        .limit(MAX_QUEUE_PER_RUN);

      if (!pending?.length) return;

      console.log(`[scout] Pushing ${pending.length} videos through pipeline to YouTube...`);
      let published = 0;
      for (const post of pending) {
        const ytUrl = await pushThroughPipeline(post.id, post.ig_permalink);
        if (ytUrl) published++;
      }
      console.log(`[scout] Pipeline run complete: ${published}/${pending.length} published`);
      await logActivity('scout', 'pipeline-run', { attempted: pending.length, published });

    } catch (err: any) {
      console.error(`[scout] Error:`, err.message);
    }
  }

  tick(); // Start immediately
  setInterval(tick, SCOUT_INTERVAL_MS);
}
