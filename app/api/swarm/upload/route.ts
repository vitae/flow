import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/swarm/upload
 *
 * Proxies a file upload from the iOS Shortcut to Supabase Storage.
 * The shortcut can't use a variable URL for Supabase's signed upload endpoint,
 * so it POSTs the file here with the token/path in headers, and we stream it through.
 *
 * Headers:
 *   X-Upload-Token: Supabase signed upload token
 *   X-Storage-Path: Storage path (e.g. "uploads/uuid.mp4")
 *   Content-Type: video content type (e.g. "video/mp4")
 *
 * Body: Raw file binary
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-upload-token');
  const storagePath = req.headers.get('x-storage-path');
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[swarm/upload] Stream error:', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 502 },
    );
  }
}
