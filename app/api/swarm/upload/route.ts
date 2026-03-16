import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export const runtime = 'edge';

/**
 * POST /api/swarm/upload
 *
 * Proxies a file upload from the iOS Shortcut to Supabase Storage,
 * then automatically registers the file in the DB pipeline.
 *
 * Headers:
 *   X-Upload-Token: Supabase signed upload token
 *   X-Storage-Path: Storage path (e.g. "uploads/uuid.mp4")
 *   X-File-Id: UUID for the file record
 *   X-File-Name: Original filename (for title generation)
 *   Content-Type: video content type (e.g. "video/mp4")
 *
 * Body: Raw file binary
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-upload-token');
  const storagePath = req.headers.get('x-storage-path');
  const fileId = req.headers.get('x-file-id');
  const fileName = req.headers.get('x-file-name');
  const contentType = req.headers.get('content-type') || 'video/mp4';

  if (!token || !storagePath) {
    return NextResponse.json(
      { error: 'Missing X-Upload-Token or X-Storage-Path headers' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
  }

  // Construct the Supabase signed upload URL
  const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/videos/${storagePath}?token=${token}`;

  try {
    // Stream the request body directly to Supabase — no buffering
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: req.body,
      // @ts-expect-error — duplex required for streaming request bodies
      duplex: 'half',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[swarm/upload] Supabase upload failed:', res.status, text);
      return NextResponse.json(
        { error: `Upload failed: ${text}` },
        { status: res.status },
      );
    }

    // Auto-register in the pipeline if fileId was provided
    if (fileId && storagePath) {
      const supabase = createServerClient();
      const name = fileName || 'upload';
      const { error: insertError } = await supabase.from('curated_posts').insert({
        id: fileId,
        status: 'downloaded',
        video_path: storagePath,
        title: name.replace(/\.[^.]+$/, '') || 'Untitled',
        ig_permalink: `manual://${name}`,
        ig_media_id: `upload_${fileId.slice(0, 8)}`,
        ig_like_count: 0,
        ig_username: 'manual_upload',
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('[swarm/upload] Register error:', insertError);
        // Upload succeeded but registration failed — don't lose the file
        return NextResponse.json({ ok: true, registered: false, error: insertError.message });
      }
    }

    return NextResponse.json({ ok: true, registered: !!fileId });
  } catch (err) {
    console.error('[swarm/upload] Stream error:', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 502 },
    );
  }
}
