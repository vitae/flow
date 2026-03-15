import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { downloadFile, stripAudio, mergeAudioVideo, cleanup } from './ffmpeg';
import { uploadToYouTube, downloadYTAudio } from './youtube-upload';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

async function findTrendingAudio(): Promise<{ videoId: string; title: string }> {
  const queries = ['trending shorts music 2026', 'viral edm dance shorts', 'rave music shorts'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
    new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoDuration: 'short',
      order: 'viewCount',
      maxResults: '5',
      key: YOUTUBE_API_KEY,
    })
  );
  const data = await res.json();
  const top = data.items?.[0];
  if (!top) throw new Error('No trending audio found');
  return { videoId: top.id.videoId, title: top.snippet.title };
}

async function generateMetadata(igUsername: string, igCaption?: string) {
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
  console.log('Processing pending posts...');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');

  const { data: pending, error: queryError } = await supabase
    .from('curated_posts')
    .select('*')
    .eq('status', 'pending')
    .order('ig_like_count', { ascending: false })
    .limit(3);

  if (queryError) {
    console.error('Supabase query error:', queryError);
    return { processed: 0, error: queryError.message };
  }

  console.log('Found pending posts:', pending?.length || 0);
  if (!pending?.length) return { processed: 0 };

  let processed = 0;

  for (const post of pending) {
    try {
      await supabase.from('curated_posts').update({ status: 'processing' }).eq('id', post.id);

      // 1. Download IG video via permalink (media_url not available from hashtag search)
      const downloadUrl = post.ig_media_url || post.ig_permalink;
      const videoPath = await downloadFile(downloadUrl, `${post.ig_media_id}.mp4`);

      // 2. Strip audio
      const silentPath = await stripAudio(videoPath);

      // 3. Find trending audio
      await supabase.from('curated_posts').update({ status: 'audio_search' }).eq('id', post.id);
      const audio = await findTrendingAudio();
      const audioPath = await downloadYTAudio(audio.videoId);

      // 4. Merge
      await supabase.from('curated_posts').update({ status: 'merging' }).eq('id', post.id);
      const finalPath = await mergeAudioVideo(silentPath, audioPath);

      // 5. Generate metadata
      const metadata = await generateMetadata(post.ig_username, post.ig_permalink);

      // 6. Upload to YouTube
      await supabase.from('curated_posts').update({ status: 'uploading' }).eq('id', post.id);
      const hashtagStr = metadata.hashtags.map((h: string) => `#${h}`).join(' ');
      const ytVideoId = await uploadToYouTube(
        finalPath,
        metadata.title,
        `${metadata.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`,
        metadata.hashtags,
      );

      // 7. Update record
      await supabase.from('curated_posts').update({
        status: 'posted',
        youtube_video_id: ytVideoId,
        youtube_audio_id: audio.videoId,
        youtube_audio_title: audio.title,
        title: metadata.title,
        description: metadata.description,
        hashtags: metadata.hashtags,
      }).eq('id', post.id);

      cleanup(videoPath, silentPath, audioPath, finalPath);
      processed++;

    } catch (err: any) {
      await supabase.from('curated_posts').update({
        status: 'failed',
        error_message: err.message,
      }).eq('id', post.id);
    }
  }

  return { processed };
}
