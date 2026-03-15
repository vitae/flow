import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { downloadFile, stripAudio, mergeAudioVideo, cleanup } from './ffmpeg';
import { uploadToYouTube, downloadYTAudio } from './youtube-upload';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUsedAudioIds(): Promise<Set<string>> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('curated_posts')
    .select('youtube_audio_id')
    .not('youtube_audio_id', 'is', null);
  return new Set((data || []).map((r: any) => r.youtube_audio_id));
}

async function findTrendingAudio(): Promise<{ videoId: string; title: string }> {
  const usedIds = await getUsedAudioIds();
  const queries = [
    'trending shorts music 2025',
    'viral tiktok songs',
    'edm dance music',
    'bass house music',
    'rave festival music',
    'electronic dance music',
    'dubstep drops',
    'flow arts music',
    'popular shorts background music',
  ];

  for (let i = 0; i < 3; i++) {
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log('Searching trending audio:', query);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        order: 'viewCount',
        maxResults: '20',
        key: process.env.YOUTUBE_API_KEY!,
      })
    );
    const data = await res.json();
    console.log('YouTube search results:', data.items?.length || 0, 'error:', data.error?.message);

    if (!data.items?.length) continue;

    // Filter out already-used songs
    const unused = data.items.filter((item: any) => !usedIds.has(item.id.videoId));
    console.log('Unused songs:', unused.length, '/', data.items.length);

    const item = unused[Math.floor(Math.random() * Math.min(unused.length, 5))];
    if (item) {
      return { videoId: item.id.videoId, title: item.snippet.title };
    }
  }

  throw new Error('No trending audio found after 3 attempts');
}

async function generateMetadata(igUsername: string, igCaption?: string) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Create YouTube Short metadata for a flow arts video repost.
Creator: @${igUsername} on Instagram
Caption: ${igCaption || 'Flow arts performance'}

Return ONLY JSON: {"title":"<catchy title under 100 chars with emoji>","description":"<2-3 sentences, credit @${igUsername}, mention gwdf.pro>","hashtags":["<5 contextual hashtags from: flowarts,dance,edm,rave,hulahoop,poi,firedance,juggling,hooping,circus,festival,performance,firespinner,led,gloving>"]}`
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
}

export async function processAllPending() {
  const supabase = getSupabase();
  console.log('Processing pending posts...');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING');

  const { data: pending, error: queryError } = await supabase
    .from('curated_posts')
    .select('*')
    .eq('status', 'pending')
    .order('ig_like_count', { ascending: false })
    .limit(3);

  if (queryError) {
    console.error('Supabase query error:', queryError);
    return { processed: 0, error: queryError.message, url: process.env.NEXT_PUBLIC_SUPABASE_URL };
  }

  console.log('Found pending posts:', pending?.length || 0);
  if (!pending?.length) return { processed: 0 };

  let processed = 0;

  for (const post of pending) {
    try {
      await supabase.from('curated_posts').update({ status: 'processing' }).eq('id', post.id);

      // 1. Download IG video
      const downloadUrl = post.ig_media_url || post.ig_permalink;
      const videoPath = await downloadFile(downloadUrl, `${post.ig_media_id}.mp4`);

      // 2. Always strip original audio, then overlay trending music
      const silentPath = await stripAudio(videoPath);
      let finalPath = silentPath;
      let audio: { videoId: string; title: string } | null = null;
      try {
        await supabase.from('curated_posts').update({ status: 'audio_search' }).eq('id', post.id);
        audio = await findTrendingAudio();
        const audioPath = await downloadYTAudio(audio.videoId);
        await supabase.from('curated_posts').update({ status: 'merging' }).eq('id', post.id);
        finalPath = await mergeAudioVideo(silentPath, audioPath);
      } catch (audioErr: any) {
        console.log('Trending audio overlay failed, uploading silent video:', audioErr.message);
        finalPath = silentPath;
      }

      // 3. Generate metadata
      const metadata = await generateMetadata(post.ig_username, post.ig_permalink);

      // 4. Upload to YouTube
      await supabase.from('curated_posts').update({ status: 'uploading' }).eq('id', post.id);
      const hashtagStr = metadata.hashtags.map((h: string) => `#${h}`).join(' ');
      const ytVideoId = await uploadToYouTube(
        finalPath,
        metadata.title,
        `${metadata.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`,
        metadata.hashtags,
      );

      // 5. Update record
      await supabase.from('curated_posts').update({
        status: 'posted',
        youtube_video_id: ytVideoId,
        youtube_audio_id: audio?.videoId || null,
        youtube_audio_title: audio?.title || 'original',
        title: metadata.title,
        description: metadata.description,
        hashtags: metadata.hashtags,
      }).eq('id', post.id);

      cleanup(videoPath, silentPath, audioPath, finalPath);
      processed++;

    } catch (err: any) {
      console.error('Processing error for post', post.id, ':', err.message);
      await supabase.from('curated_posts').update({
        status: 'failed',
        error_message: err.message,
      }).eq('id', post.id);
    }
  }

  return { processed };
}
