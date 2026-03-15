'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-flow-gray-400 hover:text-flow-green transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-flow-green flex items-center justify-center">
              <span className="font-display font-black text-black">F</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Welcome to Flow</h1>
              <p className="text-flow-gray-400 text-sm">Sign in to start uploading</p>
            </div>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-flow-green mx-auto mb-4" />
              <h2 className="font-display font-semibold text-lg mb-2">Check your email</h2>
              <p className="text-flow-gray-400 text-sm">
                We sent a magic link to <span className="text-flow-green">{email}</span>
              </p>
            </div>
          ) : (
            <>
              {/* OAuth */}
              <div className="space-y-3 mb-6">
                <button onClick={() => handleOAuth('google')} className="btn-secondary w-full">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>
                <button onClick={() => handleOAuth('facebook')} className="btn-secondary w-full">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Continue with Facebook
                </button>
                <button onClick={() => handleOAuth('facebook')} className="btn-secondary w-full">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FD5"/><stop offset="25%" stopColor="#FF543E"/><stop offset="50%" stopColor="#C837AB"/><stop offset="100%" stopColor="#5B51D8"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#ig)" strokeWidth="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="url(#ig)" strokeWidth="2"/><circle cx="18" cy="6" r="1.5" fill="url(#ig)"/></svg>
                  Continue with Instagram
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-flow-gray-700" />
                <span className="text-flow-gray-500 text-xs uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-flow-gray-700" />
              </div>

              {/* Magic Link */}
              <form onSubmit={handleMagicLink} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-field"
                  required
                />
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send magic link
                </button>
                <p className="text-flow-gray-500 text-xs text-center">
                  No password needed — we&apos;ll email you a secure sign-in link
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
