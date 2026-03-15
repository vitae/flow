import fs from 'fs';
import path from 'path';
import { getSupabase } from '../shared/supabase';

async function getIGConnection() {
  const { data } = await getSupabase()
    .from('social_connections')
    .select('*')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!data) throw new Error('No active Instagram connection found');
  return data;
}

async function uploadToStorage(videoPath: string): Promise<string> {
  const supabase = getSupabase();
  const fileName = `reels/${Date.now()}-${path.basename(videoPath)}`;
  const fileBuffer = fs.readFileSync(videoPath);

  const { error } = await supabase.storage
    .from('videos')
    .upload(fileName, fileBuffer, { contentType: 'video/mp4', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from('videos').getPublicUrl(fileName);
  console.log(`[meta-reels] Video uploaded to storage: ${data.publicUrl}`);
  return data.publicUrl;
}

async function waitForContainer(containerId: string, token: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${token}`
    );
    const data = await res.json();
    console.log(`[meta-reels] Container ${containerId} status: ${data.status_code}`);

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Container error: ${data.status || 'unknown'}`);

    // Wait 10 seconds between polls
    await new Promise(r => setTimeout(r, 10_000));
  }
  throw new Error('Container processing timed out after 5 minutes');
}

export async function publishToInstagramReels(
  videoPath: string,
  caption: string,
): Promise<string> {
  const connection = await getIGConnection();
  const token = connection.access_token;
  const igUserId = connection.platform_user_id;

  // Upload to Supabase Storage to get a public URL (IG API requires a URL)
  const videoUrl = await uploadToStorage(videoPath);
  console.log(`[meta-reels] Creating IG Reels container with video URL...`);

  // Step 1: Create media container
  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: token,
      }),
    }
  );
  const createData = await createRes.json();
  if (createData.error) throw new Error(`IG container error: ${createData.error.message}`);
  const containerId = createData.id;
  console.log(`[meta-reels] IG container created: ${containerId}`);

  // Step 2: Wait for processing
  await waitForContainer(containerId, token);

  // Step 3: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: token,
      }),
    }
  );
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG publish error: ${publishData.error.message}`);

  console.log(`[meta-reels] IG Reel published: ${publishData.id}`);
  return publishData.id;
}

export async function publishToFacebookReels(
  videoPath: string,
  description: string,
): Promise<string> {
  const connection = await getIGConnection(); // IG connection has FB page access
  const token = connection.access_token;

  // Get the connected Facebook Page ID
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${token}`
  );
  const pagesData = await pagesRes.json();
  if (!pagesData.data?.length) throw new Error('No Facebook Pages found');
  const page = pagesData.data[0];
  const pageToken = page.access_token;
  const pageId = page.id;

  console.log(`[meta-reels] Publishing to FB Page: ${page.name} (${pageId})`);

  // Step 1: Initialize upload
  const initRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        access_token: pageToken,
      }),
    }
  );
  const initData = await initRes.json();
  if (initData.error) throw new Error(`FB init error: ${initData.error.message}`);
  const fbVideoId = initData.video_id;
  console.log(`[meta-reels] FB upload initialized: ${fbVideoId}`);

  // Step 2: Upload video file
  const fileBuffer = fs.readFileSync(videoPath);
  const uploadRes = await fetch(
    `https://rupload.facebook.com/video-upload/v21.0/${fbVideoId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${pageToken}`,
        'offset': '0',
        'file_size': fileBuffer.length.toString(),
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    }
  );
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error(`FB upload failed: ${JSON.stringify(uploadData)}`);
  console.log(`[meta-reels] FB video uploaded`);

  // Step 3: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: fbVideoId,
        description,
        access_token: pageToken,
      }),
    }
  );
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`FB publish error: ${publishData.error.message}`);

  console.log(`[meta-reels] FB Reel published: ${publishData.video_id || fbVideoId}`);
  return publishData.video_id || fbVideoId;
}
