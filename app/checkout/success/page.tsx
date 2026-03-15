'use client';

import Link from 'next/link';
import { Check, ArrowRight, Instagram, Mail, Sparkles } from 'lucide-react';

export default function CheckoutSuccess() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-flow-green/10 border-2 border-flow-green/30 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-flow-green" />
        </div>
        <h1 className="font-display font-black text-3xl mb-3">Payment Successful!</h1>
        <p className="text-flow-gray-300 mb-6">
          You&apos;re in. Now let&apos;s set up your profile so promoters and artists can find you.
        </p>

        {/* What happens next */}
        <div className="glass-card p-5 mb-6 text-left space-y-3">
          <p className="text-xs text-flow-gray-500 uppercase tracking-wider font-semibold text-center mb-2">What happens next</p>
          <div className="flex items-start gap-3">
            <Instagram className="w-5 h-5 text-flow-magenta shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Connect Instagram</p>
              <p className="text-xs text-flow-gray-400">Your name, photo, and bio import automatically</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-flow-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Choose your path</p>
              <p className="text-xs text-flow-gray-400">Flow Artist, DJ, Painter, VJ, or Event Producer</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-flow-green shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Get discovered</p>
              <p className="text-xs text-flow-gray-400">Promoters find you by location, artists connect with you</p>
            </div>
          </div>
        </div>

        <Link href="/auth/login" className="btn-primary text-lg px-8 py-4 w-full justify-center">
          Create Your Profile <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-[10px] text-flow-gray-500 mt-3">
          Sign in with Instagram for the fastest setup — or use email
        </p>
      </div>
    </main>
  );
}
