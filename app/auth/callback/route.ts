import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createServerClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.session) {
      const userId = sessionData.session.user.id;
      const metadata = sessionData.session.user.user_metadata;

      // Enrich profile with OAuth metadata (Instagram/Facebook/Google)
      if (metadata) {
        const updates: Record<string, unknown> = {};

        // Pull display name from OAuth
        if (metadata.full_name || metadata.name) {
          updates.display_name = metadata.full_name || metadata.name;
        }

        // Pull avatar
        if (metadata.avatar_url || metadata.picture) {
          updates.avatar_url = metadata.avatar_url || metadata.picture;
        }

        // Pull Instagram username if available
        if (metadata.preferred_username) {
          updates.instagram_username = metadata.preferred_username;
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from('users').update(updates).eq('id', userId);
        }
      }

      // Check if profile is complete — if not, send to onboarding
      const { data: user } = await supabase
        .from('users')
        .select('profile_complete')
        .eq('id', userId)
        .single();

      if (user && !user.profile_complete) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
