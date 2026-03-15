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
