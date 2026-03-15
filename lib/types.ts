// ── Database Types ─────────────────────────────────────────────────────────

export type VideoStatus =
  | 'uploading'
  | 'processing'
  | 'stripping_audio'
  | 'generating_captions'
  | 'fetching_music'
  | 'merging'
  | 'transcoding'
  | 'ready'
  | 'posting'
  | 'posted'
  | 'failed';

export type Platform = 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'threads';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export type PerformerType = 'flow_artist' | 'dj' | 'painter' | 'vj' | 'event_producer';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_color: string | null;
  flow_toys: string[];
  location: string | null;
  website: string | null;
  instagram_username: string | null;
  instagram_id: string | null;
  performer_type: PerformerType;
  is_available_for_gigs: boolean;
  profile_complete: boolean;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  videos_this_month: number;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  original_storage_path: string;
  processed_storage_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  status: VideoStatus;
  captions_srt: string | null;
  captions_vtt: string | null;
  hashtags: string[];
  music_track_id: string | null;
  music_track_title: string | null;
  music_source: 'youtube_audio_library' | 'custom' | null;
  target_platforms: Platform[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialConnection {
  id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_username: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  page_id: string | null; // For Facebook Pages / IG Business
  page_name: string | null;
  is_active: boolean;
  connected_at: string;
  updated_at: string;
}

export interface VideoPost {
  id: string;
  video_id: string;
  platform: Platform;
  platform_post_id: string | null;
  platform_post_url: string | null;
  status: 'queued' | 'uploading' | 'processing' | 'posted' | 'failed';
  error_message: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface VideoJob {
  id: string;
  video_id: string;
  job_type: 'strip_audio' | 'generate_captions' | 'fetch_music' | 'merge_audio' | 'transcode' | 'post';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  platform: Platform | null;
  progress: number;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

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

export interface MusicTrack {
  id: string;
  youtube_video_id: string;
  title: string;
  artist: string;
  genre: string | null;
  mood: string | null;
  duration_seconds: number;
  preview_url: string | null;
  download_url: string;
  license: string;
  trending_score: number;
  fetched_at: string;
}

// ── API Types ──────────────────────────────────────────────────────────────

export interface UploadResponse {
  video_id: string;
  upload_url: string;
  storage_path: string;
}

export interface CaptionResponse {
  srt: string;
  vtt: string;
  word_timestamps: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface HashtagResponse {
  hashtags: string[];
  trending: string[];
  niche: string[];
  platform_specific: Record<Platform, string[]>;
}

export interface MusicSearchResponse {
  tracks: MusicTrack[];
  recommended: MusicTrack | null;
}

export interface ProcessingStatus {
  video_id: string;
  overall_status: VideoStatus;
  jobs: VideoJob[];
  posts: VideoPost[];
}

// ── Component Props ────────────────────────────────────────────────────────

export interface VideoCardProps {
  video: Video;
  posts: VideoPost[];
  onRetry?: (videoId: string, platform: Platform) => void;
}

export interface UploadFormData {
  title: string;
  description: string;
  target_platforms: Platform[];
  music_track_id: string | null;
  auto_captions: boolean;
  auto_hashtags: boolean;
  auto_music: boolean;
}
