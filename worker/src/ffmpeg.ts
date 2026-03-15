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

  if (url.includes('instagram.com')) {
    return downloadFromInstagram(url, filepath);
  }

  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

function shortcodeToMediaId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (const ch of shortcode) {
    id = id * BigInt(64) + BigInt(alphabet.indexOf(ch));
  }
  return id.toString();
}

async function downloadFromInstagram(permalink: string, outputPath: string): Promise<string> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) throw new Error('INSTAGRAM_SESSION_ID env var is required');

  // Extract shortcode from permalink (e.g. /reel/DV36opEiJPU/)
  const shortcode = permalink.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)?.[2];
  if (!shortcode) throw new Error(`Cannot extract shortcode from: ${permalink}`);

  const mediaId = shortcodeToMediaId(shortcode);
  console.log('Fetching IG media:', shortcode, '→', mediaId);

  // Use Instagram's private API to get video info
  const res = await fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
    headers: {
      'Cookie': `sessionid=${sessionId}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'X-IG-App-ID': '936619743392459',
    },
  });

  if (!res.ok) {
    throw new Error(`IG API returned ${res.status}. Session may have expired.`);
  }

  const data = await res.json();
  const item = data?.items?.[0];

  if (!item?.video_versions?.length) {
    throw new Error('No video versions found — media may not be a video');
  }

  // Pick highest resolution
  const best = item.video_versions.sort((a: any, b: any) =>
    (b.width * b.height) - (a.width * a.height)
  )[0];
  console.log('Found video:', best.width, 'x', best.height);

  return downloadCdnVideo(best.url, outputPath);
}

async function downloadCdnVideo(videoUrl: string, outputPath: string): Promise<string> {
  const res = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) throw new Error(`CDN download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log('Downloaded video:', outputPath, 'size:', buffer.length);

  if (buffer.length < 10000) {
    throw new Error(`Downloaded file too small (${buffer.length} bytes), likely not a video`);
  }

  return outputPath;
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
        '-t 60',
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
