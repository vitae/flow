import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { stripAudio, ensureLocalFile, uploadToStorage } from '../lib/ffmpeg';
import { getSupabase } from '../shared/supabase';

async function handlePost(post: CuratedPost) {
  if (!post.video_path) {
    // Re-fetch from DB in case the select didn't include the updated video_path
    console.warn(`[audio_engineer] video_path is null for ${post.id}, re-fetching from DB...`);
    const { data: fresh } = await getSupabase()
      .from('curated_posts')
      .select('video_path')
      .eq('id', post.id)
      .single();

    if (fresh?.video_path) {
      post.video_path = fresh.video_path;
      console.log(`[audio_engineer] Recovered video_path: ${post.video_path}`);
    } else {
      // Try the standard upload path as a fallback
      const fallbackPath = `uploads/${post.id}.mp4`;
      console.warn(`[audio_engineer] DB also returned null, trying fallback: ${fallbackPath}`);
      post.video_path = fallbackPath;
    }
  }

  // Ensure the video is available locally (downloads from Supabase Storage if needed)
  const localPath = await ensureLocalFile(post.video_path!);

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
