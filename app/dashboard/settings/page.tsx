'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Crown, Loader2, User, Shield } from 'lucide-react';
import type { User as FlowUser } from '@/lib/types';

export default function SettingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<FlowUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (data) setUser(data as FlowUser);
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleUpgrade = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ price_id: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID }),
      });

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error('Failed to start checkout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-flow-green" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl mb-1">Settings</h1>
        <p className="text-flow-gray-400 text-sm">Manage your account and subscription</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-flow-green" />
          <h2 className="font-display font-semibold">Profile</h2>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-flow-gray-800">
            <span className="text-sm text-flow-gray-400">Email</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-flow-gray-800">
            <span className="text-sm text-flow-gray-400">Display name</span>
            <span className="text-sm">{user?.display_name || '—'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-flow-gray-400">Videos this month</span>
            <span className="text-sm">{user?.videos_this_month || 0}</span>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-5 h-5 text-flow-magenta" />
          <h2 className="font-display font-semibold">Subscription</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`status-badge border ${
                user?.subscription_tier === 'pro'
                  ? 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20'
                  : 'bg-flow-gray-800 text-flow-gray-400 border-flow-gray-700'
              }`}>
                {user?.subscription_tier === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
            <p className="text-sm text-flow-gray-400">
              {user?.subscription_tier === 'pro'
                ? 'Unlimited videos, all platforms, trending music & hashtags'
                : '3 videos/month, 2 platforms max'}
            </p>
          </div>
          {user?.subscription_tier !== 'pro' && (
            <button onClick={handleUpgrade} className="btn-magenta text-sm">
              <CreditCard className="w-4 h-4" /> Upgrade to Pro
            </button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-flow-red/10">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-flow-red" />
          <h2 className="font-display font-semibold text-flow-red">Danger zone</h2>
        </div>
        <p className="text-sm text-flow-gray-400 mb-4">
          Deleting your account will permanently remove all your videos, connections, and data.
        </p>
        <button className="text-sm text-flow-red border border-flow-red/20 rounded-lg px-4 py-2 hover:bg-flow-red/10 transition-colors">
          Delete account
        </button>
      </div>
    </div>
  );
}
