'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { X, Loader2, Droplets } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutModalProps {
  priceId: string;
  mode: 'subscription' | 'payment';
  planName: string;
  planPrice: string;
  accentColor: string;
  onClose: () => void;
}

export default function CheckoutModal({ priceId, mode, planName, planPrice, accentColor, onClose }: CheckoutModalProps) {
  const checkoutRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initCheckout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId, mode }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const stripe = await stripePromise;
      if (!stripe || !checkoutRef.current) return;

      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret: data.clientSecret,
      });

      checkout.mount(checkoutRef.current);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }, [priceId, mode]);

  useEffect(() => {
    initCheckout();
  }, [initCheckout]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-flow-dark border shadow-2xl"
        style={{ borderColor: accentColor + '30' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-flow-gray-800 bg-flow-dark/95 backdrop-blur-sm rounded-t-2xl">
          <div>
            <h3 className="font-display font-bold text-lg" style={{ color: accentColor }}>
              {planName}
            </h3>
            <p className="text-xs text-flow-gray-400">
              {planPrice}{mode === 'subscription' ? '/mo' : ' one-time'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-flow-gray-400 hover:text-white hover:bg-flow-gray-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 min-h-[300px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
              <p className="text-sm text-flow-gray-400">Loading secure checkout...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-flow-red">{error}</p>
              <button onClick={initCheckout} className="text-xs text-flow-green hover:underline">
                Try again
              </button>
            </div>
          )}

          <div ref={checkoutRef} />
        </div>

        <div className="px-6 py-3 border-t border-flow-gray-800 flex items-center justify-between">
          <span className="text-[10px] text-flow-gray-500">Secured by Stripe</span>
          <span className="text-flow-cyan text-[10px] font-display font-medium flex items-center gap-1">
            <Droplets className="w-2.5 h-2.5" /> Stay Hydrated!
          </span>
        </div>
      </div>
    </div>
  );
}
