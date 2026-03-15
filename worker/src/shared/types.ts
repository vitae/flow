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
  ig_reels_id: string | null;
  ig_reels_audio: string | null;
  fb_reels_id: string | null;
  fb_reels_audio: string | null;
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

export type AgentName = 'scout' | 'downloader' | 'audio_engineer' | 'editor' | 'copywriter' | 'publisher' | 'music_adder';

export interface AgentConfig {
  name: AgentName;
  inputStatus: string;
  processingStatus: string;
  outputStatus: string;
  pollIntervalMs: number;
  batchSize: number;
}
