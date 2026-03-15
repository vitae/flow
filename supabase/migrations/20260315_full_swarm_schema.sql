-- ============================================
-- DISCOVERED CREATORS
-- ============================================
CREATE TABLE IF NOT EXISTS discovered_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- 'instagram', 'youtube', 'tiktok'
  platform_user_id TEXT,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  follower_count INTEGER DEFAULT 0,
  total_videos_found INTEGER DEFAULT 0,
  ranking_score REAL DEFAULT 0,
  category TEXT DEFAULT 'general', -- 'fire', 'led', 'poi', 'hoop', 'staff', 'general'
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, username)
);
CREATE INDEX IF NOT EXISTS idx_creators_platform ON discovered_creators(platform);
CREATE INDEX IF NOT EXISTS idx_creators_ranking ON discovered_creators(ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_creators_category ON discovered_creators(category);

-- ============================================
-- DISCOVERED VIDEOS (expanded from curated_posts)
-- ============================================
-- Keep curated_posts as-is for backwards compat, add discovered_videos as the new intake
CREATE TABLE IF NOT EXISTS discovered_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  creator_id UUID REFERENCES discovered_creators(id),
  creator_username TEXT NOT NULL,
  video_url TEXT,
  permalink TEXT NOT NULL,
  caption TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  duration_seconds REAL,
  virality_score REAL DEFAULT 0,
  status TEXT DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'queued', 'downloading', 'downloaded',
    'processing', 'audio_ready', 'edited', 'metadata_ready',
    'publishing', 'published', 'failed', 'rejected'
  )),
  failed_at_stage TEXT,
  error_message TEXT,
  -- Storage paths
  raw_video_path TEXT,        -- Supabase Storage path
  processed_video_path TEXT,  -- after trim + format
  final_video_path TEXT,      -- after music overlay
  thumbnail_path TEXT,
  -- Processing metadata
  video_duration REAL,
  clip_start_seconds REAL,
  clip_end_seconds REAL,
  -- Music
  audio_track_id UUID,
  -- Publishing metadata
  title TEXT,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  seo_keywords TEXT[] DEFAULT '{}',
  -- Published IDs per platform
  youtube_video_id TEXT,
  tiktok_video_id TEXT,
  ig_reel_id TEXT,
  website_post_id TEXT,
  -- Timestamps
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(platform, platform_video_id)
);
CREATE INDEX IF NOT EXISTS idx_dv_status ON discovered_videos(status);
CREATE INDEX IF NOT EXISTS idx_dv_virality ON discovered_videos(virality_score DESC);
CREATE INDEX IF NOT EXISTS idx_dv_platform ON discovered_videos(platform);
CREATE INDEX IF NOT EXISTS idx_dv_creator ON discovered_videos(creator_id);

-- ============================================
-- USED AUDIO TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS used_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL DEFAULT 'youtube',
  source_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  duration_seconds REAL,
  genre TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  video_id UUID REFERENCES discovered_videos(id),
  UNIQUE(source_video_id)
);
CREATE INDEX IF NOT EXISTS idx_audio_used_at ON used_audio(used_at DESC);

-- ============================================
-- ENGAGEMENT TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES discovered_videos(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  watch_time_hours REAL DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_engagement_video ON engagement_snapshots(video_id);
CREATE INDEX IF NOT EXISTS idx_engagement_time ON engagement_snapshots(snapshot_at DESC);

-- ============================================
-- LEADERBOARDS
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES discovered_creators(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN (
    'top_flow_artists', 'top_fire_spinners', 'top_led_performers',
    'top_rising_artists', 'weekly_trending', 'monthly_trending'
  )),
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, leaderboard_type, period_start)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_type ON leaderboard_entries(leaderboard_type, rank);

-- ============================================
-- BATTLES & CHALLENGES
-- ============================================
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_a_id UUID REFERENCES discovered_creators(id),
  creator_b_id UUID REFERENCES discovered_creators(id),
  video_a_id UUID REFERENCES discovered_videos(id),
  video_b_id UUID REFERENCES discovered_videos(id),
  votes_a INTEGER DEFAULT 0,
  votes_b INTEGER DEFAULT 0,
  winner_id UUID REFERENCES discovered_creators(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'voting', 'completed')),
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'fire_spin', 'led_flow', 'festival_performance'
  hashtag TEXT NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'voting', 'completed')),
  winner_id UUID REFERENCES discovered_creators(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES discovered_creators(id),
  video_id UUID REFERENCES discovered_videos(id),
  votes INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
