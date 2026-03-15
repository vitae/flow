'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Flame, MessageCircle, Share2, Bookmark, MapPin, Upload,
  Sparkles, TrendingUp, Droplets, Music, Users, ChevronRight
} from 'lucide-react';
import type { User as FlowUser } from '@/lib/types';

// Sample feed data — will be replaced with real posts from Supabase
const SAMPLE_FEED = [
  {
    id: '1',
    user: { name: 'Luna Spinner', toy: 'Poi', location: 'Austin, TX', color: '#FF00FF' },
    caption: 'Sunset session at Zilker Park. This new antispin weave combo finally clicked after 3 weeks of practice!',
    hashtags: ['#flowarts', '#poi', '#sunset', '#zilkerpark', '#antispin'],
    likes: 347,
    comments: 24,
    timeAgo: '2m ago',
    musicTrack: 'Liquid Stranger — Cosmic Awakening',
  },
  {
    id: '2',
    user: { name: 'Blaze Master', toy: 'Dragon Staff', location: 'Denver, CO', color: '#FFFF00' },
    caption: 'Fire performance at Red Rocks last night. The crowd energy was unreal. Grateful for every moment on stage.',
    hashtags: ['#dragonstaff', '#firearts', '#redrocks', '#performance'],
    likes: 892,
    comments: 67,
    timeAgo: '15m ago',
    musicTrack: 'Tipper — Dreamsters',
  },
  {
    id: '3',
    user: { name: 'Crystal Flow', toy: 'LED Hoop', location: 'Portland, OR', color: '#00FFFF' },
    caption: 'New LED pattern on the SmartHoop Pro! These color transitions sync perfectly with the beat.',
    hashtags: ['#hooping', '#ledhoop', '#portland', '#flowstate'],
    likes: 156,
    comments: 12,
    timeAgo: '32m ago',
    musicTrack: 'CloZee — Harmony',
  },
  {
    id: '4',
    user: { name: 'Neon Drift', toy: 'Levitation Wand', location: 'Miami, FL', color: '#FF3333' },
    caption: 'Beach flow at midnight. The wand floats differently in the ocean breeze and I am HERE for it.',
    hashtags: ['#leviwand', '#beachflow', '#miami', '#nightflow'],
    likes: 203,
    comments: 19,
    timeAgo: '1h ago',
    musicTrack: 'Emancipator — Soon It Will Be Cold Enough',
  },
  {
    id: '5',
    user: { name: 'Prism Paint', toy: 'Live Painter', location: 'Brooklyn, NY', color: '#9933FF' },
    caption: 'Live painting at the Bushwick Collective last night. 4 hours, one canvas, and a lot of bass music. Prints available soon.',
    hashtags: ['#livepainting', '#brooklyn', '#bushwick', '#artlife'],
    likes: 511,
    comments: 43,
    timeAgo: '2h ago',
    musicTrack: 'Odesza — A Moment Apart',
  },
  {
    id: '6',
    user: { name: 'VJ Fractal', toy: 'VJ', location: 'Los Angeles, CA', color: '#00FF00' },
    caption: 'New projection mapping piece for Exchange LA. 4 projectors, TouchDesigner, and a lot of caffeine. The venue looked incredible.',
    hashtags: ['#vjlife', '#projectionmapping', '#touchdesigner', '#exchangela'],
    likes: 678,
    comments: 55,
    timeAgo: '3h ago',
    musicTrack: 'Rezz — Edge',
  },
  {
    id: '7',
    user: { name: 'DJ Luminance', toy: 'DJ', location: 'Chicago, IL', color: '#FF8800' },
    caption: 'Just dropped a new liquid DnB mix — 2 hours of pure vibes. Link in bio. Let me know your favorite track.',
    hashtags: ['#djlife', '#liquiddrumnbass', '#chicago', '#newmix'],
    likes: 234,
    comments: 31,
    timeAgo: '4h ago',
    musicTrack: null,
  },
  {
    id: '8',
    user: { name: 'Silk Whips', toy: 'Whip', location: 'Nashville, TN', color: '#FF66B2' },
    caption: 'First time cracking doubles at a festival. The sound the crowd made when both whips hit in sync... chills.',
    hashtags: ['#whipcracking', '#flowarts', '#festival', '#doubles'],
    likes: 189,
    comments: 15,
    timeAgo: '5h ago',
    musicTrack: 'Bassnectar — Timestretch',
  },
];

const TRENDING_TAGS = [
  '#flowarts', '#fireperformance', '#poispinning', '#festivalseason',
  '#liveart', '#vjlife', '#edm', '#raveculture',
];

export default function DashboardPage() {
  const supabase = createClient();
  const [user, setUser] = useState<FlowUser | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (data) setUser(data as FlowUser);
    };
    getUser();
  }, []);

  const toggleLike = (postId: string) => {
    setLikedPosts(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const toggleSave = (postId: string) => {
    setSavedPosts(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const userColor = user?.favorite_color || '#00FF00';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stories-style top bar */}
      <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {/* Your story / upload CTA */}
        <Link href="/dashboard/upload" className="flex flex-col items-center gap-1 shrink-0">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed"
            style={{ borderColor: userColor + '60' }}
          >
            <Upload className="w-6 h-6" style={{ color: userColor }} />
          </div>
          <span className="text-[10px] text-flow-gray-400">Your flow</span>
        </Link>

        {/* Other artists' "stories" */}
        {SAMPLE_FEED.slice(0, 6).map((post) => (
          <div key={post.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-lg"
              style={{
                background: `linear-gradient(135deg, ${post.user.color}40, ${post.user.color}10)`,
                border: `2px solid ${post.user.color}`,
                color: post.user.color,
              }}
            >
              {post.user.name[0]}
            </div>
            <span className="text-[10px] text-flow-gray-400 max-w-[60px] truncate">{post.user.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Trending tags */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        <TrendingUp className="w-4 h-4 text-flow-magenta shrink-0" />
        {TRENDING_TAGS.map((tag) => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full bg-flow-gray-900 border border-flow-gray-800 text-flow-gray-300 whitespace-nowrap hover:border-flow-green/30 cursor-pointer transition-colors">
            {tag}
          </span>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-6">
        {SAMPLE_FEED.map((post) => (
          <div key={post.id} className="glass-card overflow-hidden">
            {/* Post header */}
            <div className="flex items-center gap-3 p-4 pb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                style={{
                  backgroundColor: post.user.color + '20',
                  color: post.user.color,
                  border: `2px solid ${post.user.color}40`,
                }}
              >
                {post.user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{post.user.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{
                    backgroundColor: post.user.color + '10',
                    color: post.user.color,
                    borderColor: post.user.color + '30',
                  }}>
                    {post.user.toy}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-flow-gray-500">
                  <MapPin className="w-2.5 h-2.5" /> {post.user.location} · {post.timeAgo}
                </div>
              </div>
            </div>

            {/* Video placeholder */}
            <div className="aspect-[4/5] bg-gradient-to-br from-flow-gray-900 to-flow-gray-800 flex items-center justify-center relative">
              <div className="text-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 cursor-pointer hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: post.user.color + '15',
                    border: `2px solid ${post.user.color}40`,
                  }}
                >
                  <div className="w-0 h-0 border-l-[14px] border-t-[9px] border-b-[9px] border-l-white border-t-transparent border-b-transparent ml-1" />
                </div>
                <p className="text-xs text-flow-gray-500">Tap to play</p>
              </div>
              {post.musicTrack && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                  <Music className="w-3 h-3 text-flow-cyan shrink-0" />
                  <span className="text-[10px] text-flow-gray-300 truncate">{post.musicTrack}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 group">
                    <Flame className={`w-6 h-6 transition-colors ${likedPosts.has(post.id) ? 'text-flow-red fill-flow-red' : 'text-flow-gray-400 group-hover:text-flow-red'}`} />
                  </button>
                  <button className="flex items-center gap-1.5">
                    <MessageCircle className="w-6 h-6 text-flow-gray-400 hover:text-white transition-colors" />
                  </button>
                  <button className="flex items-center gap-1.5">
                    <Share2 className="w-5 h-5 text-flow-gray-400 hover:text-white transition-colors" />
                  </button>
                </div>
                <button onClick={() => toggleSave(post.id)}>
                  <Bookmark className={`w-6 h-6 transition-colors ${savedPosts.has(post.id) ? 'text-flow-yellow fill-flow-yellow' : 'text-flow-gray-400 hover:text-flow-yellow'}`} />
                </button>
              </div>

              <p className="text-sm font-semibold mb-1">
                {(likedPosts.has(post.id) ? post.likes + 1 : post.likes).toLocaleString()} fires
              </p>

              {/* Caption */}
              <p className="text-sm text-flow-gray-200 mb-1.5">
                <span className="font-semibold mr-1.5">{post.user.name}</span>
                {post.caption}
              </p>

              {/* Hashtags */}
              <p className="text-xs text-flow-cyan/70 mb-2">
                {post.hashtags.join(' ')}
              </p>

              {/* Comments link */}
              <button className="text-xs text-flow-gray-500 mb-3 hover:text-flow-gray-300 transition-colors">
                View all {post.comments} comments
              </button>
            </div>
          </div>
        ))}

        {/* End of feed */}
        <div className="text-center py-8">
          <Sparkles className="w-6 h-6 text-flow-green mx-auto mb-2" />
          <p className="text-sm text-flow-gray-400 mb-1">You&apos;re all caught up!</p>
          <p className="text-xs text-flow-gray-600">
            <span className="text-flow-cyan"><Droplets className="w-3 h-3 inline" /> Stay Hydrated!</span>
            {' · '}
            <span className="text-flow-green">P</span>
            <span className="text-flow-magenta">L</span>
            <span className="text-flow-cyan">U</span>
            <span className="text-flow-yellow">R</span>
          </p>
        </div>
      </div>
    </div>
  );
}
