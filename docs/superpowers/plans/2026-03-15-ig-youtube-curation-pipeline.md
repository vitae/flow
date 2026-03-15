# Instagram → YouTube Shorts Auto-Curation Pipeline

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically discover viral flow arts videos on Instagram via hashtag search, strip audio, overlay trending YouTube Shorts music, generate SEO metadata with Claude, and upload as YouTube Shorts to the GlowWitDaFlow channel.

**Architecture:** Vercel cron triggers a Next.js API route daily that searches Instagram Graph API for top videos across flow arts hashtags, filters by engagement, deduplicates against a Supabase `curated_posts` table, then sends processing jobs to a Railway worker. The Railway worker downloads the video, uses FFmpeg to strip audio and merge trending music (discovered via YouTube Data API), then uploads the final Short via YouTube Data API v3. Claude generates SEO-optimized titles, descriptions, and contextual hashtags.

**Tech Stack:** Next.js 15 (Vercel), Railway (Node.js + FFmpeg worker), Supabase (Postgres + Storage), Instagram Graph API v21.0, YouTube Data API v3, Claude API (@anthropic-ai/sdk), FFmpeg (fluent-ffmpeg)

---

## Chunk 1: Database + Types + IG Hashtag Search

### Task 1: Add CuratedPost type and update types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add CuratedPost type to lib/types.ts**

Add after the `MusicTrack` interface:

```typescript
export type CurationStatus = 'pending' | 'processing' | 'audio_search' | 'merging' | 'uploading' | 'posted' | 'failed';

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
  status: CurationStatus;
  error_message: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CuratedPost type for IG→YT pipeline"
```

### Task 2: Create Supabase migration for curated_posts table

**Files:**
- Create: `supabase/migrations/20260315_curated_posts.sql`

- [ ] **Step 1: Create migration file**

```sql
CREATE TABLE IF NOT EXISTS curated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_media_id TEXT UNIQUE NOT NULL,
  ig_username TEXT NOT NULL,
  ig_permalink TEXT NOT NULL,
  ig_like_count INTEGER DEFAULT 0,
  ig_media_url TEXT,
  youtube_video_id TEXT,
  youtube_audio_id TEXT,
  youtube_audio_title TEXT,
  title TEXT,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','audio_search','merging','uploading','posted','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_curated_ig_media ON curated_posts(ig_media_id);
CREATE INDEX idx_curated_status ON curated_posts(status);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the SQL against the live Supabase project.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add curated_posts table migration"
```

### Task 3: Create Instagram hashtag search helper

**Files:**
- Create: `lib/instagram/hashtag-search.ts`

- [ ] **Step 1: Create the hashtag search module**

```typescript
import { createServerClient } from '@/lib/supabase/client';

const FLOW_HASHTAGS = [
  'flowarts', 'flowartsfriday', 'hulahoop', 'poi', 'juggling',
  'firedance', 'fans', 'firespinner', 'leviwand', 'staffspinning',
  'hooping', 'ledflow', 'whips', 'buugeng', 'contactjuggling',
];

// Use 5 hashtags per day, rotate through all 15 over 3 days
const HASHTAGS_PER_DAY = 5;

interface IGMedia {
  id: string;
  media_type: string;
  media_url: string;
  permalink: string;
  like_count: number;
  comments_count: number;
  username: string;
  timestamp: string;
}

export function getTodaysHashtags(): string[] {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % Math.ceil(FLOW_HASHTAGS.length / HASHTAGS_PER_DAY);
  const start = dayIndex * HASHTAGS_PER_DAY;
  return FLOW_HASHTAGS.slice(start, start + HASHTAGS_PER_DAY);
}

async function getIGAccessToken(): Promise<{ token: string; igUserId: string }> {
  const supabase = createServerClient();
  const { data } = await supabase
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
  // 1. Get hashtag ID
  const searchRes = await fetch(
    `https://graph.facebook.com/v21.0/ig_hashtag_search?q=${hashtag}&user_id=${igUserId}&access_token=${token}`
  );
  const searchData = await searchRes.json();
  if (!searchData.data?.[0]?.id) return [];
  const hashtagId = searchData.data[0].id;

  // 2. Get top media for this hashtag
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${hashtagId}/top_media?user_id=${igUserId}&fields=id,media_type,media_url,permalink,like_count,comments_count,username,timestamp&access_token=${token}`
  );
  const mediaData = await mediaRes.json();
  return (mediaData.data || []).filter((m: IGMedia) => m.media_type === 'VIDEO');
}

export async function discoverViralVideos(): Promise<IGMedia[]> {
  const { token, igUserId } = await getIGAccessToken();
  const hashtags = getTodaysHashtags();
  const allVideos: IGMedia[] = [];

  for (const hashtag of hashtags) {
    const videos = await searchHashtag(hashtag, token, igUserId);
    allVideos.push(...videos);
  }

  // Deduplicate by media ID, sort by likes descending
  const unique = [...new Map(allVideos.map(v => [v.id, v])).values()];
  unique.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

  // Return top 5 most viral
  return unique.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/instagram/
git commit -m "feat: add Instagram hashtag search for viral video discovery"
```

## Chunk 2: YouTube Trending Audio + Claude Metadata

### Task 4: Create YouTube trending audio finder

**Files:**
- Create: `lib/youtube/trending-audio.ts`

- [ ] **Step 1: Create trending audio discovery module**

Uses YouTube Data API to search for top-performing Shorts in dance/music categories and identify frequently-used audio tracks.

```typescript
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

interface TrendingAudio {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
}

export async function findTrendingShortAudio(mood?: string): Promise<TrendingAudio[]> {
  const queries = [
    'trending shorts music 2026',
    'viral dance music shorts',
    'edm rave music shorts',
    mood ? `${mood} music shorts` : 'flow arts music',
  ];

  const allResults: TrendingAudio[] = [];

  for (const query of queries) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        videoDuration: 'short',
        order: 'viewCount',
        maxResults: '10',
        key: YOUTUBE_API_KEY,
      })
    );
    const data = await res.json();
    if (!data.items) continue;

    // Get view counts for these videos
    const ids = data.items.map((i: any) => i.id.videoId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      new URLSearchParams({
        part: 'statistics',
        id: ids,
        key: YOUTUBE_API_KEY,
      })
    );
    const statsData = await statsRes.json();
    const viewMap = new Map(
      (statsData.items || []).map((i: any) => [i.id, parseInt(i.statistics.viewCount || '0')])
    );

    for (const item of data.items) {
      allResults.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        viewCount: viewMap.get(item.id.videoId) || 0,
      });
    }
  }

  // Sort by views, return top 5
  allResults.sort((a, b) => b.viewCount - a.viewCount);
  return allResults.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/youtube/
git commit -m "feat: add YouTube trending Shorts audio discovery"
```

### Task 5: Create Claude metadata generator

**Files:**
- Create: `lib/curation/generate-metadata.ts`

- [ ] **Step 1: Create metadata generation module**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
}

export async function generateVideoMetadata(
  igUsername: string,
  igCaption: string | undefined,
  videoContext: string
): Promise<VideoMetadata> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are creating metadata for a YouTube Short video repost from Instagram.

Original creator: @${igUsername}
Original caption: ${igCaption || 'No caption'}
Video context: ${videoContext}

Generate:
1. A catchy YouTube Short title (under 100 chars, SEO-optimized, include emoji)
2. A description (2-3 sentences, credit @${igUsername}, mention gwdf.pro, engaging)
3. Exactly 5 hashtags that fit this specific video. Pick from contextually appropriate tags like: #flowarts #dance #edm #rave #hulahoop #poi #firedance #juggling #hooping #circus #festival #performance #firespinner #led #gloving

Respond in JSON format:
{"title": "...", "description": "...", "hashtags": ["flowarts", "dance", "edm", "rave", "hulahoop"]}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');

  return JSON.parse(jsonMatch[0]);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/curation/
git commit -m "feat: add Claude-powered metadata generation for curated videos"
```

## Chunk 3: Vercel Cron Discovery Route

### Task 6: Create the cron discovery API route

**Files:**
- Create: `app/api/cron/curate/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { discoverViralVideos } from '@/lib/instagram/hashtag-search';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 1. Discover viral videos
  const videos = await discoverViralVideos();
  if (videos.length === 0) {
    return NextResponse.json({ message: 'No new videos found' });
  }

  // 2. Filter out already-curated videos
  const mediaIds = videos.map(v => v.id);
  const { data: existing } = await supabase
    .from('curated_posts')
    .select('ig_media_id')
    .in('ig_media_id', mediaIds);
  const existingIds = new Set((existing || []).map(e => e.ig_media_id));
  const newVideos = videos.filter(v => !existingIds.has(v.id));

  // 3. Take top 3 new videos
  const toProcess = newVideos.slice(0, 3);

  // 4. Insert into curated_posts
  const rows = toProcess.map(v => ({
    ig_media_id: v.id,
    ig_username: v.username,
    ig_permalink: v.permalink,
    ig_like_count: v.like_count || 0,
    ig_media_url: v.media_url,
    status: 'pending',
    hashtags: [],
  }));

  if (rows.length > 0) {
    await supabase.from('curated_posts').insert(rows);
  }

  // 5. Trigger Railway worker for each pending post
  const railwayWebhookUrl = process.env.RAILWAY_WORKER_URL;
  if (railwayWebhookUrl && rows.length > 0) {
    await fetch(`${railwayWebhookUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAILWAY_WORKER_SECRET}`,
      },
      body: JSON.stringify({ count: rows.length }),
    });
  }

  return NextResponse.json({
    discovered: videos.length,
    new: toProcess.length,
    queued: rows.length,
  });
}
```

- [ ] **Step 2: Update vercel.json with cron schedule**

```json
{
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/curate",
      "schedule": "0 14 * * *"
    }
  ]
}
```

(Runs daily at 2 PM UTC / 10 AM ET)

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: add daily cron route for IG viral video discovery"
```

## Chunk 4: Railway Worker (FFmpeg + YouTube Upload)

### Task 7: Create Railway worker project

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/Dockerfile`
- Create: `worker/src/index.ts`
- Create: `worker/src/process.ts`
- Create: `worker/src/ffmpeg.ts`
- Create: `worker/src/youtube-upload.ts`

- [ ] **Step 1: Create worker/package.json**

```json
{
  "name": "flow-curation-worker",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@supabase/supabase-js": "^2.47.0",
    "express": "^4.21.0",
    "fluent-ffmpeg": "^2.1.3",
    "googleapis": "^144.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/fluent-ffmpeg": "^2.1.27",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create worker/Dockerfile**

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

- [ ] **Step 4: Create worker/src/ffmpeg.ts**

Handles: download video, strip audio, download YT audio, merge, ensure 9:16 ≤60s.

```typescript
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_DIR = path.join(os.tmpdir(), 'flow-curation');

export function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function downloadFile(url: string, filename: string): Promise<string> {
  ensureTmpDir();
  const filepath = path.join(TMP_DIR, filename);
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export async function stripAudio(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace('.mp4', '_silent.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noAudio()
      .videoCodec('copy')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

export async function mergeAudioVideo(videoPath: string, audioPath: string): Promise<string> {
  const outputPath = videoPath.replace('_silent.mp4', '_final.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-t 60', // Cap at 60s for Shorts
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

export function cleanup(...files: string[]) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}
```

- [ ] **Step 5: Create worker/src/youtube-upload.ts**

```typescript
import { google } from 'googleapis';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getYouTubeAuth() {
  const { data: connection } = await supabase
    .from('social_connections')
    .select('*')
    .eq('platform', 'youtube')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!connection) throw new Error('No YouTube connection found');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
  });

  // Auto-refresh if needed
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (credentials.access_token !== connection.access_token) {
    await supabase.from('social_connections').update({
      access_token: credentials.access_token,
      token_expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
    }).eq('id', connection.id);
  }

  return oauth2Client;
}

export async function uploadToYouTube(
  videoPath: string,
  title: string,
  description: string,
  tags: string[]
): Promise<string> {
  const auth = await getYouTubeAuth();
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: '24', // Entertainment
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  return res.data.id!;
}

export async function downloadYTAudio(videoId: string): Promise<string> {
  // Use yt-dlp to extract audio from a YT Short
  const { execSync } = require('child_process');
  const outputPath = `/tmp/flow-curation/${videoId}.mp3`;
  execSync(
    `yt-dlp -x --audio-format mp3 -o "${outputPath}" "https://youtube.com/shorts/${videoId}"`,
    { timeout: 60000 }
  );
  return outputPath;
}
```

- [ ] **Step 6: Create worker/src/process.ts**

Main orchestrator that processes pending curated posts.

```typescript
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { downloadFile, stripAudio, mergeAudioVideo, cleanup } from './ffmpeg';
import { uploadToYouTube, downloadYTAudio } from './youtube-upload';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

async function findTrendingAudio(): Promise<{ videoId: string; title: string }> {
  const queries = ['trending shorts music 2026', 'viral edm dance shorts', 'rave music shorts'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
    new URLSearchParams({
      part: 'snippet', q: query, type: 'video',
      videoDuration: 'short', order: 'viewCount', maxResults: '5',
      key: YOUTUBE_API_KEY,
    })
  );
  const data = await res.json();
  const top = data.items?.[0];
  if (!top) throw new Error('No trending audio found');
  return { videoId: top.id.videoId, title: top.snippet.title };
}

async function generateMetadata(igUsername: string, igCaption?: string) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Create YouTube Short metadata for a flow arts video repost.
Creator: @${igUsername} on Instagram
Caption: ${igCaption || 'Flow arts performance'}

Return JSON: {"title":"<catchy title under 100 chars with emoji>","description":"<2-3 sentences, credit @${igUsername}, mention gwdf.pro>","hashtags":["<5 contextual hashtags from: flowarts,dance,edm,rave,hulahoop,poi,firedance,juggling,hooping,circus,festival,performance,firespinner,led,gloving>"]}`
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
}

export async function processAllPending() {
  const { data: pending } = await supabase
    .from('curated_posts')
    .select('*')
    .eq('status', 'pending')
    .order('ig_like_count', { ascending: false })
    .limit(3);

  if (!pending?.length) return { processed: 0 };

  let processed = 0;

  for (const post of pending) {
    try {
      // Update status
      await supabase.from('curated_posts').update({ status: 'processing' }).eq('id', post.id);

      // 1. Download IG video
      const videoPath = await downloadFile(post.ig_media_url, `${post.ig_media_id}.mp4`);

      // 2. Strip audio
      const silentPath = await stripAudio(videoPath);

      // 3. Find trending audio
      await supabase.from('curated_posts').update({ status: 'audio_search' }).eq('id', post.id);
      const audio = await findTrendingAudio();
      const audioPath = await downloadYTAudio(audio.videoId);

      // 4. Merge
      await supabase.from('curated_posts').update({ status: 'merging' }).eq('id', post.id);
      const finalPath = await mergeAudioVideo(silentPath, audioPath);

      // 5. Generate metadata
      const metadata = await generateMetadata(post.ig_username);

      // 6. Upload to YouTube
      await supabase.from('curated_posts').update({ status: 'uploading' }).eq('id', post.id);
      const hashtagStr = metadata.hashtags.map((h: string) => `#${h}`).join(' ');
      const ytVideoId = await uploadToYouTube(
        finalPath,
        metadata.title,
        `${metadata.description}\n\n${hashtagStr}\n\nOriginal: ${post.ig_permalink}\n🌊 Discover more at gwdf.pro`,
        metadata.hashtags,
      );

      // 7. Update record
      await supabase.from('curated_posts').update({
        status: 'posted',
        youtube_video_id: ytVideoId,
        youtube_audio_id: audio.videoId,
        youtube_audio_title: audio.title,
        title: metadata.title,
        description: metadata.description,
        hashtags: metadata.hashtags,
      }).eq('id', post.id);

      // Cleanup temp files
      cleanup(videoPath, silentPath, audioPath, finalPath);
      processed++;

    } catch (err: any) {
      await supabase.from('curated_posts').update({
        status: 'failed',
        error_message: err.message,
      }).eq('id', post.id);
    }
  }

  return { processed };
}
```

- [ ] **Step 7: Create worker/src/index.ts**

```typescript
import express from 'express';
import { processAllPending } from './process';

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.RAILWAY_WORKER_SECRET;

app.post('/process', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const result = await processAllPending();
  res.json(result);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Worker listening on port ${PORT}`));
```

- [ ] **Step 8: Commit**

```bash
git add worker/
git commit -m "feat: add Railway worker for video processing + YouTube upload"
```

## Chunk 5: Environment Variables + Display on Feed

### Task 8: Update .env.example with new vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env vars to .env.example**

Add:
```
# ── Curation Pipeline ─────────────────────────────────────────
CRON_SECRET=
RAILWAY_WORKER_URL=
RAILWAY_WORKER_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add curation pipeline env vars to .env.example"
```

### Task 9: Display curated posts on dashboard feed

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add curated posts section to dashboard feed**

Replace or supplement the SAMPLE_FEED with real curated posts from Supabase. Add a "Trending on Instagram" section that shows posted curated content with YouTube embed links and creator attribution.

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: display curated viral content on dashboard feed"
```
