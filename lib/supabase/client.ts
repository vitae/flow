import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ── Browser Client (for Client Components) ─────────────────────────────────
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // During build/prerender, env vars may not be available
    // Return a dummy client that will be replaced at runtime
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }
  return createBrowserClient(url, key);
}

// ── Server Client (for API Routes & Server Components) ─────────────────────
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── Storage helpers ────────────────────────────────────────────────────────
export async function getUploadUrl(path: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

export async function getPublicUrl(path: string) {
  const supabase = createServerClient();
  const { data } = supabase.storage.from('videos').getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(path: string, expiresIn = 3600) {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
