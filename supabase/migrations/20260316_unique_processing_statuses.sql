-- Add unique processing statuses per agent so stuck posts can be recovered on restart
ALTER TABLE curated_posts DROP CONSTRAINT IF EXISTS curated_posts_status_check;
ALTER TABLE curated_posts ADD CONSTRAINT curated_posts_status_check
  CHECK (status IN (
    'pending','downloading','downloaded',
    'audio_search','audio_ready',
    'editing','edited',
    'writing','metadata_ready',
    'uploading','posted','failed',
    -- Legacy (safe to keep for backwards compat)
    'processing','merging'
  ));
