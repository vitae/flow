import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { downloadFile, getVideoDuration } from '../lib/ffmpeg';
import { getVideoUrl } from '../lib/instagram';

const MIN_DURATION = 45;
const MAX_DURATION = 180; // 3 minutes — YouTube Shorts supports up to 3min

async function handlePost(post: CuratedPost) {
  console.log(`[downloader] Downloading ${post.ig_permalink}`);

  const { url, width, height } = await getVideoUrl(post.ig_permalink);
  console.log(`[downloader] Found video: ${width}x${height}`);

  const videoPath = await downloadFile(url, `${post.ig_media_id}.mp4`);
  const duration = await getVideoDuration(videoPath);
  console.log(`[downloader] Downloaded: ${duration.toFixed(1)}s`);

  // Only keep videos between 45-59 seconds for quality Shorts
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    throw new Error(`Duration ${duration.toFixed(1)}s outside ${MIN_DURATION}-${MAX_DURATION}s range, skipping`);
  }

  return { video_path: videoPath, video_duration: duration };
}

export const downloaderAgent = createAgentLoop(
  {
    name: 'downloader',
    inputStatus: 'pending',
    processingStatus: 'processing',
    outputStatus: 'downloaded',
    pollIntervalMs: 10_000,
    batchSize: 3,
  },
  handlePost,
);
