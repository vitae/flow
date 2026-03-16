import express from 'express';
import { runScout, startScout } from './agents/scout';
import { downloaderAgent } from './agents/downloader';
import { audioEngineerAgent } from './agents/audio-engineer';
import { editorAgent } from './agents/editor';
import { copywriterAgent } from './agents/copywriter';
import { startPublisher } from './agents/publisher';
import { startMusicAdder } from './agents/music-adder';
import { startCookieRefresher } from './agents/cookie-refresher';
import { getSupabase } from './shared/supabase';

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.RAILWAY_WORKER_SECRET;

function auth(req: any, res: any, next: any) {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Map each transitional status back to its input status for recovery
const STUCK_STATUS_MAP: Record<string, string> = {
  'downloading': 'pending',        // downloader was mid-flight
  'audio_search': 'downloaded',    // audio_engineer was mid-flight
  'editing': 'audio_ready',       // editor was mid-flight
  'writing': 'edited',            // copywriter was mid-flight
  'uploading': 'metadata_ready',  // publisher was mid-flight
  'processing': 'pending',        // legacy — reset to start
  'merging': 'downloaded',        // legacy — reset to audio input
};

/**
 * Recover posts stuck in transitional statuses after a worker crash/restart.
 * Resets them back to the previous stable status so agents re-process them.
 */
async function recoverStuckPosts(): Promise<number> {
  const supabase = getSupabase();
  let recovered = 0;

  for (const [stuckStatus, resetTo] of Object.entries(STUCK_STATUS_MAP)) {
    const { data: stuck } = await supabase
      .from('curated_posts')
      .select('id')
      .eq('status', stuckStatus);

    if (stuck?.length) {
      const ids = stuck.map(p => p.id);
      await supabase
        .from('curated_posts')
        .update({ status: resetTo, error_message: `Recovered from stuck "${stuckStatus}" on restart` })
        .in('id', ids);
      console.log(`[recovery] ${stuck.length} posts: "${stuckStatus}" → "${resetTo}"`);
      recovered += stuck.length;
    }
  }

  if (recovered === 0) {
    console.log('[recovery] No stuck posts found.');
  }
  return recovered;
}

// Trigger scout discovery (called by Vercel cron or manually)
app.post('/scout', auth, async (_req, res) => {
  try {
    const result = await runScout();
    res.json(result);
  } catch (err: any) {
    console.error('[scout] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger: run all agents once in sequence (backwards compat)
app.post('/process', auth, async (_req, res) => {
  try {
    const results: Record<string, number> = {};
    const agents = {
      downloader: downloaderAgent,
      audio_engineer: audioEngineerAgent,
      editor: editorAgent,
      copywriter: copywriterAgent,
      // publisher handled separately with rate limiting
    };
    for (const [name, agent] of Object.entries(agents)) {
      results[name] = await agent.tick();
    }
    res.json(results);
  } catch (err: any) {
    console.error('[process] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual recovery: unstick posts and show what was recovered
app.post('/unstick', auth, async (_req, res) => {
  try {
    const recovered = await recoverStuckPosts();
    res.json({ recovered });
  } catch (err: any) {
    console.error('[unstick] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Pipeline status: count of posts in each status
app.get('/status', auth, async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('curated_posts')
      .select('status');

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.status] = (counts[row.status] || 0) + 1;
    }

    // Also get recent failures
    const { data: failures } = await supabase
      .from('curated_posts')
      .select('id, title, failed_at_stage, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({ pipeline: counts, recent_failures: failures || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({
  ok: true,
  agents: ['scout', 'downloader', 'audio_engineer', 'editor', 'copywriter', 'publisher', 'music_adder', 'cookie_refresher'],
  env: {
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    googleClient: !!process.env.GOOGLE_CLIENT_ID,
    googleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    youtubeApi: !!process.env.YOUTUBE_API_KEY,
    workerSecret: !!process.env.RAILWAY_WORKER_SECRET,
    igSession: !!process.env.INSTAGRAM_SESSION_ID,
    metaAppSecret: !!process.env.META_APP_SECRET,
    ytStudioCookies: !!process.env.YOUTUBE_STUDIO_COOKIES,
    gmailAppPassword: !!process.env.GMAIL_APP_PASSWORD,
  }
}));

// Diagnose: test all connections and report what's working
app.get('/diagnose', auth, async (_req, res) => {
  const supabase = getSupabase();
  const results: Record<string, { ok: boolean; detail: string }> = {};

  // Check Supabase connection
  try {
    const { count } = await supabase
      .from('curated_posts')
      .select('*', { count: 'exact', head: true });
    results.supabase = { ok: true, detail: `Connected. ${count} total posts.` };
  } catch (err: any) {
    results.supabase = { ok: false, detail: err.message };
  }

  // Check pipeline status
  try {
    const { data } = await supabase.from('curated_posts').select('status');
    const counts: Record<string, number> = {};
    for (const row of data || []) counts[row.status] = (counts[row.status] || 0) + 1;
    results.pipeline = { ok: true, detail: JSON.stringify(counts) };
  } catch (err: any) {
    results.pipeline = { ok: false, detail: err.message };
  }

  // Check YouTube connection
  try {
    const { data: ytConn } = await supabase
      .from('social_connections')
      .select('id, access_token, refresh_token, token_expires_at')
      .eq('platform', 'youtube')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (!ytConn) {
      results.youtube = { ok: false, detail: 'No active YouTube connection in social_connections' };
    } else if (!ytConn.refresh_token) {
      results.youtube = { ok: false, detail: 'YouTube connection exists but missing refresh_token' };
    } else {
      const expired = ytConn.token_expires_at && new Date(ytConn.token_expires_at).getTime() < Date.now();
      results.youtube = { ok: true, detail: `Connected. Token ${expired ? 'expired (will auto-refresh)' : 'valid'}.` };
    }
  } catch (err: any) {
    results.youtube = { ok: false, detail: err.message };
  }

  // Check Instagram connection
  try {
    const { data: igConn } = await supabase
      .from('social_connections')
      .select('id, access_token')
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .limit(1)
      .single();
    results.instagram = igConn
      ? { ok: true, detail: 'Connected.' }
      : { ok: false, detail: 'No active Instagram connection in social_connections' };
  } catch (err: any) {
    results.instagram = { ok: false, detail: err.message };
  }

  // Check env vars
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  results.env_vars = missing.length
    ? { ok: false, detail: `Missing: ${missing.join(', ')}` }
    : { ok: true, detail: 'All required env vars set.' };

  // Check Supabase Storage
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const videosBucket = buckets?.find((b: any) => b.name === 'videos');
    results.storage = videosBucket
      ? { ok: true, detail: 'Videos bucket exists.' }
      : { ok: false, detail: 'No "videos" bucket in Supabase Storage' };
  } catch (err: any) {
    results.storage = { ok: false, detail: err.message };
  }

  // Check for recent failures
  try {
    const { data: failures } = await supabase
      .from('curated_posts')
      .select('id, title, failed_at_stage, error_message')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);
    results.recent_failures = {
      ok: !failures?.length,
      detail: failures?.length
        ? failures.map((f: any) => `[${f.failed_at_stage}] ${f.error_message?.slice(0, 80)}`).join(' | ')
        : 'No recent failures.',
    };
  } catch (err: any) {
    results.recent_failures = { ok: false, detail: err.message };
  }

  const allOk = Object.values(results).every(r => r.ok);
  res.json({ healthy: allOk, checks: results });
});

// Retry failed posts: reset them back to the appropriate stage
app.post('/retry-failed', auth, async (_req, res) => {
  const supabase = getSupabase();
  try {
    const { data: failed } = await supabase
      .from('curated_posts')
      .select('id, failed_at_stage')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!failed?.length) {
      return res.json({ retried: 0, message: 'No failed posts to retry.' });
    }

    // Map failed_at_stage back to the input status for that stage
    const stageInputMap: Record<string, string> = {
      downloader: 'pending',
      audio_engineer: 'downloaded',
      editor: 'audio_ready',
      copywriter: 'edited',
      publisher: 'metadata_ready',
    };

    let retried = 0;
    const details: string[] = [];
    for (const post of failed) {
      const resetTo = stageInputMap[post.failed_at_stage || ''] || 'pending';
      await supabase
        .from('curated_posts')
        .update({ status: resetTo, error_message: null, failed_at_stage: null })
        .eq('id', post.id);
      retried++;
      details.push(`${post.id} → ${resetTo}`);
    }

    console.log(`[retry-failed] Retried ${retried} posts:`, details.join(', '));
    res.json({ retried, details });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test YouTube auth — verifies OAuth2 tokens are working
app.post('/test-youtube', auth, async (_req: any, res: any) => {
  try {
    // Dynamic import to avoid circular deps
    const { google } = await import('googleapis');
    const supabase = getSupabase();

    // Step 1: Check social_connections
    const { data: conn, error: connErr } = await supabase
      .from('social_connections')
      .select('*')
      .eq('platform', 'youtube')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (connErr || !conn) {
      return res.json({ ok: false, stage: 'social_connections', error: `No active YouTube connection found. ${connErr?.message || ''}` });
    }
    if (!conn.refresh_token) {
      return res.json({ ok: false, stage: 'refresh_token', error: 'YouTube connection has no refresh_token. Re-authenticate.' });
    }

    // Step 2: Check env vars
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.json({ ok: false, stage: 'env_vars', error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET' });
    }

    // Step 3: Try to refresh the access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
    });

    let tokenInfo: string;
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      tokenInfo = `Token refreshed successfully. Expires: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'unknown'}`;

      // Save the refreshed token
      if (credentials.access_token !== conn.access_token) {
        await supabase.from('social_connections').update({
          access_token: credentials.access_token,
          token_expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        }).eq('id', conn.id);
      }
    } catch (refreshErr: any) {
      const msg = refreshErr.message || String(refreshErr);
      if (msg.includes('invalid_grant')) {
        return res.json({ ok: false, stage: 'token_refresh', error: `Refresh token is INVALID or REVOKED. You must re-authenticate YouTube. (${msg})` });
      }
      return res.json({ ok: false, stage: 'token_refresh', error: `Token refresh failed: ${msg}` });
    }

    // Step 4: Try listing channels to verify YouTube API access
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
      const channelRes = await youtube.channels.list({
        part: ['snippet'],
        mine: true,
      });
      const channel = channelRes.data.items?.[0];
      if (!channel) {
        return res.json({ ok: false, stage: 'youtube_api', error: 'Token valid but no YouTube channel found on this account' });
      }
      return res.json({
        ok: true,
        channel: channel.snippet?.title,
        tokenInfo,
        message: `YouTube auth is working! Channel: ${channel.snippet?.title}`,
      });
    } catch (apiErr: any) {
      return res.json({ ok: false, stage: 'youtube_api', error: `YouTube API call failed: ${apiErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, stage: 'unknown', error: err.message });
  }
});

// Run a single post through the entire pipeline (pick the most ready post)
app.post('/push-pipeline', auth, async (_req: any, res: any) => {
  const supabase = getSupabase();
  const log: string[] = [];

  try {
    // Find the most advanced post that isn't done yet
    const statusPriority = ['metadata_ready', 'edited', 'audio_ready', 'downloaded', 'pending'];
    let post: any = null;
    let foundStatus = '';

    for (const status of statusPriority) {
      const { data } = await supabase
        .from('curated_posts')
        .select('*')
        .eq('status', status)
        .order('ig_like_count', { ascending: false })
        .limit(1);
      if (data?.length) {
        post = data[0];
        foundStatus = status;
        break;
      }
    }

    if (!post) {
      // Also check for failed posts we can retry
      const { data: failed } = await supabase
        .from('curated_posts')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (failed?.length) {
        post = failed[0];
        const stageMap: Record<string, string> = {
          downloader: 'pending', audio_engineer: 'downloaded',
          editor: 'audio_ready', copywriter: 'edited', publisher: 'metadata_ready',
        };
        foundStatus = stageMap[post.failed_at_stage || ''] || 'pending';
        await supabase.from('curated_posts').update({
          status: foundStatus, error_message: null, failed_at_stage: null,
        }).eq('id', post.id);
        log.push(`Retried failed post ${post.id} → ${foundStatus}`);
        post.status = foundStatus;
      } else {
        return res.json({ ok: false, log: ['No posts found in pipeline. Upload a video first.'] });
      }
    }

    log.push(`Found post ${post.id} at status: ${foundStatus}`);

    // Run each stage sequentially from where the post is
    const stages: { status: string; agentName: string; run: () => Promise<void> }[] = [
      {
        status: 'pending',
        agentName: 'downloader',
        run: async () => {
          log.push('[downloader] Starting download...');
          const processed = await downloaderAgent.tick();
          log.push(`[downloader] Processed ${processed} posts`);
        },
      },
      {
        status: 'downloaded',
        agentName: 'audio_engineer',
        run: async () => {
          log.push('[audio_engineer] Starting audio strip...');
          const processed = await audioEngineerAgent.tick();
          log.push(`[audio_engineer] Processed ${processed} posts`);
        },
      },
      {
        status: 'audio_ready',
        agentName: 'editor',
        run: async () => {
          log.push('[editor] Starting video edit...');
          const processed = await editorAgent.tick();
          log.push(`[editor] Processed ${processed} posts`);
        },
      },
      {
        status: 'edited',
        agentName: 'copywriter',
        run: async () => {
          log.push('[copywriter] Generating metadata...');
          const processed = await copywriterAgent.tick();
          log.push(`[copywriter] Processed ${processed} posts`);
        },
      },
    ];

    // Run stages from where the post currently is
    const startIdx = stages.findIndex(s => s.status === foundStatus);
    if (startIdx >= 0) {
      for (let i = startIdx; i < stages.length; i++) {
        try {
          await stages[i].run();
          // Re-fetch post to check status
          const { data: updated } = await supabase
            .from('curated_posts')
            .select('status, error_message')
            .eq('id', post.id)
            .single();
          if (updated?.status === 'failed') {
            log.push(`FAILED at ${stages[i].agentName}: ${updated.error_message}`);
            return res.json({ ok: false, post_id: post.id, failed_at: stages[i].agentName, log });
          }
          log.push(`→ Status now: ${updated?.status}`);
        } catch (err: any) {
          log.push(`ERROR at ${stages[i].agentName}: ${err.message}`);
          return res.json({ ok: false, post_id: post.id, failed_at: stages[i].agentName, log });
        }
      }
    }

    // Now try the publisher
    log.push('[publisher] Starting YouTube upload...');
    try {
      const { data: readyPost } = await supabase
        .from('curated_posts')
        .select('*')
        .eq('id', post.id)
        .single();

      if (readyPost?.status !== 'metadata_ready') {
        log.push(`Post is at status "${readyPost?.status}", expected "metadata_ready"`);
        return res.json({ ok: false, post_id: post.id, status: readyPost?.status, log });
      }

      // Import and run publisher directly
      const { uploadToYouTube } = await import('./lib/youtube');
      const { ensureLocalFile, cleanup } = await import('./lib/ffmpeg');

      if (!readyPost.video_path) throw new Error('No video_path');
      if (!readyPost.title || !readyPost.description) throw new Error('No metadata');

      // Claim the post
      await supabase.from('curated_posts')
        .update({ status: 'uploading' })
        .eq('id', post.id)
        .eq('status', 'metadata_ready');

      const localPath = await ensureLocalFile(readyPost.video_path);
      log.push(`[publisher] Video ready at ${localPath}`);

      const ytTitle = readyPost.title.includes('#Shorts')
        ? readyPost.title
        : `${readyPost.title} #Shorts`.slice(0, 100);

      const hashtagStr = (readyPost.hashtags || []).map((h: string) => `#${h}`).join(' ');
      const fullDesc = `${readyPost.description}\n\n${hashtagStr}\n\nOriginal: ${readyPost.ig_permalink}\n🌊 Discover more at gwdf.pro`;

      log.push(`[publisher] Uploading to YouTube: "${ytTitle}"`);
      const ytVideoId = await uploadToYouTube(localPath, ytTitle, fullDesc, readyPost.hashtags || []);

      await supabase.from('curated_posts')
        .update({
          youtube_video_id: ytVideoId,
          status: 'posted',
          error_message: null,
        })
        .eq('id', post.id);

      cleanup(localPath);

      const ytUrl = `https://youtube.com/shorts/${ytVideoId}`;
      log.push(`[publisher] ✓ SUCCESS! YouTube Short: ${ytUrl}`);

      return res.json({
        ok: true,
        post_id: post.id,
        youtube_video_id: ytVideoId,
        youtube_url: ytUrl,
        log,
      });
    } catch (err: any) {
      log.push(`[publisher] FAILED: ${err.message}`);
      await supabase.from('curated_posts')
        .update({ status: 'failed', error_message: err.message, failed_at_stage: 'publisher' })
        .eq('id', post.id);
      return res.json({ ok: false, post_id: post.id, failed_at: 'publisher', error: err.message, log });
    }
  } catch (err: any) {
    log.push(`ERROR: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message, log });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Flow Agent Swarm v3 listening on port ${PORT}`);

  // Recover any posts stuck in transitional statuses from a previous crash
  console.log('[recovery] Checking for stuck posts...');
  await recoverStuckPosts();

  console.log('Starting all agents...');

  // Start continuous scout (1 hashtag every 10min)
  startScout();

  // Start all polling agents
  downloaderAgent.start();
  audioEngineerAgent.start();
  editorAgent.start();
  copywriterAgent.start();
  startPublisher();
  startCookieRefresher(); // Refresh YT Studio cookies every 6h before they expire
  startMusicAdder();

  console.log('All agents running.');
});
