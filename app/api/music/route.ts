import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get('genre') || '';
    const mood = searchParams.get('mood') || '';

    const supabase = createServerClient();

    // Check cache first
    const { data: cached } = await supabase
      .from('music_tracks')
      .select('*')
      .order('trending_score', { ascending: false })
      .limit(20);

    if (cached && cached.length > 10) {
      return NextResponse.json({ tracks: cached, source: 'cache' });
    }

    // Fetch trending music videos from YouTube (Music category = 10)
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      new URLSearchParams({
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        videoCategoryId: '10', // Music
        regionCode: 'US',
        maxResults: '25',
        key: YOUTUBE_API_KEY,
      })
    );

    const ytData = await ytRes.json();
    if (ytData.error) throw new Error(ytData.error.message);

    const tracks = (ytData.items || []).map((item: any, i: number) => ({
      youtube_video_id: item.id,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      genre: genre || null,
      mood: mood || null,
      duration_seconds: parseDuration(item.contentDetails.duration),
      preview_url: `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
      download_url: `https://youtube.com/watch?v=${item.id}`,
      license: 'youtube_audio_library',
      trending_score: 100 - i,
    }));

    // Cache tracks
    for (const track of tracks) {
      await supabase.from('music_tracks').upsert(track, {
        onConflict: 'youtube_video_id',
      });
    }

    return NextResponse.json({ tracks, source: 'youtube' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/music — Select a track for a video
export async function POST(request: NextRequest) {
  try {
    const { video_id, track_id, track_title } = await request.json();
    const supabase = createServerClient();

    await supabase.from('videos').update({
      music_track_id: track_id,
      music_track_title: track_title,
      music_source: 'youtube_audio_library',
    }).eq('id', video_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 3600) +
         (parseInt(match[2] || '0') * 60) +
         parseInt(match[3] || '0');
}
