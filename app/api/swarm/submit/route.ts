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
