import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { uploadToYouTube } from '../lib/youtube';
import { cleanup } from '../lib/ffmpeg';

async function process(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');
  if (!post.title || !post.description) throw new Error('No metadata set');

  console.log(`[publisher] Uploading "${post.title}"`);
  const hashtagStr = (post.hashtags || []).map(h => `#${h}`).join(' ');
  const fullDescription = `${post.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`;

  const ytVideoId = await uploadToYouTube(
    post.video_path,
    post.title,
    fullDescription,
    post.hashtags || [],
  );

  console.log(`[publisher] Uploaded: https://youtube.com/shorts/${ytVideoId}`);

  // Cleanup temp files
  cleanup(post.video_path);

  return { youtube_video_id: ytVideoId };
}

export const publisherAgent = createAgentLoop(
  {
    name: 'publisher',
    inputStatus: 'metadata_ready',
    processingStatus: 'uploading',
    outputStatus: 'posted',
    pollIntervalMs: 10_000,
    batchSize: 1,
  },
  process
);
