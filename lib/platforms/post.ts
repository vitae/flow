import { createServerClient } from '@/lib/supabase/client';
import type { Platform, SocialConnection } from '@/lib/types';

// ── Token refresh helper ───────────────────────────────────────────────────
async function getValidToken(connection: SocialConnection): Promise<string> {
  const supabase = createServerClient();

  // Check if token is expired
  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    // Refresh the token
    if (connection.platform === 'youtube' && connection.refresh_token) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const tokens = await res.json();
      if (tokens.access_token) {
        await supabase.from('social_connections').update({
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }).eq('id', connection.id);
        return tokens.access_token;
      }
    }
    throw new Error(`Token expired for ${connection.platform} and refresh failed`);
  }

  return connection.access_token;
}

// ── YouTube Upload ─────────────────────────────────────────────────────────
export async function postToYouTube(
  connection: SocialConnection,
  videoUrl: string,
  title: string,
  description: string,
  hashtags: string[]
) {
  const token = await getValidToken(connection);
  const hashtagStr = hashtags.slice(0, 15).map(h => `#${h}`).join(' ');

  // 1. Initiate resumable upload
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title,
          description: `${description}\n\n${hashtagStr}`,
          tags: hashtags.slice(0, 30),
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('Failed to initiate YouTube upload');

  // 2. Download video from storage and upload to YouTube
  const videoData = await fetch(videoUrl);
  const videoBlob = await videoData.blob();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBlob.size.toString(),
    },
    body: videoBlob,
  });

  const result = await uploadRes.json();
  return {
    platform_post_id: result.id,
    platform_post_url: `https://youtube.com/watch?v=${result.id}`,
  };
}

// ── Instagram Upload (via Meta Graph API) ──────────────────────────────────
export async function postToInstagram(
  connection: SocialConnection,
  videoUrl: string,
  caption: string,
  hashtags: string[]
) {
  const token = await getValidToken(connection);
  const igUserId = connection.page_id; // IG Business Account ID
  if (!igUserId) throw new Error('No Instagram Business Account linked');

  const hashtagStr = hashtags.slice(0, 30).map(h => `#${h}`).join(' ');

  // 1. Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        caption: `${caption}\n\n${hashtagStr}`,
        media_type: 'REELS',
        access_token: token,
      }),
    }
  );
  const container = await containerRes.json();
  if (container.error) throw new Error(container.error.message);

  // 2. Wait for processing (poll status)
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${container.id}?fields=status_code&access_token=${token}`
    );
    const statusData = await statusRes.json();
    status = statusData.status_code;
    attempts++;
  }

  if (status !== 'FINISHED') throw new Error(`IG processing failed: ${status}`);

  // 3. Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    }
  );
  const published = await publishRes.json();
  if (published.error) throw new Error(published.error.message);

  return {
    platform_post_id: published.id,
    platform_post_url: `https://instagram.com/p/${published.id}`,
  };
}

// ── Facebook Page Video Upload ─────────────────────────────────────────────
export async function postToFacebook(
  connection: SocialConnection,
  videoUrl: string,
  title: string,
  description: string,
  hashtags: string[]
) {
  const token = await getValidToken(connection);
  const pageId = connection.page_id;
  if (!pageId) throw new Error('No Facebook Page linked');

  const hashtagStr = hashtags.slice(0, 10).map(h => `#${h}`).join(' ');

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/videos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: videoUrl,
        title,
        description: `${description}\n\n${hashtagStr}`,
        access_token: token,
      }),
    }
  );

  const result = await res.json();
  if (result.error) throw new Error(result.error.message);

  return {
    platform_post_id: result.id,
    platform_post_url: `https://facebook.com/${pageId}/videos/${result.id}`,
  };
}

// ── Twitter/X Video Upload ─────────────────────────────────────────────────
export async function postToTwitter(
  connection: SocialConnection,
  videoUrl: string,
  text: string,
  hashtags: string[]
) {
  const token = await getValidToken(connection);
  const hashtagStr = hashtags.slice(0, 5).map(h => `#${h}`).join(' ');
  const tweetText = `${text}\n\n${hashtagStr}`.slice(0, 280);

  // 1. Download video
  const videoData = await fetch(videoUrl);
  const videoBuffer = await videoData.arrayBuffer();
  const totalBytes = videoBuffer.byteLength;

  // 2. INIT chunked upload
  const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    }),
  });
  const initData = await initRes.json();
  const mediaId = initData.media_id_string;

  // 3. APPEND chunks (5MB each)
  const chunkSize = 5 * 1024 * 1024;
  let segmentIndex = 0;
  for (let i = 0; i < totalBytes; i += chunkSize) {
    const chunk = videoBuffer.slice(i, Math.min(i + chunkSize, totalBytes));
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', segmentIndex.toString());
    formData.append('media_data', Buffer.from(chunk).toString('base64'));

    await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    segmentIndex++;
  }

  // 4. FINALIZE
  await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  // 5. Wait for processing
  let processing = true;
  while (processing) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const statusData = await statusRes.json();
    if (!statusData.processing_info || statusData.processing_info.state === 'succeeded') {
      processing = false;
    } else if (statusData.processing_info.state === 'failed') {
      throw new Error('Twitter video processing failed');
    }
  }

  // 6. Create tweet with media
  const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: tweetText,
      media: { media_ids: [mediaId] },
    }),
  });

  const tweet = await tweetRes.json();
  return {
    platform_post_id: tweet.data?.id,
    platform_post_url: `https://x.com/i/status/${tweet.data?.id}`,
  };
}

// ── Threads Video Upload ──────────────────────────────────────────────────
export async function postToThreads(
  connection: SocialConnection,
  videoUrl: string,
  text: string,
  hashtags: string[]
) {
  const token = await getValidToken(connection);
  const userId = connection.platform_user_id;
  const hashtagStr = hashtags.slice(0, 10).map(h => `#${h}`).join(' ');
  const caption = `${text}\n\n${hashtagStr}`.slice(0, 500);

  // 1. Create media container
  const containerRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'VIDEO',
        video_url: videoUrl,
        text: caption,
        access_token: token,
      }),
    }
  );
  const container = await containerRes.json();
  if (container.error) throw new Error(container.error.message);

  // 2. Wait for processing (poll status)
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://graph.threads.net/v1.0/${container.id}?fields=status&access_token=${token}`
    );
    const statusData = await statusRes.json();
    status = statusData.status;
    attempts++;
  }

  if (status !== 'FINISHED') throw new Error(`Threads processing failed: ${status}`);

  // 3. Publish
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    }
  );
  const published = await publishRes.json();
  if (published.error) throw new Error(published.error.message);

  return {
    platform_post_id: published.id,
    platform_post_url: `https://threads.net/post/${published.id}`,
  };
}

// ── Dispatch to correct platform ───────────────────────────────────────────
export async function postToPlatform(
  platform: Platform,
  connection: SocialConnection,
  videoUrl: string,
  title: string,
  description: string,
  hashtags: string[]
) {
  switch (platform) {
    case 'youtube':
      return postToYouTube(connection, videoUrl, title, description, hashtags);
    case 'instagram':
      return postToInstagram(connection, videoUrl, `${title}\n\n${description}`, hashtags);
    case 'facebook':
      return postToFacebook(connection, videoUrl, title, description, hashtags);
    case 'twitter':
      return postToTwitter(connection, videoUrl, title, hashtags);
    case 'threads':
      return postToThreads(connection, videoUrl, `${title}\n\n${description}`, hashtags);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
