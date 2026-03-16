import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { stripAudio, ensureLocalFile, uploadToStorage } from '../lib/ffmpeg';

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // Ensure the video is available locally (downloads from Supabase Storage if needed)
  const localPath = await ensureLocalFile(post.video_path);

  // Strip original audio — user will add trending audio via YouTube Studio after upload
  // This avoids copyright claims from merging third-party audio before upload
  console.log(`[audio_engineer] Stripping audio from ${localPath}`);
  const silentPath = await stripAudio(localPath);
  console.log(`[audio_engineer] ✓ Silent video ready: ${silentPath}`);

  // Upload processed video back to Supabase for restart resilience
  const storagePath = `processed/${post.id}_silent.mp4`;
  await uploadToStorage(silentPath, storagePath);

  return {
    video_path: storagePath,
  };
}

export const audioEngineerAgent = createAgentLoop(
  {
    name: 'audio_engineer',
    inputStatus: 'downloaded',
    processingStatus: 'audio_search',
    outputStatus: 'audio_ready',
    pollIntervalMs: 10_000,
    batchSize: 1,
  },
  handlePost,
);
