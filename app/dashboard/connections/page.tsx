'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Link2, Unlink, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import type { SocialConnection, Platform } from '@/lib/types';

const platformConfig: Record<Platform, { label: string; color: string; bgColor: string }> = {
  youtube: { label: 'YouTube', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/20' },
  instagram: { label: 'Instagram', color: 'text-pink-500', bgColor: 'bg-pink-500/10 border-pink-500/20' },
  facebook: { label: 'Facebook', color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/20' },
  twitter: { label: 'X / Twitter', color: 'text-gray-300', bgColor: 'bg-gray-500/10 border-gray-500/20' },
  threads: { label: 'Threads', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
};

export default function ConnectionsPage() {
  const supabase = createClient();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Platform | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', session.user.id);
    if (data) setConnections(data as SocialConnection[]);
    setLoading(false);
  };

  const handleConnect = async (platform: Platform) => {
    setConnecting(platform);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Redirect to OAuth flow
      const res = await fetch(`/api/oauth/${platform}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const { auth_url } = await res.json();
      window.location.href = auth_url;
    } catch (err: any) {
      toast.error(`Failed to connect ${platform}: ${err.message}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: Platform) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from('social_connections')
      .delete()
      .eq('user_id', session.user.id)
      .eq('platform', platform);
    setConnections(prev => prev.filter(c => c.platform !== platform));
    toast.success(`Disconnected ${platformConfig[platform].label}`);
  };

  const getConnection = (platform: Platform) => connections.find(c => c.platform === platform);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl mb-1">Connected accounts</h1>
        <p className="text-flow-gray-400 text-sm">Connect your social platforms to enable auto-posting</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-flow-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading connections...
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.keys(platformConfig) as Platform[]).filter(p => p !== 'twitter').map((platform) => {
            const conn = getConnection(platform);
            const config = platformConfig[platform];
            const isConnecting = connecting === platform;

            return (
              <div key={platform} className={`glass-card p-5 transition-all ${conn ? 'border-flow-green/20' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${config.bgColor} border flex items-center justify-center`}>
                      <span className={`font-display font-bold text-lg ${config.color}`}>
                        {config.label[0]}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold">{config.label}</h3>
                        {conn && <CheckCircle className="w-4 h-4 text-flow-green" />}
                      </div>
                      {conn ? (
                        <p className="text-sm text-flow-gray-400">
                          Connected as <span className={config.color}>@{conn.platform_username || conn.platform_user_id}</span>
                          {conn.page_name && <span className="text-flow-gray-500"> • {conn.page_name}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-flow-gray-500">Not connected</p>
                      )}
                    </div>
                  </div>

                  {conn ? (
                    <button
                      onClick={() => handleDisconnect(platform)}
                      className="flex items-center gap-2 text-sm text-flow-gray-400 hover:text-flow-red transition-colors border border-flow-gray-700 rounded-lg px-4 py-2"
                    >
                      <Unlink className="w-4 h-4" /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                      className="btn-secondary text-sm py-2"
                    >
                      {isConnecting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                      ) : (
                        <><Link2 className="w-4 h-4" /> Connect</>
                      )}
                    </button>
                  )}
                </div>

                {/* Platform-specific notes */}
                {!conn && platform === 'instagram' && (
                  <p className="mt-3 text-xs text-flow-gray-500 border-t border-flow-gray-800 pt-3">
                    Requires a Business or Creator Instagram account linked to a Facebook Page
                  </p>
                )}
                {!conn && platform === 'threads' && (
                  <p className="mt-3 text-xs text-flow-gray-500 border-t border-flow-gray-800 pt-3">
                    Posts videos directly to your Threads profile
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help section */}
      <div className="glass-card p-6 mt-8 border-flow-magenta/10">
        <h3 className="font-display font-semibold text-sm text-flow-magenta mb-3">Need help connecting?</h3>
        <ul className="text-sm text-flow-gray-400 space-y-2">
          <li>• YouTube: uses your Google account — just authorize and go</li>
          <li>• Instagram: must be a Business/Creator account with a linked Facebook Page</li>
          <li>• Facebook: posts to your Page, not personal profile</li>
          <li>• Threads: uses your Threads account via Meta — authorize and post</li>
        </ul>
      </div>
    </div>
  );
}
