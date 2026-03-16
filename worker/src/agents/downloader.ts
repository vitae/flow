import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { downloadFile, getVideoDuration, uploadToStorage } from '../lib/ffmpeg';
import { getVideoUrl } from '../lib/instagram';

const MIN_DURATION = 10;
const MAX_DURATION = 180; // 3 minutes

async function handlePost(post: CuratedPost) {
  console.log(`[downloader] Downloading ${post.ig_permalink}`);

  const { url, width, height } = await getVideoUrl(post.ig_permalink);
  console.log(`[downloader] Found video: ${width}x${height}`);

  const videoPath = await downloadFile(url, `${post.ig_media_id}.mp4`);
  const duration = await getVideoDuration(videoPath);
  console.log(`[downloader] Downloaded: ${duration.toFixed(1)}s`);

  // Only keep videos between 10s-3min
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    throw new Error(`Duration ${duration.toFixed(1)}s outside ${MIN_DURATION}-${MAX_DURATION}s range, skipping`);
  }

  // Upload to Supabase Storage so the file survives worker restarts
  const storagePath = `uploads/${post.id}.mp4`;
  await uploadToStorage(videoPath, storagePath);
  console.log(`[downloader] Uploaded to storage: ${storagePath}`);

  return { video_path: storagePath, video_duration: duration };
}

export const downloaderAgent = createAgentLoop(
  {
    name: 'downloader',
    inputStatus: 'pending',
    processingStatus: 'downloading',
    outputStatus: 'downloaded',
    pollIntervalMs: 10_000,
    batchSize: 3,
  },
  handlePost,
);
