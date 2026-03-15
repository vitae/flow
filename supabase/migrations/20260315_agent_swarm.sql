-- Agent swarm: add new statuses and columns
ALTER TABLE curated_posts DROP CONSTRAINT IF EXISTS curated_posts_status_check;
ALTER TABLE curated_posts ADD CONSTRAINT curated_posts_status_check
  CHECK (status IN (
    'pending','downloaded','audio_ready','edited','metadata_ready',
    'processing','audio_search','merging','uploading','posted','failed'
  ));

ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS failed_at_stage TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE curated_posts ADD COLUMN IF NOT EXISTS video_duration REAL;
