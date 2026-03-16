import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * POST /api/swarm/submit
 *
 * No auth required — the iOS Shortcut and web dashboard both call this directly.
 *
 * Two modes:
 * 1. mode=sign — Returns a signed upload URL for direct client->Supabase upload
 *    Body: { filename: string, contentType: string }
 *    Returns: { id, uploadUrl, storagePath }
 *
 * 2. mode=register — After client uploads the file, register it in the DB
 *    Body: { id, storagePath, title? }
 *    Returns: { id, status }
 */

// GET: health-check / warm-up for iOS Shortcuts
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode;

    const supabase = createServerClient();

    if (mode === 'sign') {
      // Generate a signed upload URL so the client can upload directly to Supabase Storage
      const { filename } = body;
      if (!filename) {
        return NextResponse.json({ error: 'filename required' }, { status: 400 });
      }

      // Auto-detect content type from filename extension (iOS Shortcuts don't reliably detect MIME types)
      const ext = (filename.split('.').pop() || 'mp4').toLowerCase();
      const MIME_MAP: Record<string, string> = {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        avi: 'video/x-msvideo',
        m4v: 'video/x-m4v',
      };
      const contentType = body.contentType || MIME_MAP[ext] || 'video/mp4';

      // Validate it's a video type
      if (!contentType.startsWith('video/')) {
        return NextResponse.json({ error: `Unsupported file type: .${ext}. Must be a video file (mp4, mov, webm, avi).` }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const storagePath = `uploads/${id}.${ext}`;

      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUploadUrl(storagePath);

      if (error) {
        console.error('[swarm/submit] Signed URL error:', error);
        return NextResponse.json({ error: `Failed to create upload URL: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({
        id,
        uploadUrl: data.signedUrl,
        token: data.token,
        storagePath,
        contentType,
      });
    }

    if (mode === 'url') {
      // Accept a video URL (e.g. from Safari Share Sheet) — server downloads and queues it
      const { url } = body;
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'url required' }, { status: 400 });
      }

      // Basic URL validation
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const storagePath = `uploads/${id}.mp4`;

      // Download the video server-side
      console.log(`[swarm/submit] Downloading video from URL: ${url}`);
      const videoRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
        redirect: 'follow',
      });

      if (!videoRes.ok) {
        return NextResponse.json({ error: `Failed to download video: HTTP ${videoRes.status}` }, { status: 502 });
      }

      const contentType = videoRes.headers.get('content-type') || '';
      // Allow video/* and application/octet-stream (many CDNs use this for video)
      if (!contentType.startsWith('video/') && !contentType.includes('octet-stream') && !contentType.includes('mp4')) {
        console.warn(`[swarm/submit] Unexpected content-type: ${contentType}, proceeding anyway`);
      }

      const buffer = Buffer.from(await videoRes.arrayBuffer());
      if (buffer.length < 10000) {
        return NextResponse.json({ error: `Downloaded file too small (${buffer.length} bytes), likely not a video` }, { status: 400 });
      }

      console.log(`[swarm/submit] Downloaded ${buffer.length} bytes, uploading to storage...`);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });

      if (uploadError) {
        console.error('[swarm/submit] Storage upload error:', uploadError);
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
      }

      // Register in the pipeline
      const hostname = parsed.hostname.replace('www.', '');
      const { error: insertError } = await supabase.from('curated_posts').insert({
        id,
        status: 'downloaded',
        video_path: storagePath,
        title: body.title || `Video from ${hostname}`,
        ig_permalink: url,
        ig_media_id: `safari_${id.slice(0, 8)}`,
        ig_like_count: 0,
        ig_username: `safari_${hostname}`,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('[swarm/submit] Insert error:', insertError);
        await supabase.storage.from('videos').remove([storagePath]);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log(`[swarm/submit] ✓ Video from ${hostname} queued as ${id}`);
      return NextResponse.json({ id, status: 'downloaded', message: `Video from ${hostname} queued for YouTube Shorts pipeline` });
    }

    if (mode === 'register') {
      // Client has finished uploading — register the file in curated_posts
      const { id, storagePath, title, filename } = body;
      if (!id || !storagePath) {
        return NextResponse.json({ error: 'id and storagePath required' }, { status: 400 });
      }

      const { error: insertError } = await supabase.from('curated_posts').insert({
        id,
        status: 'downloaded',
        video_path: storagePath,
        title: title || (filename ? filename.replace(/\.[^.]+$/, '') : 'Untitled'),
        ig_permalink: `manual://${filename || 'upload'}`,
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

      return NextResponse.json({ id, status: 'downloaded', message: 'Video queued for processing' });
    }

    return NextResponse.json({ error: 'Invalid mode. Use "sign" or "register"' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[swarm/submit] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
