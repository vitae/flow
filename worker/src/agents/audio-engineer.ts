import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { stripAudio, mergeAudioVideo } from '../lib/ffmpeg';
import { downloadYTAudio } from '../lib/youtube';
import { getSupabase } from '../shared/supabase';

async function getUsedAudioIds(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('curated_posts')
    .select('youtube_audio_id')
    .not('youtube_audio_id', 'is', null);
  return new Set((data || []).map((r: any) => r.youtube_audio_id));
}

async function findTrendingAudio(): Promise<{ videoId: string; title: string }> {
  const usedIds = await getUsedAudioIds();
  const queries = [
    'trending shorts music 2025', 'viral tiktok songs',
    'edm dance music', 'bass house music', 'rave festival music',
    'electronic dance music', 'dubstep drops', 'flow arts music',
    'popular shorts background music', 'edm remix popular songs',
    'NCS music no copyright', 'free EDM music for videos',
  ];

  for (let i = 0; i < 3; i++) {
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log(`[audio_engineer] Searching YouTube: "${query}"`);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet', q: query, type: 'video',
        order: 'viewCount', maxResults: '20',
        videoDuration: 'short',
        key: process.env.YOUTUBE_API_KEY!,
      })
    );
    const data = await res.json();
    if (data.error) {
      console.error(`[audio_engineer] YT API error:`, data.error.message);
      continue;
    }
    if (!data.items?.length) {
      console.log(`[audio_engineer] No results for "${query}"`);
      continue;
    }

    const unused = data.items.filter((item: any) => !usedIds.has(item.id.videoId));
    console.log(`[audio_engineer] Found ${unused.length}/${data.items.length} unused songs`);

    const pick = unused[Math.floor(Math.random() * Math.min(unused.length, 5))];
    if (pick) {
      console.log(`[audio_engineer] Selected: "${pick.snippet.title}" (${pick.id.videoId})`);
      return { videoId: pick.id.videoId, title: pick.snippet.title };
    }
  }
  throw new Error('No trending audio found after 3 attempts');
}

async function handlePost(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // 1. Always strip original audio
  console.log(`[audio_engineer] Stripping audio from ${post.video_path}`);
  const silentPath = await stripAudio(post.video_path);

  // 2. Find and overlay trending music
  let finalPath = silentPath;
  let audioId: string | null = null;
  let audioTitle = 'silent';

  try {
    const audio = await findTrendingAudio();
    console.log(`[audio_engineer] Downloading audio: "${audio.title}" (${audio.videoId})`);
    const audioPath = await downloadYTAudio(audio.videoId);
    console.log(`[audio_engineer] Merging audio with video...`);
    finalPath = await mergeAudioVideo(silentPath, audioPath);
    audioId = audio.videoId;
    audioTitle = audio.title;
    console.log(`[audio_engineer] ✓ Audio overlay complete: "${audioTitle}"`);
  } catch (err: any) {
    console.error(`[audio_engineer] ✗ Audio overlay failed, using silent video: ${err.message}`);
  }

  return {
    video_path: finalPath,
    youtube_audio_id: audioId,
    youtube_audio_title: audioTitle,
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
