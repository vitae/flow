'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Flame, Music, Paintbrush, Monitor, Ticket, MapPin,
  Instagram, ArrowRight, Check, Sparkles, ChevronRight,
  Zap, Star, Globe, Users
} from 'lucide-react';
import type { PerformerType } from '@/lib/types';

const PERFORMER_PATHS = [
  {
    type: 'flow_artist' as PerformerType,
    title: 'Flow Artist',
    subtitle: 'Poi, Hoop, Staff & More',
    description: 'Spin, dance, and mesmerize with props. Get discovered by event producers and connect with the global flow community.',
    icon: Flame,
    color: '#FF00FF',
    gradient: 'from-[#FF00FF]/20 to-[#FF00FF]/5',
    borderColor: '#FF00FF',
    toys: ['Poi', 'Staff', 'Hoop', 'Fans', 'Levitation Wand', 'Dragon Staff', 'Rope Dart', 'Buugeng', 'Contact Juggling', 'Whip', 'LED Gloves', 'Orbit', 'Clubs', 'Nunchaku'],
  },
  {
    type: 'dj' as PerformerType,
    title: 'DJ',
    subtitle: 'Beats, Bass & Vibes',
    description: 'Share your mixes, get booked for events, and build your following. From house to DnB — every genre has a home.',
    icon: Music,
    color: '#FFFF00',
    gradient: 'from-[#FFFF00]/20 to-[#FFFF00]/5',
    borderColor: '#FFFF00',
    toys: [],
  },
  {
    type: 'painter' as PerformerType,
    title: 'Live Painter',
    subtitle: 'Canvas, Murals & Live Art',
    description: 'Paint live at events, sell prints, and showcase your gallery. Turn every festival into your studio.',
    icon: Paintbrush,
    color: '#00FFFF',
    gradient: 'from-[#00FFFF]/20 to-[#00FFFF]/5',
    borderColor: '#00FFFF',
    toys: [],
  },
  {
    type: 'vj' as PerformerType,
    title: 'VJ / Visualist',
    subtitle: 'Projections & Visual Art',
    description: 'Projection mapping, live visuals, and immersive experiences. Light up every stage and venue.',
    icon: Monitor,
    color: '#00FF00',
    gradient: 'from-[#00FF00]/20 to-[#00FF00]/5',
    borderColor: '#00FF00',
    toys: [],
  },
];

const EVENT_PRODUCER_PATH = {
  type: 'event_producer' as PerformerType,
  title: 'Event Producer',
  subtitle: 'Find & Book Talent',
  description: 'Discover artists in any city, book them for your events, and manage your roster. Access the entire Flow community.',
  icon: Ticket,
  color: '#FF0000',
  gradient: 'from-[#FF0000]/20 to-[#FF0000]/5',
  borderColor: '#FF0000',
};

const FAVORITE_COLORS = [
  { name: 'Magenta', value: '#FF00FF' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Cyan', value: '#00FFFF' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Red', value: '#FF3333' },
  { name: 'Orange', value: '#FF8800' },
  { name: 'Purple', value: '#9933FF' },
  { name: 'Pink', value: '#FF66B2' },
  { name: 'Blue', value: '#3366FF' },
  { name: 'White', value: '#FFFFFF' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'choose' | 'profile'>('choose');
  const [selectedType, setSelectedType] = useState<PerformerType | null>(null);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('#00FF00');
  const [selectedToys, setSelectedToys] = useState<string[]>([]);
  const [availableForGigs, setAvailableForGigs] = useState(true);

  // Pre-fill from auth metadata
  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth/login'); return; }
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (data) {
        if (data.display_name) setDisplayName(data.display_name);
        if (data.bio) setBio(data.bio);
        if (data.location) setLocation(data.location);
        if (data.instagram_username) setInstagramUsername(data.instagram_username);
        if (data.website) setWebsite(data.website);
        if (data.favorite_color) setFavoriteColor(data.favorite_color);
        if (data.flow_toys?.length) setSelectedToys(data.flow_toys);
        if (data.profile_complete) router.push('/dashboard');
      }
    };
    loadUser();
  }, []);

  const handleChoose = (type: PerformerType) => {
    setSelectedType(type);
    // Auto-set a thematic color
    const path = PERFORMER_PATHS.find(p => p.type === type) || EVENT_PRODUCER_PATH;
    setFavoriteColor(path.color);
    setStep('profile');
  };

  const toggleToy = (toy: string) => {
    setSelectedToys(prev =>
      prev.includes(toy) ? prev.filter(t => t !== toy) : [...prev, toy]
    );
  };

  const handleSaveProfile = async () => {
    if (!selectedType) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('users').update({
      display_name: displayName || null,
      bio: bio || null,
      location: location || null,
      instagram_username: instagramUsername || null,
      website: website || null,
      favorite_color: favoriteColor,
      flow_toys: selectedToys,
      performer_type: selectedType,
      is_available_for_gigs: availableForGigs,
      profile_complete: true,
    }).eq('id', session.user.id);

    router.push('/dashboard');
  };

  const selectedPath = PERFORMER_PATHS.find(p => p.type === selectedType) || (selectedType === 'event_producer' ? EVENT_PRODUCER_PATH : null);
  const accentColor = selectedPath?.color || '#00FF00';

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">

        {/* ── Step 1: Choose Your Path ── */}
        {step === 'choose' && (
          <div className="text-center">
            {/* Header */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 bg-flow-green/10 text-flow-green text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                <Sparkles className="w-3.5 h-3.5" /> CHOOSE YOUR PATH
              </div>
              <h1 className="font-display font-black text-4xl md:text-5xl mb-3">
                What kind of <span className="text-flow-green">creator</span> are you?
              </h1>
              <p className="text-flow-gray-400 text-lg max-w-2xl mx-auto">
                Select your specialty to customize your profile. You&apos;ll be discoverable by promoters, venues, and fellow artists in your city.
              </p>
            </div>

            {/* 4-column Artist Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {PERFORMER_PATHS.map((path) => (
                <button
                  key={path.type}
                  onClick={() => handleChoose(path.type)}
                  className="group relative glass-card p-6 text-left hover:scale-[1.03] transition-all duration-300 cursor-pointer"
                  style={{ borderColor: path.borderColor + '30' }}
                >
                  {/* Glow effect on hover */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(circle at center, ${path.color}10, transparent 70%)` }}
                  />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                      style={{
                        backgroundColor: path.color + '15',
                        border: `2px solid ${path.color}30`,
                      }}
                    >
                      <path.icon className="w-8 h-8" style={{ color: path.color }} />
                    </div>

                    {/* Title */}
                    <h3 className="font-display font-bold text-lg mb-1" style={{ color: path.color }}>
                      {path.title}
                    </h3>
                    <p className="text-xs text-flow-gray-400 mb-3">{path.subtitle}</p>
                    <p className="text-xs text-flow-gray-500 leading-relaxed">{path.description}</p>

                    {/* CTA */}
                    <div
                      className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: path.color }}
                    >
                      Choose {path.title} <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Event Producer — full width */}
            <button
              onClick={() => handleChoose('event_producer')}
              className="group w-full glass-card p-6 text-left hover:scale-[1.01] transition-all duration-300 cursor-pointer flex items-center gap-6"
              style={{ borderColor: EVENT_PRODUCER_PATH.borderColor + '30' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: EVENT_PRODUCER_PATH.color + '15',
                  border: `2px solid ${EVENT_PRODUCER_PATH.color}30`,
                }}
              >
                <EVENT_PRODUCER_PATH.icon className="w-8 h-8" style={{ color: EVENT_PRODUCER_PATH.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-lg" style={{ color: EVENT_PRODUCER_PATH.color }}>
                    {EVENT_PRODUCER_PATH.title}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-flow-green/10 text-flow-green border border-flow-green/30 font-bold">FREE</span>
                </div>
                <p className="text-xs text-flow-gray-400">{EVENT_PRODUCER_PATH.subtitle}</p>
                <p className="text-xs text-flow-gray-500 mt-1">{EVENT_PRODUCER_PATH.description}</p>
              </div>
              <div
                className="flex items-center gap-1.5 text-sm font-semibold shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ color: EVENT_PRODUCER_PATH.color }}
              >
                Choose <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2: Build Your Profile ── */}
        {step === 'profile' && selectedPath && (
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <button
                onClick={() => setStep('choose')}
                className="text-flow-gray-500 hover:text-white text-xs mb-4 inline-flex items-center gap-1 transition-colors"
              >
                ← Back to selection
              </button>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: accentColor + '15',
                    border: `2px solid ${accentColor}30`,
                  }}
                >
                  <selectedPath.icon className="w-6 h-6" style={{ color: accentColor }} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl" style={{ color: accentColor }}>
                    {selectedPath.title} Profile
                  </h2>
                </div>
              </div>
              <p className="text-flow-gray-400 text-sm">
                Complete your profile so promoters and artists can find you.
              </p>
            </div>

            <div className="glass-card p-6 space-y-6" style={{ borderColor: accentColor + '20' }}>
              {/* Display Name */}
              <div>
                <label className="block text-xs font-medium text-flow-gray-300 mb-1.5">Display Name *</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your artist / stage name"
                  className="input-field"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-medium text-flow-gray-300 mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={selectedType === 'event_producer'
                    ? 'Tell artists about your events, venues, and what you look for in talent...'
                    : 'Tell the world about your art, your style, your vibe...'}
                  className="input-field min-h-[80px] resize-none"
                  maxLength={200}
                />
                <p className="text-[10px] text-flow-gray-600 mt-1 text-right">{bio.length}/200</p>
              </div>

              {/* Location + Instagram — side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-flow-gray-300 mb-1.5">
                    <MapPin className="w-3 h-3 inline mr-1" /> Location *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flow-gray-300 mb-1.5">
                    <Instagram className="w-3 h-3 inline mr-1" /> Instagram
                  </label>
                  <input
                    type="text"
                    value={instagramUsername}
                    onChange={(e) => setInstagramUsername(e.target.value.replace('@', ''))}
                    placeholder="username"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-medium text-flow-gray-300 mb-1.5">
                  <Globe className="w-3 h-3 inline mr-1" /> Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="input-field"
                />
              </div>

              {/* Flow Toys (only for flow artists) */}
              {selectedType === 'flow_artist' && selectedPath.type === 'flow_artist' && (
                <div>
                  <label className="block text-xs font-medium text-flow-gray-300 mb-2">
                    <Flame className="w-3 h-3 inline mr-1" /> Your Flow Props
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {(selectedPath as typeof PERFORMER_PATHS[0]).toys.map((toy) => (
                      <button
                        key={toy}
                        onClick={() => toggleToy(toy)}
                        className={`text-xs px-3 py-2 rounded-lg border transition-all ${
                          selectedToys.includes(toy)
                            ? 'border-flow-magenta/50 bg-flow-magenta/10 text-flow-magenta'
                            : 'border-flow-gray-700 bg-flow-gray-900/50 text-flow-gray-400 hover:border-flow-gray-600'
                        }`}
                      >
                        {selectedToys.includes(toy) && <Check className="w-3 h-3 inline mr-1" />}
                        {toy}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorite Color */}
              <div>
                <label className="block text-xs font-medium text-flow-gray-300 mb-2">
                  <Star className="w-3 h-3 inline mr-1" /> Profile Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {FAVORITE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setFavoriteColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                        favoriteColor === c.value ? 'ring-2 ring-offset-2 ring-offset-flow-dark scale-110' : ''
                      }`}
                      style={{
                        backgroundColor: c.value,
                        borderColor: favoriteColor === c.value ? c.value : c.value + '40',
                        ['--tw-ring-color' as string]: c.value,
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Available for Gigs */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-flow-gray-900/50 border border-flow-gray-800">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: accentColor }} />
                  <div>
                    <p className="text-sm font-medium">
                      {selectedType === 'event_producer' ? 'Currently booking artists' : 'Available for gigs'}
                    </p>
                    <p className="text-[10px] text-flow-gray-500">
                      {selectedType === 'event_producer'
                        ? 'Artists will see you\'re actively looking for talent'
                        : 'Event producers will see you\'re open to bookings'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAvailableForGigs(!availableForGigs)}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    availableForGigs ? 'bg-flow-green' : 'bg-flow-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    availableForGigs ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Save */}
              <button
                onClick={handleSaveProfile}
                disabled={saving || !displayName || !location}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-display font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  backgroundColor: accentColor,
                  color: '#000',
                }}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    {selectedType === 'event_producer' ? 'Start Finding Talent' : 'Launch Your Profile'}
                  </>
                )}
              </button>

              <p className="text-[10px] text-flow-gray-600 text-center">
                You can always update this later in Settings
              </p>
            </div>

            {/* Preview Card */}
            {displayName && (
              <div className="mt-6">
                <p className="text-xs text-flow-gray-500 text-center mb-3">Profile Preview</p>
                <div className="glass-card p-4" style={{ borderColor: favoriteColor + '20' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg"
                      style={{
                        backgroundColor: favoriteColor + '20',
                        color: favoriteColor,
                        border: `2px solid ${favoriteColor}40`,
                      }}
                    >
                      {displayName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold">{displayName}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: accentColor + '10',
                            color: accentColor,
                            borderColor: accentColor + '30',
                          }}
                        >
                          {selectedPath.title}
                        </span>
                        {availableForGigs && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-flow-green/10 text-flow-green border border-flow-green/30">
                            <Zap className="w-2.5 h-2.5 inline" /> Open to gigs
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-flow-gray-400 mt-0.5">
                        {location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {location}</span>}
                        {instagramUsername && <span className="flex items-center gap-0.5"><Instagram className="w-3 h-3" /> @{instagramUsername}</span>}
                      </div>
                      {bio && <p className="text-xs text-flow-gray-300 mt-1 line-clamp-2">{bio}</p>}
                      {selectedToys.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedToys.map(toy => (
                            <span key={toy} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: favoriteColor + '10', color: favoriteColor, borderColor: favoriteColor + '30' }}>{toy}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
