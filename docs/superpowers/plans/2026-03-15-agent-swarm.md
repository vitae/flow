# Agent Swarm Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic worker pipeline with 6 independent agents that communicate via database status transitions, each deployable as a separate Railway service.

**Architecture:** Database-driven state machine. Each agent polls `curated_posts` for rows at its target status, processes them, and advances the status. Agents run as independent Express services sharing the same Supabase database. A new `agent_config` table tracks used audio IDs and agent health. Each agent has its own Dockerfile and can be scaled/restarted independently.

**Tech Stack:** Node.js 20, Express, TypeScript, Supabase, FFmpeg, yt-dlp, Claude API, YouTube Data API v3, Instagram Private API

---

## Status Flow

```
[cron trigger] → scout → pending
                          ↓
                      downloader → downloaded
                                    ↓
                              audio_engineer → audio_ready
                                                ↓
                                            editor → edited
                                                      ↓
                                                  copywriter → metadata_ready
                                                                ↓
                                                            publisher → posted
```

Any agent failure → `failed` with `error_message` and `failed_at_stage`

## File Structure

```
worker/
├── Dockerfile                  # Shared base image (all agents)
├── package.json
├── tsconfig.json
├── src/
│   ├── shared/
│   │   ├── supabase.ts         # Shared Supabase client + helpers
│   │   ├── agent-loop.ts       # Generic poll-process-update loop
│   │   └── types.ts            # Shared types for curated_posts
│   ├── agents/
│   │   ├── scout.ts            # IG hashtag discovery
│   │   ├── downloader.ts       # IG video download
│   │   ├── audio-engineer.ts   # Strip audio + trending overlay
│   │   ├── editor.ts           # Trim to ≤59s, format for Shorts
│   │   ├── copywriter.ts       # Claude metadata generation
│   │   └── publisher.ts        # YouTube Shorts upload
│   ├── lib/
│   │   ├── instagram.ts        # IG private API + hashtag search
│   │   ├── youtube.ts          # YT upload + audio download
│   │   └── ffmpeg.ts           # FFmpeg operations
│   └── index.ts                # Express server, routes per agent
```

## Database Changes

New status values: `downloaded`, `audio_ready`, `edited`, `metadata_ready`
New columns: `failed_at_stage`, `video_path`, `audio_path`, `final_video_path`, `video_duration`

---

## Chunk 1: Shared Infrastructure

### Task 1: Update database schema

**Files:**
- Create: `supabase/migrations/20260315_agent_swarm.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add new statuses and columns for agent swarm
ALTER TABLE curated_posts DROP CONSTRAINT IF EXISTS curated_posts_status_check;
ALTER TABLE curated_posts ADD CONSTRAINT curated_posts_status_check
  CHECK (status IN (
    'pending','downloaded','audio_ready','edited','metadata_ready',
    'processing','uploading','posted','failed'
  ));

ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS failed_at_stage TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS video_duration REAL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the SQL against project `lcfrfimwfqwbaadavcvc`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260315_agent_swarm.sql
git commit -m "feat: add agent swarm statuses and columns to curated_posts"
```

### Task 2: Shared agent loop infrastructure

**Files:**
- Create: `worker/src/shared/types.ts`
- Create: `worker/src/shared/supabase.ts`
- Create: `worker/src/shared/agent-loop.ts`

- [ ] **Step 1: Create shared types**

```typescript
// worker/src/shared/types.ts
export interface CuratedPost {
  id: string;
  ig_media_id: string;
  ig_username: string;
  ig_permalink: string;
  ig_like_count: number;
  ig_media_url: string | null;
  youtube_video_id: string | null;
  youtube_audio_id: string | null;
  youtube_audio_title: string | null;
  title: string | null;
  description: string | null;
  hashtags: string[];
  status: string;
  error_message: string | null;
  failed_at_stage: string | null;
  video_path: string | null;
  video_duration: number | null;
  created_at: string;
}

export type AgentName = 'scout' | 'downloader' | 'audio_engineer' | 'editor' | 'copywriter' | 'publisher';

export interface AgentConfig {
  name: AgentName;
  inputStatus: string;       // status to watch for
  processingStatus: string;  // status while working
  outputStatus: string;      // status on success
  pollIntervalMs: number;    // how often to check for work
  batchSize: number;         // how many to process at once
}
```

- [ ] **Step 2: Create shared Supabase client**

```typescript
// worker/src/shared/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return client;
}
```

- [ ] **Step 3: Create agent loop**

```typescript
// worker/src/shared/agent-loop.ts
import { getSupabase } from './supabase';
import { AgentConfig, CuratedPost } from './types';

export function createAgentLoop(
  config: AgentConfig,
  processOne: (post: CuratedPost) => Promise<Partial<CuratedPost>>
) {
  const supabase = getSupabase();

  async function tick() {
    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', config.inputStatus)
      .order('ig_like_count', { ascending: false })
      .limit(config.batchSize);

    if (!posts?.length) return 0;

    let processed = 0;
    for (const post of posts) {
      try {
        // Claim the post
        await supabase.from('curated_posts')
          .update({ status: config.processingStatus })
          .eq('id', post.id)
          .eq('status', config.inputStatus); // optimistic lock

        const updates = await processOne(post);
        await supabase.from('curated_posts')
          .update({ ...updates, status: config.outputStatus, error_message: null })
          .eq('id', post.id);
        processed++;
      } catch (err: any) {
        console.error(`[${config.name}] Error processing ${post.id}:`, err.message);
        await supabase.from('curated_posts')
          .update({
            status: 'failed',
            error_message: err.message,
            failed_at_stage: config.name,
          })
          .eq('id', post.id);
      }
    }
    return processed;
  }

  function start() {
    console.log(`[${config.name}] Agent started, polling every ${config.pollIntervalMs}ms for status="${config.inputStatus}"`);
    setInterval(async () => {
      try {
        const count = await tick();
        if (count > 0) console.log(`[${config.name}] Processed ${count} posts`);
      } catch (err: any) {
        console.error(`[${config.name}] Tick error:`, err.message);
      }
    }, config.pollIntervalMs);
  }

  return { tick, start };
}
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/shared/
git commit -m "feat: add shared agent loop infrastructure"
```

---

## Chunk 2: Agent Implementations

### Task 3: Scout Agent (Instagram Discovery)

**Files:**
- Create: `worker/src/agents/scout.ts`
- Create: `worker/src/lib/instagram.ts`

- [ ] **Step 1: Move Instagram logic to worker lib**

Port the hashtag search from `lib/instagram/hashtag-search.ts` into `worker/src/lib/instagram.ts`, adapting it to use the worker's Supabase client and the IG private API for media URL extraction.

```typescript
// worker/src/lib/instagram.ts
import crypto from 'crypto';
import { getSupabase } from '../shared/supabase';

const FLOW_HASHTAGS = [
  'flowarts', 'flowartsfriday', 'hulahoop', 'poi', 'juggling',
  'firedance', 'fans', 'firespinner', 'leviwand', 'staffspinning',
  'hooping', 'ledflow', 'whips', 'buugeng', 'contactjuggling',
];
const HASHTAGS_PER_DAY = 5;

function appsecretProof(token: string): string {
  return crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(token).digest('hex');
}

export function getTodaysHashtags(): string[] {
  const dayIndex = Math.floor(Date.now() / 86400000) % Math.ceil(FLOW_HASHTAGS.length / HASHTAGS_PER_DAY);
  const start = dayIndex * HASHTAGS_PER_DAY;
  return FLOW_HASHTAGS.slice(start, start + HASHTAGS_PER_DAY);
}

export interface IGMedia {
  id: string;
  media_type: string;
  permalink: string;
  like_count: number;
  caption: string;
  timestamp: string;
}

async function getIGAccessToken(): Promise<{ token: string; igUserId: string }> {
  const { data } = await getSupabase()
    .from('social_connections')
    .select('*')
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!data) throw new Error('No active Instagram connection found');
  return { token: data.access_token, igUserId: data.platform_user_id };
}

async function searchHashtag(hashtag: string, token: string, igUserId: string): Promise<IGMedia[]> {
  const proof = appsecretProof(token);
  const searchRes = await fetch(
    `https://graph.facebook.com/v21.0/ig_hashtag_search?q=${encodeURIComponent(hashtag)}&user_id=${igUserId}&access_token=${token}&appsecret_proof=${proof}`
  );
  const searchData = await searchRes.json();
  if (searchData.error || !searchData.data?.[0]?.id) return [];

  const hashtagId = searchData.data[0].id;
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${hashtagId}/recent_media?user_id=${igUserId}&fields=id,media_type,permalink,like_count,caption,timestamp&access_token=${token}&appsecret_proof=${proof}`
  );
  const mediaData = await mediaRes.json();
  if (mediaData.error) return [];
  return (mediaData.data || []).filter((m: IGMedia) => m.media_type === 'VIDEO');
}

export async function discoverViralVideos(): Promise<IGMedia[]> {
  const { token, igUserId } = await getIGAccessToken();
  const hashtags = getTodaysHashtags();
  const allVideos: IGMedia[] = [];

  for (const hashtag of hashtags) {
    console.log(`[scout] Searching #${hashtag}...`);
    const videos = await searchHashtag(hashtag, token, igUserId);
    allVideos.push(...videos);
  }

  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];
  unique.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
  return unique.slice(0, 5);
}

// --- Private API for downloading ---
export function shortcodeToMediaId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (const ch of shortcode) {
    id = id * BigInt(64) + BigInt(alphabet.indexOf(ch));
  }
  return id.toString();
}

export async function getVideoUrl(permalink: string): Promise<{ url: string; width: number; height: number }> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) throw new Error('INSTAGRAM_SESSION_ID required');

  const shortcode = permalink.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)?.[2];
  if (!shortcode) throw new Error(`Cannot extract shortcode from: ${permalink}`);

  const mediaId = shortcodeToMediaId(shortcode);
  const decodedSessionId = decodeURIComponent(sessionId);

  const res = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
    headers: {
      'Cookie': `sessionid=${decodedSessionId}; ds_user_id=${decodedSessionId.split(':')[0]}`,
      'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
      'X-IG-App-ID': '936619743392459',
    },
  });

  if (!res.ok) throw new Error(`IG API returned ${res.status}. Session may have expired.`);
  const data = await res.json();
  const item = data?.items?.[0];
  if (!item?.video_versions?.length) throw new Error('No video versions found');

  const best = item.video_versions.sort((a: any, b: any) =>
    (b.width * b.height) - (a.width * a.height)
  )[0];

  return { url: best.url, width: best.width, height: best.height };
}
```

- [ ] **Step 2: Create Scout agent**

```typescript
// worker/src/agents/scout.ts
import { getSupabase } from '../shared/supabase';
import { discoverViralVideos } from '../lib/instagram';

export async function runScout(): Promise<{ discovered: number; queued: number }> {
  const supabase = getSupabase();
  const videos = await discoverViralVideos();
  if (!videos.length) return { discovered: 0, queued: 0 };

  // Deduplicate against existing
  const mediaIds = videos.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = videos.filter(v => !existingIds.has(v.id));

  const toQueue = newVideos.slice(0, 3);
  if (toQueue.length > 0) {
    // Extract real username from permalink: /reel/XX/ → go back and get from IG data
    const rows = toQueue.map(v => {
      // permalink format: https://www.instagram.com/reel/CODE/ or https://www.instagram.com/p/CODE/
      // The username isn't in the permalink for reels, so we use caption @mentions or 'unknown'
      const username = v.caption?.match(/@(\w+)/)?.[1] || 'unknown';
      return {
        ig_media_id: v.id,
        ig_username: username,
        ig_permalink: v.permalink,
        ig_like_count: v.like_count || 0,
        status: 'pending',
        hashtags: [],
      };
    });
    await supabase.from('curated_posts').insert(rows);
  }

  return { discovered: videos.length, queued: toQueue.length };
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/agents/scout.ts worker/src/lib/instagram.ts
git commit -m "feat: add scout agent for IG hashtag discovery"
```

### Task 4: Downloader Agent

**Files:**
- Create: `worker/src/agents/downloader.ts`
- Modify: `worker/src/lib/ffmpeg.ts` (extract download logic)

- [ ] **Step 1: Refactor ffmpeg.ts — keep only FFmpeg operations + download**

Keep `downloadFile`, `downloadFromInstagram`, `downloadCdnVideo`, `stripAudio`, `mergeAudioVideo`, `cleanup`, `ensureTmpDir`, `getVideoDuration` (new).

Add a `getVideoDuration` function:

```typescript
export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}
```

- [ ] **Step 2: Create Downloader agent**

```typescript
// worker/src/agents/downloader.ts
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { downloadFile, getVideoDuration } from '../lib/ffmpeg';
import { getVideoUrl } from '../lib/instagram';

async function process(post: CuratedPost) {
  console.log(`[downloader] Downloading ${post.ig_permalink}`);

  // Get video URL via IG private API
  const { url, width, height } = await getVideoUrl(post.ig_permalink);
  console.log(`[downloader] Found video: ${width}x${height}`);

  // Download the video
  const videoPath = await downloadFile(url, `${post.ig_media_id}.mp4`);
  const duration = await getVideoDuration(videoPath);
  console.log(`[downloader] Downloaded: ${videoPath}, duration: ${duration}s`);

  return { video_path: videoPath, video_duration: duration };
}

export const downloaderAgent = createAgentLoop(
  {
    name: 'downloader',
    inputStatus: 'pending',
    processingStatus: 'processing',
    outputStatus: 'downloaded',
    pollIntervalMs: 10_000,
    batchSize: 3,
  },
  process
);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/agents/downloader.ts worker/src/lib/ffmpeg.ts
git commit -m "feat: add downloader agent"
```

### Task 5: Audio Engineer Agent

**Files:**
- Create: `worker/src/agents/audio-engineer.ts`
- Modify: `worker/src/lib/youtube.ts` (rename from youtube-upload.ts)

- [ ] **Step 1: Create Audio Engineer agent**

```typescript
// worker/src/agents/audio-engineer.ts
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { stripAudio, mergeAudioVideo } from '../lib/ffmpeg';
import { downloadYTAudio } from '../lib/youtube';
import { getSupabase } from '../shared/supabase';

async function getUsedAudioIds(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('curated_posts')
    .select('youtube_audio_id')
    .not('youtube_audio_id', 'is', null);
  return new Set((data || []).map((r: any) => r.youtube_audio_id));
}

async function findTrendingAudio(): Promise<{ videoId: string; title: string }> {
  const usedIds = await getUsedAudioIds();
  const queries = [
    'trending shorts music 2025', 'viral tiktok songs',
    'edm dance music', 'bass house music', 'rave festival music',
    'electronic dance music', 'dubstep drops', 'flow arts music',
    'popular shorts background music',
  ];

  for (let i = 0; i < 3; i++) {
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log(`[audio_engineer] Searching: ${query}`);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet', q: query, type: 'video',
        order: 'viewCount', maxResults: '20',
        key: process.env.YOUTUBE_API_KEY!,
      })
    );
    const data = await res.json();
    if (!data.items?.length) continue;

    const unused = data.items.filter((item: any) => !usedIds.has(item.id.videoId));
    const pick = unused[Math.floor(Math.random() * Math.min(unused.length, 5))];
    if (pick) return { videoId: pick.id.videoId, title: pick.snippet.title };
  }
  throw new Error('No trending audio found after 3 attempts');
}

async function process(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  // 1. Always strip original audio
  console.log(`[audio_engineer] Stripping audio from ${post.video_path}`);
  const silentPath = await stripAudio(post.video_path);

  // 2. Find and overlay trending music
  let finalPath = silentPath;
  let audioId: string | null = null;
  let audioTitle = 'silent';

  try {
    const audio = await findTrendingAudio();
    console.log(`[audio_engineer] Using audio: ${audio.title}`);
    const audioPath = await downloadYTAudio(audio.videoId);
    finalPath = await mergeAudioVideo(silentPath, audioPath);
    audioId = audio.videoId;
    audioTitle = audio.title;
  } catch (err: any) {
    console.log(`[audio_engineer] Audio overlay failed, using silent: ${err.message}`);
  }

  return {
    video_path: finalPath,
    youtube_audio_id: audioId,
    youtube_audio_title: audioTitle,
  };
}

export const audioEngineerAgent = createAgentLoop(
  {
    name: 'audio_engineer',
    inputStatus: 'downloaded',
    processingStatus: 'audio_search',
    outputStatus: 'audio_ready',
    pollIntervalMs: 10_000,
    batchSize: 1, // heavy operation, one at a time
  },
  process
);
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/agents/audio-engineer.ts
git commit -m "feat: add audio engineer agent"
```

### Task 6: Editor Agent

**Files:**
- Create: `worker/src/agents/editor.ts`
- Modify: `worker/src/lib/ffmpeg.ts` (add trimToShorts function)

- [ ] **Step 1: Add trimToShorts to ffmpeg.ts**

```typescript
// Add to worker/src/lib/ffmpeg.ts
export async function trimToShorts(inputPath: string, maxDuration: number = 59): Promise<string> {
  const duration = await getVideoDuration(inputPath);
  if (duration <= maxDuration) {
    console.log(`Video already ${duration}s, no trim needed`);
    return inputPath;
  }

  const outputPath = inputPath.replace('.mp4', '_trimmed.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setDuration(maxDuration)
      .videoCodec('copy')
      .audioCodec('copy')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

- [ ] **Step 2: Create Editor agent**

```typescript
// worker/src/agents/editor.ts
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { trimToShorts, getVideoDuration } from '../lib/ffmpeg';

async function process(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');

  console.log(`[editor] Trimming ${post.video_path} to ≤59s`);
  const trimmedPath = await trimToShorts(post.video_path, 59);
  const finalDuration = await getVideoDuration(trimmedPath);
  console.log(`[editor] Final duration: ${finalDuration}s`);

  return { video_path: trimmedPath, video_duration: finalDuration };
}

export const editorAgent = createAgentLoop(
  {
    name: 'editor',
    inputStatus: 'audio_ready',
    processingStatus: 'processing',
    outputStatus: 'edited',
    pollIntervalMs: 10_000,
    batchSize: 2,
  },
  process
);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/agents/editor.ts worker/src/lib/ffmpeg.ts
git commit -m "feat: add editor agent for 59s trim"
```

### Task 7: Copywriter Agent

**Files:**
- Create: `worker/src/agents/copywriter.ts`

- [ ] **Step 1: Create Copywriter agent**

```typescript
// worker/src/agents/copywriter.ts
import Anthropic from '@anthropic-ai/sdk';
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';

async function generateMetadata(igUsername: string, igCaption?: string) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Create YouTube Short metadata for a flow arts video repost.
Creator: @${igUsername} on Instagram
Caption: ${igCaption || 'Flow arts performance'}

Return ONLY JSON: {"title":"<catchy title under 100 chars with emoji>","description":"<2-3 sentences, credit @${igUsername}, mention gwdf.pro>","hashtags":["<5 contextual hashtags from: flowarts,dance,edm,rave,hulahoop,poi,firedance,juggling,hooping,circus,festival,performance,firespinner,led,gloving>"]}`
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
}

async function process(post: CuratedPost) {
  console.log(`[copywriter] Generating metadata for ${post.ig_permalink}`);
  const metadata = await generateMetadata(post.ig_username, post.ig_permalink);
  console.log(`[copywriter] Title: ${metadata.title}`);

  return {
    title: metadata.title,
    description: metadata.description,
    hashtags: metadata.hashtags,
  };
}

export const copywriterAgent = createAgentLoop(
  {
    name: 'copywriter',
    inputStatus: 'edited',
    processingStatus: 'processing',
    outputStatus: 'metadata_ready',
    pollIntervalMs: 10_000,
    batchSize: 3,
  },
  process
);
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/agents/copywriter.ts
git commit -m "feat: add copywriter agent for Claude metadata"
```

### Task 8: Publisher Agent

**Files:**
- Create: `worker/src/agents/publisher.ts`
- Modify: `worker/src/lib/youtube.ts` (extract from youtube-upload.ts)

- [ ] **Step 1: Refactor youtube.ts**

Rename `worker/src/youtube-upload.ts` → `worker/src/lib/youtube.ts`. Keep `uploadToYouTube`, `downloadYTAudio`, `getYouTubeAuth` as-is but use shared Supabase client.

- [ ] **Step 2: Create Publisher agent**

```typescript
// worker/src/agents/publisher.ts
import { createAgentLoop } from '../shared/agent-loop';
import { CuratedPost } from '../shared/types';
import { uploadToYouTube } from '../lib/youtube';
import { cleanup } from '../lib/ffmpeg';

async function process(post: CuratedPost) {
  if (!post.video_path) throw new Error('No video_path set');
  if (!post.title || !post.description) throw new Error('No metadata set');

  console.log(`[publisher] Uploading "${post.title}" to YouTube`);
  const hashtagStr = (post.hashtags || []).map(h => `#${h}`).join(' ');
  const fullDescription = `${post.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`;

  const ytVideoId = await uploadToYouTube(
    post.video_path,
    post.title,
    fullDescription,
    post.hashtags || [],
  );

  console.log(`[publisher] Uploaded: https://youtube.com/shorts/${ytVideoId}`);

  // Cleanup temp files
  cleanup(post.video_path);

  return { youtube_video_id: ytVideoId };
}

export const publisherAgent = createAgentLoop(
  {
    name: 'publisher',
    inputStatus: 'metadata_ready',
    processingStatus: 'uploading',
    outputStatus: 'posted',
    pollIntervalMs: 10_000,
    batchSize: 1,
  },
  process
);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/agents/publisher.ts worker/src/lib/youtube.ts
git commit -m "feat: add publisher agent for YouTube upload"
```

---

## Chunk 3: Orchestration & Deployment

### Task 9: Rewrite index.ts as agent orchestrator

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

```typescript
// worker/src/index.ts
import express from 'express';
import { runScout } from './agents/scout';
import { downloaderAgent } from './agents/downloader';
import { audioEngineerAgent } from './agents/audio-engineer';
import { editorAgent } from './agents/editor';
import { copywriterAgent } from './agents/copywriter';
import { publisherAgent } from './agents/publisher';

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.RAILWAY_WORKER_SECRET;
const AGENT_MODE = process.env.AGENT_MODE || 'all'; // 'all' | 'scout' | 'downloader' | etc.

// Auth middleware
function auth(req: any, res: any, next: any) {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Manual scout trigger (from Vercel cron or manual)
app.post('/scout', auth, async (_req, res) => {
  try {
    const result = await runScout();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger to run all agents once (backwards compat)
app.post('/process', auth, async (_req, res) => {
  try {
    // Tick each agent once in sequence
    const results: Record<string, number> = {};
    for (const [name, agent] of Object.entries({
      downloader: downloaderAgent,
      audio_engineer: audioEngineerAgent,
      editor: editorAgent,
      copywriter: copywriterAgent,
      publisher: publisherAgent,
    })) {
      results[name] = await agent.tick();
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({
  ok: true,
  mode: AGENT_MODE,
  env: {
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    googleClient: !!process.env.GOOGLE_CLIENT_ID,
    youtubeApi: !!process.env.YOUTUBE_API_KEY,
    workerSecret: !!process.env.RAILWAY_WORKER_SECRET,
    igSession: !!process.env.INSTAGRAM_SESSION_ID,
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Worker v3 listening on port ${PORT}, mode: ${AGENT_MODE}`);

  // Start polling agents based on mode
  const agents: Record<string, { start: () => void }> = {
    downloader: downloaderAgent,
    audio_engineer: audioEngineerAgent,
    editor: editorAgent,
    copywriter: copywriterAgent,
    publisher: publisherAgent,
  };

  if (AGENT_MODE === 'all') {
    Object.values(agents).forEach(a => a.start());
  } else if (agents[AGENT_MODE]) {
    agents[AGENT_MODE].start();
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat: rewrite worker as agent swarm orchestrator"
```

### Task 10: Update cron route to trigger scout

**Files:**
- Modify: `app/api/cron/curate/route.ts`

- [ ] **Step 1: Simplify cron route to just trigger scout**

```typescript
// app/api/cron/curate/route.ts
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not set' }, { status: 500 });
  }

  // Trigger scout agent
  const res = await fetch(`${workerUrl}/scout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
    },
  });

  const result = await res.json();
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/curate/route.ts
git commit -m "feat: simplify cron to trigger scout agent"
```

### Task 11: Clean up old files

**Files:**
- Delete: `worker/src/process.ts`
- Delete: `worker/src/youtube-upload.ts` (replaced by lib/youtube.ts)

- [ ] **Step 1: Remove old monolithic files**

```bash
git rm worker/src/process.ts worker/src/youtube-upload.ts
git commit -m "chore: remove old monolithic pipeline files"
```

### Task 12: Deploy and test

- [ ] **Step 1: Push to main and wait for Railway deploy**

```bash
git push origin claude/goofy-ellis:main
```

- [ ] **Step 2: Verify health endpoint shows mode: "all"**

```bash
curl https://flow-production-d35d.up.railway.app/health
```

- [ ] **Step 3: Trigger scout to discover new posts**

```bash
curl -X POST https://flow-production-d35d.up.railway.app/scout \
  -H "Authorization: Bearer $RAILWAY_WORKER_SECRET"
```

- [ ] **Step 4: Monitor agent processing via database**

```sql
SELECT id, status, failed_at_stage, error_message
FROM curated_posts ORDER BY created_at DESC;
```

- [ ] **Step 5: Verify YouTube upload**

Check YouTube Studio for new Shorts.
