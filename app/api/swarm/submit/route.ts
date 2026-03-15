import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * POST /api/swarm/submit
 *
 * Auth: Bearer token via UPLOAD_API_KEY env var (required for external clients like iOS Shortcuts).
 *       Requests from the same origin (web dashboard) are allowed without auth.
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

function isAuthorized(req: NextRequest): boolean {
  // Allow same-origin requests (web dashboard) without auth
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');
  if (host && (origin?.includes(host) || referer?.includes(host))) {
    return true;
  }

  // External clients must provide Bearer token
  const apiKey = process.env.UPLOAD_API_KEY;
  if (!apiKey) return true; // If no key is configured, allow all (dev mode)

  const auth = req.headers.get('authorization');
  if (!auth) return false;

  const token = auth.replace(/^Bearer\s+/i, '');
  return token === apiKey;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const mode = body.mode;

    const supabase = createServerClient();

    if (mode === 'sign') {
      // Generate a signed upload URL so the client can upload directly to Supabase Storage
      const { filename, contentType } = body;
      if (!filename || !contentType) {
        return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const ext = filename.split('.').pop() || 'mp4';
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
