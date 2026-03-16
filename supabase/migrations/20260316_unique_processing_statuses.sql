-- Add unique processing statuses per agent so stuck posts can be recovered on restart
ALTER TABLE curated_posts DROP CONSTRAINT IF EXISTS curated_posts_status_check;
ALTER TABLE curated_posts ADD CONSTRAINT curated_posts_status_check
  CHECK (status IN (
    'pending','downloading','downloaded',
    'audio_search','audio_ready',
    'editing','edited',
    'writing','metadata_ready',
    'uploading','posted','failed',
    'music_added',
    -- Legacy (safe to keep for backwards compat)
    'processing','merging'
  ));

-- Columns needed by music-adder and publisher agents
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS ig_reels_id TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS ig_reels_audio TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS fb_reels_id TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS fb_reels_audio TEXT;

-- Auto-update updated_at on row changes (needed for publisher daily rate limit)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS curated_posts_updated_at ON curated_posts;
CREATE TRIGGER curated_posts_updated_at
  BEFORE UPDATE ON curated_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
