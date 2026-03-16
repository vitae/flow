import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSupabase } from '../shared/supabase';

const TMP_DIR = path.join(os.tmpdir(), 'flow-curation');

export function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Ensures video_path points to a local file. If the path is a Supabase Storage
 * path (e.g. "uploads/uuid.mp4"), downloads it to /tmp first.
 * Returns the local file path.
 */
export async function ensureLocalFile(storagePath: string): Promise<string> {
  // Already a local path (from the downloader agent)
  if (path.isAbsolute(storagePath) && fs.existsSync(storagePath)) {
    return storagePath;
  }

  ensureTmpDir();
  const localPath = path.join(TMP_DIR, path.basename(storagePath));

  // Already downloaded in a previous step
  if (fs.existsSync(localPath)) {
    console.log(`[ensureLocalFile] Already cached: ${localPath}`);
    return localPath;
  }

  console.log(`[ensureLocalFile] Downloading from Supabase Storage: ${storagePath}`);
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from('videos').download(storagePath);
  if (error) throw new Error(`Storage download failed: ${error.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length < 10000) {
    throw new Error(`Downloaded file too small (${buffer.length} bytes), likely not a video`);
  }

  fs.writeFileSync(localPath, buffer);
  console.log(`[ensureLocalFile] Downloaded: ${localPath} (${buffer.length} bytes)`);
  return localPath;
}

export async function downloadFile(url: string, filename: string): Promise<string> {
  ensureTmpDir();
  const filepath = path.join(TMP_DIR, filename);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  console.log(`Downloaded: ${filepath} (${buffer.length} bytes)`);

  if (buffer.length < 10000) {
    throw new Error(`File too small (${buffer.length} bytes), likely not a video`);
  }

  return filepath;
}

export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export async function getVideoResolution(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(err);
      const stream = metadata.streams?.find((s: any) => s.codec_type === 'video');
      if (!stream) return reject(new Error('No video stream found'));
      resolve({ width: stream.width, height: stream.height });
    });
  });
}

export async function stripAudio(inputPath: string): Promise<string> {
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '_silent.mp4');
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
  const outputPath = videoPath.replace('_silent.mp4', '_final.mp4').replace(/\.[^.]+$/, '.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Converts a horizontal/square video to vertical 9:16 by center-cropping.
 * Already-vertical videos are returned as-is.
 */
export async function ensureVertical(inputPath: string): Promise<string> {
  const { width, height } = await getVideoResolution(inputPath);
  const aspectRatio = width / height;

  // Already vertical (aspect ratio < 1, e.g. 9:16 = 0.5625)
  if (aspectRatio <= 1.0) {
    console.log(`Video already vertical (${width}x${height}), no crop needed`);
    return inputPath;
  }

  // Horizontal or square — center-crop to 9:16
  const targetWidth = Math.floor(height * 9 / 16);
  const cropW = Math.min(targetWidth, width);
  const cropX = Math.floor((width - cropW) / 2);

  console.log(`Cropping ${width}x${height} → ${cropW}x${height} (center crop to vertical)`);
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '_vertical.mp4');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(`crop=${cropW}:${height}:${cropX}:0`)
      .videoCodec('libx264')
      .outputOptions(['-preset', 'fast', '-crf', '23'])
      .noAudio()
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

export async function trimToShorts(inputPath: string, maxDuration: number = 180): Promise<string> {
  const duration = await getVideoDuration(inputPath);
  if (duration <= maxDuration) {
    console.log(`Video already ${duration.toFixed(1)}s, no trim needed`);
    return inputPath;
  }

  console.log(`Trimming ${duration.toFixed(1)}s → ${maxDuration}s`);
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '_trimmed.mp4');
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

/**
 * Uploads a local file back to Supabase Storage so it survives worker restarts.
 */
export async function uploadToStorage(localPath: string, storagePath: string): Promise<string> {
  const supabase = getSupabase();
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from('videos')
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  console.log(`[storage] Uploaded ${localPath} → ${storagePath} (${buffer.length} bytes)`);
  return storagePath;
}

export function cleanup(...files: string[]) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}
