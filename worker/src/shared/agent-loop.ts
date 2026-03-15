import { getSupabase } from './supabase';
import { AgentConfig, CuratedPost } from './types';

export function createAgentLoop(
  config: AgentConfig,
  processOne: (post: CuratedPost) => Promise<Partial<CuratedPost>>
) {
  const supabase = getSupabase();

  async function tick(): Promise<number> {
    const { data: posts } = await supabase
      .from('curated_posts')
      .select('*')
      .eq('status', config.inputStatus)
      .order('ig_like_count', { ascending: false })
      .limit(config.batchSize);

    if (!posts?.length) return 0;

    let processed = 0;
    for (const post of posts) {
      try {
        // Claim the post (optimistic lock)
        const { error: claimError } = await supabase
          .from('curated_posts')
          .update({ status: config.processingStatus })
          .eq('id', post.id)
          .eq('status', config.inputStatus);

        if (claimError) {
          console.log(`[${config.name}] Could not claim ${post.id}, skipping`);
          continue;
        }

        const updates = await processOne(post as CuratedPost);
        await supabase
          .from('curated_posts')
          .update({ ...updates, status: config.outputStatus, error_message: null })
          .eq('id', post.id);

        processed++;
        console.log(`[${config.name}] ✓ ${post.id} → ${config.outputStatus}`);
      } catch (err: any) {
        console.error(`[${config.name}] ✗ ${post.id}:`, err.message);
        await supabase
          .from('curated_posts')
          .update({
            status: 'failed',
            error_message: err.message,
            failed_at_stage: config.name,
          })
          .eq('id', post.id);
      }
    }
    return processed;
  }

  function start() {
    console.log(`[${config.name}] Agent started — polling every ${config.pollIntervalMs / 1000}s for "${config.inputStatus}"`);
    // Run immediately on start
    tick().catch(err => console.error(`[${config.name}] Initial tick error:`, err.message));
    // Then poll
    setInterval(async () => {
      try {
        await tick();
      } catch (err: any) {
        console.error(`[${config.name}] Tick error:`, err.message);
      }
    }, config.pollIntervalMs);
  }

  return { tick, start };
}
