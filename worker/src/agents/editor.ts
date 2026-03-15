import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { trimToShorts, getVideoDuration } from '../lib/ffmpeg';

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  console.log(`[editor] Trimming ${post.video_path} to ≤59s`);
  const trimmedPath = await trimToShorts(post.video_path, 59);
  const finalDuration = await getVideoDuration(trimmedPath);
  console.log(`[editor] Final duration: ${finalDuration.toFixed(1)}s`);

  return { video_path: trimmedPath, video_duration: finalDuration };
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
