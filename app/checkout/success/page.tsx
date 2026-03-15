'use client';

import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';

export default function CheckoutSuccess() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-flow-green/10 border-2 border-flow-green/30 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-flow-green" />
        </div>
        <h1 className="font-display font-black text-3xl mb-3">You&apos;re in!</h1>
        <p className="text-flow-gray-300 mb-8">
          Welcome to the GWDF community. Your payment was successful and your account is ready to go.
        </p>
        <Link href="/auth/login" className="btn-primary text-lg px-8 py-4">
          Enter the Platform <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </main>
  );
}
