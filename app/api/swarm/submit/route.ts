import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const title = formData.get('title') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'File must be a video' }, { status: 400 });
    }

    // Max 100MB
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 100MB' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'mp4';
    const storagePath = `uploads/${id}.${ext}`;

    const supabase = createServerClient();

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[swarm/submit] Upload error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Create curated_posts row — status "downloaded" since we already have the file
    // This skips the downloader and goes straight to audio_engineer
    const { error: insertError } = await supabase.from('curated_posts').insert({
      id,
      status: 'downloaded',
      video_path: storagePath,
      title: title || file.name.replace(/\.[^.]+$/, ''),
      ig_permalink: `manual://${file.name}`,
      ig_media_id: `upload_${id.slice(0, 8)}`,
      ig_like_count: 0,
      ig_username: 'manual_upload',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[swarm/submit] Insert error:', insertError);
      // Clean up uploaded file
      await supabase.storage.from('videos').remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      id,
      status: 'downloaded',
      message: 'Video uploaded and queued for processing',
      path: storagePath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
