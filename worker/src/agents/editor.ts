import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { trimToShorts, getVideoDuration, ensureVerticalAndScale, ensureLocalFile, uploadToStorage } from '../lib/ffmpeg';
import { getSupabase } from '../shared/supabase';

const MIN_DURATION = 3; // YouTube Shorts minimum
const MAX_DURATION = 59; // YouTube Shorts maximum for API uploads (1s buffer)

async function handlePost(post: CuratedPost) {
  if (!post.video_path) {
    // Re-fetch from DB in case the select didn't include the updated video_path
    console.warn(`[editor] video_path is null for ${post.id}, re-fetching from DB...`);
    const { data: fresh } = await getSupabase()
      .from('curated_posts')
      .select('video_path')
      .eq('id', post.id)
      .single();

    if (fresh?.video_path) {
      post.video_path = fresh.video_path;
      console.log(`[editor] Recovered video_path: ${post.video_path}`);
    } else {
      // Try the standard processed path as a fallback
      const fallbackPath = `processed/${post.id}_silent.mp4`;
      console.warn(`[editor] DB also returned null, trying fallback: ${fallbackPath}`);
      post.video_path = fallbackPath;
    }
  }

  // Ensure the video is available locally
  const localPath = await ensureLocalFile(post.video_path!);

  // Validate minimum duration (iOS uploads skip downloader validation)
  const rawDuration = await getVideoDuration(localPath);
  if (rawDuration < MIN_DURATION) {
    throw new Error(`Video too short (${rawDuration.toFixed(1)}s) — YouTube Shorts requires at least ${MIN_DURATION}s`);
  }

  // Single-pass: crop to vertical + scale to 1080x1920 (reduces memory vs two encodes)
  console.log(`[editor] Processing ${localPath} → vertical 1080x1920`);
  const scaledPath = await ensureVerticalAndScale(localPath);

  // Trim to ≤59s for Shorts eligibility
  console.log(`[editor] Trimming to ≤${MAX_DURATION}s`);
  const trimmedPath = await trimToShorts(scaledPath, MAX_DURATION);
  const finalDuration = await getVideoDuration(trimmedPath);
  console.log(`[editor] Final: vertical 1080x1920, ${finalDuration.toFixed(1)}s`);

  // Upload final video back to Supabase for restart resilience
  const storagePath = `processed/${post.id}_final.mp4`;
  await uploadToStorage(trimmedPath, storagePath);

  return { video_path: storagePath, video_duration: finalDuration };
}

export const editorAgent = createAgentLoop(
  {
    name: 'editor',
    inputStatus: 'audio_ready',
    processingStatus: 'editing',
    outputStatus: 'edited',
    pollIntervalMs: 10_000,
    batchSize: 1,
  },
  handlePost,
);
