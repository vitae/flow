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
    youtubeApi: !!process.env.YOUTUBE_API_KEY,
    workerSecret: !!process.env.RAILWAY_WORKER_SECRET,
    igSession: !!process.env.INSTAGRAM_SESSION_ID,
    metaAppSecret: !!process.env.META_APP_SECRET,
    ytStudioCookies: !!process.env.YOUTUBE_STUDIO_COOKIES,
    gmailAppPassword: !!process.env.GMAIL_APP_PASSWORD,
  }
}));

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
