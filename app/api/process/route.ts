import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

// POST /api/process — Kicks off the video processing pipeline
// Pipeline: strip audio → generate captions → fetch trending music → merge audio + captions → transcode → post
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { video_id, auto_captions, auto_hashtags, auto_music } = await request.json();

    // Verify video belongs to user
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single();

    if (videoError || !video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    // Create job records for the pipeline
    const jobs = [
      { video_id, job_type: 'strip_audio', status: 'queued' },
    ];
    if (auto_captions) jobs.push({ video_id, job_type: 'generate_captions', status: 'queued' });
    if (auto_hashtags) jobs.push({ video_id, job_type: 'generate_captions', status: 'queued' }); // captions needed for hashtags
    if (auto_music) jobs.push({ video_id, job_type: 'fetch_music', status: 'queued' });
    jobs.push({ video_id, job_type: 'merge_audio', status: 'queued' });
    jobs.push({ video_id, job_type: 'transcode', status: 'queued' });

    // Create post records for each target platform
    const postRecords = video.target_platforms.map((platform: string) => ({
      video_id,
      platform,
      status: 'queued',
    }));

    await supabase.from('video_jobs').insert(jobs);
    await supabase.from('video_posts').insert(postRecords);

    // Update video status
    await supabase.from('videos').update({ status: 'processing' }).eq('id', video_id);

    // ── Trigger the background processing pipeline ─────────────────────────
    // In production, this would be:
    // Option A: Inngest event → inngest.send({ name: 'video/process', data: { video_id } })
    // Option B: QStash message → fetch('https://qstash.upstash.io/v2/publish/...') 
    // Option C: Railway worker via webhook
    //
    // For now, we process step 1 inline and queue the rest:

    await processStep1_StripAudio(supabase, video);

    // After stripping audio, kick off parallel jobs
    if (auto_captions) {
      await processStep2_GenerateCaptions(supabase, video);
    }
    if (auto_hashtags) {
      await processStep3_GenerateHashtags(supabase, video);
    }
    if (auto_music) {
      await processStep4_FetchMusic(supabase, video);
    }

    return NextResponse.json({
      success: true,
      video_id,
      message: 'Processing pipeline started',
    });
  } catch (err: any) {
    console.error('Process error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Pipeline Steps ─────────────────────────────────────────────────────────

async function processStep1_StripAudio(supabase: any, video: any) {
  // Update job status
  await supabase
    .from('video_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('video_id', video.id)
    .eq('job_type', 'strip_audio');

  await supabase.from('videos').update({ status: 'stripping_audio' }).eq('id', video.id);

  // In production: download from storage → ffmpeg -an → re-upload
  // FFmpeg command: ffmpeg -i input.mp4 -an -c:v copy output_silent.mp4
  //
  // Implementation requires a server with FFmpeg installed (Railway worker)
  // The worker would:
  // 1. Download video from Supabase Storage
  // 2. Run: ffmpeg -i input.mp4 -an -c:v copy silent.mp4
  // 3. Upload silent.mp4 back to storage
  // 4. Update video record with processed_storage_path

  await supabase
    .from('video_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('video_id', video.id)
    .eq('job_type', 'strip_audio');
}

async function processStep2_GenerateCaptions(supabase: any, video: any) {
  await supabase.from('videos').update({ status: 'generating_captions' }).eq('id', video.id);

  // In production: 
  // 1. Extract audio: ffmpeg -i input.mp4 -vn -acodec pcm_s16le audio.wav
  // 2. Send to Whisper API or AssemblyAI
  // 3. Get back SRT/VTT with timestamps
  // 4. Store in videos.captions_srt and videos.captions_vtt
  //
  // AssemblyAI example:
  // const transcript = await assemblyai.transcripts.transcribe({ audio_url: signedUrl });
  // const srt = await assemblyai.transcripts.subtitles(transcript.id, 'srt');
}

async function processStep3_GenerateHashtags(supabase: any, video: any) {
  // Uses Claude to analyze video content + cross-reference trending data
  // 1. Get captions/transcript
  // 2. Send to Claude: "Generate 20 hashtags: 10 trending + 10 niche"
  // 3. Store in videos.hashtags array
  //
  // See /api/hashtags route for the full implementation
}

async function processStep4_FetchMusic(supabase: any, video: any) {
  await supabase.from('videos').update({ status: 'fetching_music' }).eq('id', video.id);

  // 1. Query YouTube Audio Library API for trending royalty-free tracks
  // 2. Match genre/mood to video content (using Claude)
  // 3. Download the audio track
  // 4. Store track reference in videos.music_track_id
  //
  // See /api/music route for the full implementation
}
