import fs from 'fs';
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { downloadFile, getVideoDuration, uploadToStorage } from '../lib/ffmpeg';
import { getVideoUrl } from '../lib/instagram';

const MIN_DURATION = 3; // YouTube Shorts minimum is 3s
const MAX_DURATION = 300; // Allow up to 5min — editor will trim to 59s for Shorts
const MAX_RAW_SIZE_MB = 200; // Reject raw downloads over 200MB (too large to compress well)
const MAX_UPLOAD_SIZE_MB = 50; // Supabase storage limit

async function handlePost(post: CuratedPost) {
  console.log(`[downloader] Downloading ${post.ig_permalink}`);

  let videoData: { url: string; width: number; height: number };
  try {
    videoData = await getVideoUrl(post.ig_permalink);
  } catch (err: any) {
    // Add the permalink to the error for easier debugging
    throw new Error(`Failed to get video URL from ${post.ig_permalink}: ${err.message}`);
  }
  const { url, width, height } = videoData;
  console.log(`[downloader] Found video: ${width}x${height}`);

  const videoPath = await downloadFile(url, `${post.ig_media_id}.mp4`);
  const duration = await getVideoDuration(videoPath);
  const rawSizeMB = fs.statSync(videoPath).size / 1024 / 1024;
  console.log(`[downloader] Downloaded: ${duration.toFixed(1)}s, ${rawSizeMB.toFixed(1)}MB`);

  // Only keep videos between 3s-5min
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    throw new Error(`Duration ${duration.toFixed(1)}s outside ${MIN_DURATION}-${MAX_DURATION}s range, skipping`);
  }

  // Reject absurdly large files — compressing a 200MB+ file produces bad quality
  if (rawSizeMB > MAX_RAW_SIZE_MB) {
    throw new Error(`File too large (${rawSizeMB.toFixed(1)}MB > ${MAX_RAW_SIZE_MB}MB max), skipping — would compress poorly`);
  }

  if (rawSizeMB > MAX_UPLOAD_SIZE_MB) {
    console.log(`[downloader] File ${rawSizeMB.toFixed(1)}MB exceeds ${MAX_UPLOAD_SIZE_MB}MB Supabase limit, will compress during upload`);
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
