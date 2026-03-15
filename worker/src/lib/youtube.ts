import { google } from 'googleapis';
import fs from 'fs';
import { execSync } from 'child_process';
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
  const outputPath = `/tmp/flow-curation/${videoId}.mp3`;

  // Update yt-dlp first (in case it's outdated)
  try {
    execSync('yt-dlp --update 2>&1 || true', { timeout: 30000 });
  } catch {}

  const cmd = [
    'yt-dlp',
    '-x',
    '--audio-format mp3',
    '--audio-quality 192K',
    '--no-check-certificates',
    '--force-overwrites',
    '--no-playlist',
    '--no-warnings',
    `-o "${outputPath}"`,
    `"https://www.youtube.com/watch?v=${videoId}"`,
  ].join(' ');

  console.log(`[youtube] Downloading audio: ${cmd}`);

  try {
    const result = execSync(cmd, { timeout: 120000, encoding: 'utf-8' });
    console.log(`[youtube] yt-dlp output: ${result.slice(0, 500)}`);
  } catch (err: any) {
    console.error(`[youtube] yt-dlp failed:`, err.stderr?.slice(0, 500) || err.message);
    throw new Error(`yt-dlp audio download failed: ${err.message}`);
  }

  if (!fs.existsSync(outputPath)) {
    // yt-dlp sometimes appends extra extension
    const altPath = outputPath.replace('.mp3', '.mp3.mp3');
    if (fs.existsSync(altPath)) {
      fs.renameSync(altPath, outputPath);
    } else {
      throw new Error(`Audio file not found at ${outputPath}`);
    }
  }

  const size = fs.statSync(outputPath).size;
  console.log(`[youtube] Downloaded audio: ${outputPath} (${size} bytes)`);

  if (size < 1000) {
    throw new Error(`Audio file too small (${size} bytes)`);
  }

  return outputPath;
}
