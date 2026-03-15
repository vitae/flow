import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { stripAudio } from '../lib/ffmpeg';

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // Strip original audio — user will add trending audio via YouTube Studio after upload
  // This avoids copyright claims from merging third-party audio before upload
  console.log(`[audio_engineer] Stripping audio from ${post.video_path}`);
  const silentPath = await stripAudio(post.video_path);
  console.log(`[audio_engineer] ✓ Silent video ready: ${silentPath}`);

  return {
    video_path: silentPath,
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
