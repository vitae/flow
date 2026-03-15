import { getSupabase } from './supabase';

export async function logActivity(
  agent: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  try {
    await getSupabase().from('agent_activity').insert({
      agent,
      action,
      details,
    });
  } catch (err: any) {
    // Non-fatal — don't let logging break agents
    console.error(`[activity-log] Failed to log ${agent}/${action}:`, err.message);
  }
}
