import { google } from 'googleapis';
import fs from 'fs';
import { execSync } from 'child_process';
import ytdl from '@distube/ytdl-core';
import { getSupabase } from '../shared/supabase';
import { ensureTmpDir } from './ffmpeg';

async function getYouTubeAuth() {
  const supabase = getSupabase();
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
  ensureTmpDir();
  const outputPath = `/tmp/flow-curation/${videoId}.mp4`;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[youtube] Downloading audio via ytdl-core: ${videoId}`);

  // Try Node.js native ytdl-core first (most reliable on Railway)
  try {
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
    });
    const writeStream = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      // Timeout after 60 seconds
      setTimeout(() => reject(new Error('ytdl-core download timed out')), 60000);
    });

    const size = fs.statSync(outputPath).size;
    console.log(`[youtube] ytdl-core downloaded: ${outputPath} (${size} bytes)`);

    if (size < 1000) throw new Error(`Audio file too small (${size} bytes)`);
    return outputPath;
  } catch (ytdlErr: any) {
    console.error(`[youtube] ytdl-core failed: ${ytdlErr.message}`);
  }

  // Fallback to yt-dlp CLI
  const mp3Path = outputPath.replace('.mp4', '.mp3');
  try {
    const cmd = `yt-dlp -x --audio-format mp3 --no-check-certificates --force-overwrites --no-playlist -o "${mp3Path}" "${url}"`;
    console.log(`[youtube] Falling back to yt-dlp CLI...`);
    execSync(cmd, { timeout: 120000, encoding: 'utf-8' });

    if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
      console.log(`[youtube] yt-dlp succeeded: ${mp3Path}`);
      return mp3Path;
    }
  } catch (err: any) {
    console.error(`[youtube] yt-dlp also failed: ${err.message}`);
  }

  throw new Error(`All audio download methods failed for ${videoId}`);
}
