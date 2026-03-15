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
