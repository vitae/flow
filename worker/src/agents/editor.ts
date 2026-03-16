import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { trimToShorts, getVideoDuration, ensureVertical, ensureLocalFile, uploadToStorage, ensureShortsResolution } from '../lib/ffmpeg';

const MIN_DURATION = 3; // YouTube Shorts minimum
const MAX_DURATION = 180; // YouTube Shorts maximum (3 minutes)

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // Ensure the video is available locally
  const localPath = await ensureLocalFile(post.video_path);

  // Validate minimum duration (iOS uploads skip downloader validation)
  const rawDuration = await getVideoDuration(localPath);
  if (rawDuration < MIN_DURATION) {
    throw new Error(`Video too short (${rawDuration.toFixed(1)}s) — YouTube Shorts requires at least ${MIN_DURATION}s`);
  }

  // Ensure vertical (9:16) aspect ratio for YouTube Shorts
  console.log(`[editor] Ensuring vertical aspect ratio for ${localPath}`);
  const verticalPath = await ensureVertical(localPath);

  // Scale to 1080x1920 for optimal YouTube Shorts quality
  console.log(`[editor] Scaling to 1080x1920 for Shorts`);
  const scaledPath = await ensureShortsResolution(verticalPath);

  // Trim to ≤3 minutes for Shorts eligibility
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
    processingStatus: 'processing',
    outputStatus: 'edited',
    pollIntervalMs: 10_000,
    batchSize: 2,
  },
  handlePost,
);
