'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Crown, Loader2, User, Shield, Save, Palette, MapPin, Globe, Sparkles, Pencil } from 'lucide-react';
import type { User as FlowUser } from '@/lib/types';

const FLOW_TOY_OPTIONS = [
  'Poi', 'Staff', 'Hoop', 'Fans', 'Levitation Wand', 'Dragon Staff',
  'Rope Dart', 'Buugeng', 'Contact Juggling', 'Nunchaku', 'Whip',
  'LED Gloves', 'Orbit', 'Clubs', 'Devil Sticks', 'Flower Sticks',
];

const COLOR_OPTIONS = [
  { name: 'Green', value: '#00FF00' },
  { name: 'Magenta', value: '#FF00FF' },
  { name: 'Cyan', value: '#00FFFF' },
  { name: 'Red', value: '#FF3333' },
  { name: 'Orange', value: '#FF8800' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Blue', value: '#3366FF' },
  { name: 'Purple', value: '#9933FF' },
  { name: 'Pink', value: '#FF66B2' },
  { name: 'White', value: '#FFFFFF' },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<FlowUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('');
  const [flowToys, setFlowToys] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (data) {
        const u = data as FlowUser;
        setUser(u);
        setDisplayName(u.display_name || '');
        setBio(u.bio || '');
        setFavoriteColor(u.favorite_color || '');
        setFlowToys(u.flow_toys || []);
        setLocation(u.location || '');
        setWebsite(u.website || '');
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        display_name: displayName || null,
        bio: bio || null,
        favorite_color: favoriteColor || null,
        flow_toys: flowToys,
        location: location || null,
        website: website || null,
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile updated!');
      setUser({
        ...user,
        display_name: displayName || null,
        bio: bio || null,
        favorite_color: favoriteColor || null,
        flow_toys: flowToys,
        location: location || null,
        website: website || null,
      });
      setEditing(false);
    }
    setSaving(false);
  };

  const toggleFlowToy = (toy: string) => {
    setFlowToys(prev =>
      prev.includes(toy) ? prev.filter(t => t !== toy) : [...prev, toy]
    );
  };

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
        <p className="text-flow-gray-400 text-sm">Manage your profile, account, and subscription</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-flow-green" />
            <h2 className="font-display font-semibold">Profile</h2>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 text-sm text-flow-gray-400 hover:text-flow-green transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 text-sm bg-flow-green text-black px-4 py-1.5 rounded-lg font-medium hover:bg-flow-green/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          )}
        </div>

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-2xl"
            style={{
              backgroundColor: (favoriteColor || '#00FF00') + '20',
              color: favoriteColor || '#00FF00',
              border: `2px solid ${(favoriteColor || '#00FF00')}40`,
            }}
          >
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            {editing ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="w-full bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-3 py-2 text-white focus:border-flow-green focus:outline-none"
              />
            ) : (
              <>
                <p className="font-display font-semibold text-lg">{user?.display_name || 'No name set'}</p>
                <p className="text-sm text-flow-gray-400">{user?.email}</p>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="mb-5">
          <label className="text-sm text-flow-gray-400 mb-1.5 block">Bio</label>
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={200}
              rows={3}
              className="w-full bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-3 py-2 text-white focus:border-flow-green focus:outline-none resize-none text-sm"
            />
          ) : (
            <p className="text-sm">{user?.bio || <span className="text-flow-gray-600 italic">No bio yet</span>}</p>
          )}
        </div>

        {/* Location & Website */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-sm text-flow-gray-400 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            {editing ? (
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-3 py-2 text-white focus:border-flow-green focus:outline-none text-sm"
              />
            ) : (
              <p className="text-sm">{user?.location || <span className="text-flow-gray-600 italic">Not set</span>}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-flow-gray-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Website
            </label>
            {editing ? (
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-3 py-2 text-white focus:border-flow-green focus:outline-none text-sm"
              />
            ) : (
              <p className="text-sm">
                {user?.website ? (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-flow-green hover:underline">
                    {user.website}
                  </a>
                ) : (
                  <span className="text-flow-gray-600 italic">Not set</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Favorite Color */}
        <div className="mb-5">
          <label className="text-sm text-flow-gray-400 mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Favorite Color
          </label>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFavoriteColor(color.value)}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${
                    favoriteColor === color.value
                      ? 'border-white scale-110'
                      : 'border-transparent hover:border-flow-gray-500'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {user?.favorite_color ? (
                <>
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: user.favorite_color }} />
                  <span className="text-sm">{COLOR_OPTIONS.find(c => c.value === user.favorite_color)?.name || user.favorite_color}</span>
                </>
              ) : (
                <span className="text-sm text-flow-gray-600 italic">Not set</span>
              )}
            </div>
          )}
        </div>

        {/* Flow Toys */}
        <div>
          <label className="text-sm text-flow-gray-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Flow Toys
          </label>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {FLOW_TOY_OPTIONS.map((toy) => (
                <button
                  key={toy}
                  onClick={() => toggleFlowToy(toy)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    flowToys.includes(toy)
                      ? 'bg-flow-green/10 text-flow-green border-flow-green/30'
                      : 'bg-flow-gray-800 text-flow-gray-400 border-flow-gray-700 hover:border-flow-gray-500'
                  }`}
                >
                  {toy}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user?.flow_toys && user.flow_toys.length > 0 ? (
                user.flow_toys.map((toy) => (
                  <span
                    key={toy}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-flow-green/10 text-flow-green border border-flow-green/30"
                  >
                    {toy}
                  </span>
                ))
              ) : (
                <span className="text-sm text-flow-gray-600 italic">No flow toys selected</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-flow-green" />
          <h2 className="font-display font-semibold">Account</h2>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-flow-gray-800">
            <span className="text-sm text-flow-gray-400">Email</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-flow-gray-800">
            <span className="text-sm text-flow-gray-400">Videos this month</span>
            <span className="text-sm">{user?.videos_this_month || 0}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-flow-gray-400">Member since</span>
            <span className="text-sm">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
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
