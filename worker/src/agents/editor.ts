import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { trimToShorts, getVideoDuration, ensureVertical, ensureLocalFile, uploadToStorage } from '../lib/ffmpeg';

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // Ensure the video is available locally
  const localPath = await ensureLocalFile(post.video_path);

  // Ensure vertical (9:16) aspect ratio for YouTube Shorts
  console.log(`[editor] Ensuring vertical aspect ratio for ${localPath}`);
  const verticalPath = await ensureVertical(localPath);

  // Trim to ≤3 minutes for Shorts eligibility
  console.log(`[editor] Trimming to ≤180s`);
  const trimmedPath = await trimToShorts(verticalPath, 180);
  const finalDuration = await getVideoDuration(trimmedPath);
  console.log(`[editor] Final: vertical, ${finalDuration.toFixed(1)}s`);

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
