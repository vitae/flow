'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Upload, Sparkles, Music, Hash, Share2, Zap, ArrowRight, Check,
  Crown, Rocket, Users, Globe, TrendingUp, DollarSign, Radio,
  MessageCircle, Calendar, Flame, Play, Star, Mic2, MapPin, ChevronRight
} from 'lucide-react';

const platforms = [
  { name: 'YouTube', users: '2.7B', color: '#FF0000' },
  { name: 'Instagram', users: '2.4B', color: '#E4405F' },
  { name: 'Facebook', users: '3.1B', color: '#1877F2' },
  { name: 'Threads', users: '300M', color: '#8B5CF6' },
];

const flowCategories = [
  { name: 'Poi', emoji: '🔥', count: '2.4K artists' },
  { name: 'Staff', emoji: '🏒', count: '1.8K artists' },
  { name: 'Hoop', emoji: '⭕', count: '3.1K artists' },
  { name: 'Fans', emoji: '🪭', count: '1.2K artists' },
  { name: 'LED Gloves', emoji: '🧤', count: '4.7K artists' },
  { name: 'Levitation', emoji: '🪄', count: '890 artists' },
  { name: 'Contact', emoji: '🔮', count: '1.5K artists' },
  { name: 'Dragon Staff', emoji: '🐉', count: '720 artists' },
];

const tiers = [
  {
    name: 'Starter',
    price: '$9.99',
    subtitle: 'Start building your audience',
    badge: null,
    badgeClass: '',
    priceClass: 'text-flow-green',
    checkClass: 'text-flow-green',
    borderClass: 'glass-card',
    btnClass: 'btn-secondary',
    btnText: 'Start Free Trial',
    paymentUrl: 'https://buy.stripe.com/cNi5kFacz1COax8fxCejK00',
    highlight: 'Save 20+ hours/month',
    features: [
      '10 videos / month',
      'Auto AI captions',
      '2 platforms (YouTube + Instagram)',
      'Basic hashtags',
      'Community feed access',
      'Artist profile page',
      'Direct messaging',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$19.99',
    subtitle: 'Grow & get booked',
    badge: 'MOST POPULAR',
    badgeClass: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
    priceClass: 'text-flow-magenta',
    checkClass: 'text-flow-magenta',
    borderClass: 'glass-card-magenta border-flow-magenta/30',
    btnClass: 'btn-magenta',
    btnText: 'Go Pro — 7 Days Free',
    paymentUrl: 'https://buy.stripe.com/14A3cx5WjftEcFgdpuejK01',
    highlight: 'Everything in Starter, plus:',
    features: [
      '50 videos / month',
      'All 4 platforms',
      'Trending music (10K+ tracks)',
      'AI hashtags + trending tags',
      'Priority processing (2x)',
      'Booking requests from promoters',
      'Promo Boost (2x/month)',
      'Festival & gig discovery',
      'Brand partnership access',
      'Analytics dashboard',
      'Priority support',
    ],
  },
  {
    name: 'Unlimited',
    price: '$29.99',
    subtitle: 'Full career platform',
    badge: 'BEST VALUE',
    badgeClass: 'bg-flow-yellow/10 text-flow-yellow border-flow-yellow/20',
    priceClass: 'text-flow-yellow',
    checkClass: 'text-flow-yellow',
    borderClass: 'glass-card border-flow-yellow/30',
    btnClass: 'btn-primary',
    btnText: 'Go Unlimited — 7 Days Free',
    paymentUrl: 'https://buy.stripe.com/28EcN70BZ3KW7kW4SYejK02',
    highlight: 'Everything in Pro, plus:',
    features: [
      'Unlimited videos',
      'All platforms + early access (TikTok, X)',
      'Full music library + custom audio',
      'AI hashtags + competitor analysis',
      'Fastest processing (5x)',
      'Unlimited booking requests',
      'Promo Boost (8x/month)',
      'Smart scheduling AI',
      'Multi-account (5 brands)',
      'Team collab (3 seats)',
      'Featured artist spotlight',
      'Custom branding & watermarks',
      'API access',
      'Dedicated account manager',
    ],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-flow-green/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-flow-green flex items-center justify-center">
              <span className="font-display font-black text-black text-sm">F</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              <span className="text-flow-green">FLOW</span>
              <span className="text-flow-gray-300 ml-1.5 font-light text-sm">AI</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-flow-gray-300">
            <Link href="#community" className="hover:text-flow-green transition-colors">Community</Link>
            <Link href="#bookings" className="hover:text-flow-green transition-colors">Bookings</Link>
            <Link href="/djs" className="hover:text-flow-green transition-colors">DJs</Link>
            <Link href="#pricing" className="hover:text-flow-green transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="btn-secondary text-sm py-2 px-4">
              Log in
            </Link>
            <Link href="/auth/login" className="btn-primary text-sm py-2 px-4">
              Join the community
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — Worldstar / ESPN of Flow Arts */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-flow-green/3 via-transparent to-flow-magenta/3 pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-flow-green/20 bg-flow-green/5 px-4 py-1.5 text-sm text-flow-green">
                <Flame className="w-3.5 h-3.5" />
                The #1 Flow Arts Platform
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-flow-magenta/20 bg-flow-magenta/5 px-3 py-1.5 text-xs text-flow-magenta">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </div>
            </div>

            <h1 className="font-display font-black text-5xl md:text-7xl leading-[1.05] tracking-tight mb-6">
              The <span className="text-flow-green text-glow-green">ESPN</span> of Flow Arts.
            </h1>

            <p className="text-lg md:text-xl text-flow-gray-200 max-w-3xl mx-auto mb-6 leading-relaxed">
              Upload your flow videos. Connect with artists worldwide. Get booked for festivals, events, and shows.
              <span className="text-white font-medium"> One platform for your entire flow arts career.</span>
            </p>

            <p className="text-lg text-flow-gray-200 max-w-2xl mx-auto mb-3 leading-relaxed italic">
              &quot;Reach everyone on the planet with your performance. Why not?&quot;
            </p>
            <p className="text-sm text-flow-green font-medium mb-3">
              GWDF.pro is designed to boost your performance flow arts career.
            </p>
            <p className="text-sm text-flow-gray-400 mb-10">
              We now have the technology to do it. Upload once → AI adds captions, trending music & hashtags → Posts to YouTube, Instagram, Facebook & Threads simultaneously.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/auth/login" className="btn-primary text-lg px-8 py-4">
                <Play className="w-5 h-5" /> Join the Community
              </Link>
              <Link href="#bookings" className="btn-secondary text-lg px-8 py-4">
                <Calendar className="w-5 h-5" /> Book Flow Artists
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-flow-gray-500">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-flow-green" /> 10K+ Artists</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-flow-magenta" /> Live Chat</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-flow-yellow" /> Event Bookings</span>
              <span className="flex items-center gap-1.5"><Mic2 className="w-3.5 h-3.5 text-flow-cyan" /> DJ Profiles</span>
            </div>
          </motion.div>

          {/* Platform reach */}
          <motion.div
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-sm uppercase tracking-wider text-flow-gray-500 mb-6">
              Your content reaches 8.5 billion+ users
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 rounded-xl border border-flow-gray-700 bg-flow-gray-900/50 px-5 py-3 hover:border-flow-gray-500 transition-all"
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-display font-semibold text-sm">{p.name}</span>
                  <div className="flex items-center gap-1 text-flow-gray-400">
                    <Users className="w-3 h-3" />
                    <span className="text-xs font-medium">{p.users}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Community Feed Preview */}
      <section id="community" className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              The flow arts <span className="text-flow-magenta text-glow-magenta">community</span>
            </h2>
            <p className="text-flow-gray-300 text-lg mb-4">Connect, share, and inspire. All in one place.</p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-flow-green font-display font-semibold">Peace</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-magenta font-display font-semibold">Love</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-cyan font-display font-semibold">Unity</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-yellow font-display font-semibold">Respect</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Feed card */}
            <motion.div
              className="glass-card p-6 md:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-5 h-5 text-flow-green" />
                <h3 className="font-display font-semibold">Community Feed</h3>
                <span className="text-[10px] bg-flow-green/10 text-flow-green px-2 py-0.5 rounded-full ml-auto">LIVE</span>
              </div>
              <p className="text-sm text-flow-gray-300 mb-6">
                Watch the latest flow videos from artists worldwide. Like, comment, and share — just like Instagram, but built exclusively for flow artists.
              </p>

              {/* Fake feed items */}
              <div className="space-y-4">
                {[
                  { name: 'Luna Spinner', toy: 'Poi', loc: 'Austin, TX', time: '2m ago', color: '#FF00FF' },
                  { name: 'Blaze Master', toy: 'Dragon Staff', loc: 'Denver, CO', time: '8m ago', color: '#FFFF00' },
                  { name: 'Crystal Flow', toy: 'LED Hoop', loc: 'Portland, OR', time: '15m ago', color: '#00FFFF' },
                ].map((post) => (
                  <div key={post.name} className="flex items-center gap-4 bg-flow-gray-900/50 rounded-lg p-3 border border-flow-gray-800">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm" style={{ backgroundColor: post.color + '20', color: post.color }}>
                      {post.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{post.name}</span>
                        <span className="text-[10px] bg-flow-gray-800 text-flow-gray-400 px-2 py-0.5 rounded-full">{post.toy}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-flow-gray-500">
                        <MapPin className="w-2.5 h-2.5" /> {post.loc} · {post.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-flow-gray-500">
                      <span className="flex items-center gap-1 text-xs"><Flame className="w-3 h-3 text-flow-red" /> 247</span>
                      <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3 h-3" /> 18</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/auth/login" className="flex items-center justify-center gap-2 text-flow-green text-sm font-medium mt-4 hover:underline">
                Join the feed <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Chat + Categories */}
            <div className="space-y-6">
              <motion.div
                className="glass-card p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-flow-magenta" />
                  <h3 className="font-display font-semibold">Live Chat</h3>
                </div>
                <p className="text-sm text-flow-gray-300 mb-4">
                  Talk shop with flow artists worldwide. Share tips, find practice partners, and coordinate meetups.
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    { ch: '# general', msg: 'Anyone spinning at EDC this year?' },
                    { ch: '# poi-spinners', msg: 'New antispin tutorial dropped!' },
                    { ch: '# gig-board', msg: 'Looking for 2 hoopers for Miami show' },
                  ].map((m) => (
                    <div key={m.ch} className="bg-flow-gray-900/50 rounded-lg p-2 border border-flow-gray-800">
                      <span className="text-[10px] text-flow-magenta font-medium">{m.ch}</span>
                      <p className="text-xs text-flow-gray-400 truncate">{m.msg}</p>
                    </div>
                  ))}
                </div>
                <Link href="/auth/login" className="text-flow-magenta text-xs font-medium hover:underline flex items-center gap-1">
                  Join the conversation <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>

              <motion.div
                className="glass-card p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-flow-yellow" />
                  <h3 className="font-display font-semibold">Flow Disciplines</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {flowCategories.map((cat) => (
                    <div key={cat.name} className="bg-flow-gray-900/50 rounded-lg p-2 border border-flow-gray-800 hover:border-flow-green/20 transition-colors cursor-pointer">
                      <span className="text-sm">{cat.emoji} {cat.name}</span>
                      <p className="text-[9px] text-flow-gray-500">{cat.count}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Bookings — Event Production Teams */}
      <section id="bookings" className="py-20 px-6 border-t border-flow-green/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-flow-cyan/3 via-transparent to-flow-magenta/3 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-flow-cyan/20 bg-flow-cyan/5 px-4 py-1.5 text-sm text-flow-cyan mb-6">
              <Calendar className="w-3.5 h-3.5" />
              Booking Platform
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              Book <span className="text-flow-cyan">flow artists</span> for your event
            </h2>
            <p className="text-flow-gray-300 text-lg max-w-2xl mx-auto">
              Event producers, festival organizers, and venue owners — find and book world-class flow performers directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            {/* For Event Producers */}
            <motion.div
              className="glass-card p-8 border-flow-cyan/10"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Calendar className="w-10 h-10 text-flow-cyan mb-4" />
              <h3 className="font-display font-bold text-xl mb-3">For Event Producers</h3>
              <ul className="space-y-3 text-sm text-flow-gray-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-cyan mt-0.5 shrink-0" />
                  Browse artists by discipline, location & availability
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-cyan mt-0.5 shrink-0" />
                  Watch video reels and see performance history
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-cyan mt-0.5 shrink-0" />
                  Send booking requests with event details & budget
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-cyan mt-0.5 shrink-0" />
                  Manage contracts and payments in one place
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-cyan mt-0.5 shrink-0" />
                  Post gigs to the community job board
                </li>
              </ul>
              <Link href="/auth/login" className="btn-secondary w-full mt-6 text-center text-sm">
                Post a Gig — Free
              </Link>
            </motion.div>

            {/* For Flow Artists */}
            <motion.div
              className="glass-card p-8 border-flow-magenta/10"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Star className="w-10 h-10 text-flow-magenta mb-4" />
              <h3 className="font-display font-bold text-xl mb-3">For Flow Artists</h3>
              <ul className="space-y-3 text-sm text-flow-gray-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                  Create a professional booking profile with video reel
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                  Set your rates, availability & travel radius
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                  Receive booking requests from verified promoters
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                  Get discovered through the gig board & search
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                  Build your reputation with reviews & ratings
                </li>
              </ul>
              <Link href="/auth/login" className="btn-magenta w-full mt-6 text-center text-sm">
                Create Booking Profile
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* DJs Section */}
      <section className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-flow-cyan/20 bg-flow-cyan/5 px-4 py-1.5 text-sm text-flow-cyan mb-6">
              <Mic2 className="w-3.5 h-3.5" />
              DJ Platform
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              DJs: <span className="text-flow-cyan">promote your music</span> & get booked
            </h2>
            <p className="text-flow-gray-300 text-lg max-w-2xl mx-auto">
              Create your DJ profile, upload mixes, and get discovered by event producers looking for talent in your state.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10">
            <motion.div
              className="glass-card p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Music className="w-8 h-8 text-flow-cyan mx-auto mb-3" />
              <h3 className="font-display font-semibold mb-2">Upload Mixes</h3>
              <p className="text-xs text-flow-gray-400">Share your sets, get plays, and build your fanbase. Flow artists discover music through your profile.</p>
            </motion.div>
            <motion.div
              className="glass-card p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <MapPin className="w-8 h-8 text-flow-magenta mx-auto mb-3" />
              <h3 className="font-display font-semibold mb-2">Get Found Locally</h3>
              <p className="text-xs text-flow-gray-400">Promoters search by state and genre. Your profile shows up when they need a DJ for their next event.</p>
            </motion.div>
            <motion.div
              className="glass-card p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Calendar className="w-8 h-8 text-flow-yellow mx-auto mb-3" />
              <h3 className="font-display font-semibold mb-2">Book Shows</h3>
              <p className="text-xs text-flow-gray-400">Accept booking requests, manage your calendar, and grow your performance career — all from one dashboard.</p>
            </motion.div>
          </div>

          <div className="text-center">
            <Link href="/djs" className="btn-primary text-sm px-8 py-3">
              <Mic2 className="w-4 h-4" /> Explore DJ Profiles
            </Link>
          </div>
        </div>
      </section>

      {/* 24/7 Posting Server + Motivational */}
      <section className="py-20 px-6 border-t border-flow-green/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-flow-magenta/5 via-transparent to-flow-green/5 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display font-black text-3xl md:text-5xl leading-tight tracking-tight mb-6">
              Tired of getting <span className="text-flow-red">a few hundred views?</span>
              <br />
              <span className="text-flow-green text-glow-green">Imagine reaching 8.5 billion.</span>
            </h2>

            <p className="text-lg text-flow-gray-200 max-w-3xl mx-auto mb-8 leading-relaxed">
              You didn&apos;t master the art of flow just to be invisible online.
              Your content deserves to be seen by <span className="text-flow-green font-semibold">every person on every platform</span>.
            </p>

            <div className="glass-card border-flow-green/20 p-8 max-w-3xl mx-auto mb-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Radio className="w-5 h-5 text-flow-green animate-pulse" />
                <span className="font-display font-bold text-flow-green text-lg">24/7 NON-STOP POSTING SERVER</span>
                <Radio className="w-5 h-5 text-flow-green animate-pulse" />
              </div>
              <p className="text-flow-gray-200 mb-6 leading-relaxed">
                Subscribe and your content enters our <span className="text-white font-semibold">always-on distribution engine</span>.
                Every upload is processed with AI captions, trending music, and optimized hashtags — then posted to
                <span className="text-flow-green font-semibold"> every platform, simultaneously</span>. Our servers never sleep.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {platforms.map((p) => (
                  <div key={p.name} className="text-center">
                    <p className="text-xl font-display font-black" style={{ color: p.color }}>{p.users}</p>
                    <p className="text-[10px] text-flow-gray-400 uppercase tracking-wider">{p.name}</p>
                  </div>
                ))}
              </div>

              <div className="bg-flow-green/5 rounded-xl border border-flow-green/20 p-4">
                <p className="font-display font-black text-2xl md:text-3xl text-flow-green mb-1">8.5 Billion+ Users</p>
                <p className="text-sm text-flow-gray-300">Total reach — your content hits them all with one upload</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
              <div className="glass-card p-5 text-center">
                <Globe className="w-8 h-8 text-flow-green mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">Global Reach</h3>
                <p className="text-xs text-flow-gray-400">Every platform. Every audience. Automatically.</p>
              </div>
              <div className="glass-card p-5 text-center">
                <DollarSign className="w-8 h-8 text-flow-magenta mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">Make Money Flowing</h3>
                <p className="text-xs text-flow-gray-400">More views = brand deals, gigs, and sponsorships.</p>
              </div>
              <div className="glass-card p-5 text-center">
                <TrendingUp className="w-8 h-8 text-flow-yellow mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">Grow Faster</h3>
                <p className="text-xs text-flow-gray-400">AI rides the trending wave for you.</p>
              </div>
            </div>

            <p className="text-xl md:text-2xl font-display font-bold text-white mb-2">
              Start making money doing what you love.
            </p>
            <p className="text-flow-gray-300 mb-8">
              Pick a plan and join the 24/7 posting server today.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Alpha Tester CTA */}
      <section className="py-16 px-6 border-t border-flow-cyan/10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="relative rounded-2xl border-2 border-flow-cyan/30 bg-gradient-to-br from-flow-cyan/5 via-black to-flow-green/5 p-10 text-center overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-flow-cyan via-flow-green to-flow-cyan" />
            <div className="inline-flex items-center gap-2 rounded-full border border-flow-cyan/30 bg-flow-cyan/10 px-5 py-2 text-sm text-flow-cyan font-semibold mb-6">
              <Zap className="w-4 h-4" />
              EARLY ALPHA TESTER PROGRAM
            </div>

            <h2 className="font-display font-black text-3xl md:text-4xl mb-4">
              Test the waters for <span className="text-flow-cyan">just $5</span>
            </h2>

            <p className="text-lg text-flow-gray-200 max-w-2xl mx-auto mb-3 leading-relaxed">
              Join our early alpha tester program with a one-time payment of $5.
              Get full access to the platform, upload videos, and see the power of automated distribution.
            </p>

            <p className="text-flow-green font-display font-bold text-lg mb-8">
              If our app isn&apos;t helpful — full refund. No questions asked.
            </p>

            <a
              href="https://buy.stripe.com/7sY00lfwTftEfRs2KQejK03"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-xl font-display font-bold text-lg bg-flow-cyan text-black hover:bg-flow-cyan/90 transition-all shadow-lg shadow-flow-cyan/20"
            >
              <Rocket className="w-5 h-5" />
              Join Alpha — $5
            </a>

            <p className="text-xs text-flow-gray-500 mt-4">
              One-time payment · Full platform access · 100% money-back guarantee
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              Choose your <span className="text-flow-green">flow</span>
            </h2>
            <p className="text-flow-gray-300 text-lg mb-2">Start free. Scale when you&apos;re ready.</p>
            <p className="text-sm text-flow-gray-400">
              Every plan includes <span className="text-flow-green font-medium">24/7 posting server</span> + community access + booking profile
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                className={`${tier.borderClass} p-8 relative flex flex-col`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {tier.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-4 py-1 rounded-full border ${tier.badgeClass}`}>
                    {tier.badge}
                  </div>
                )}

                <h3 className="font-display font-bold text-xl mb-1">{tier.name}</h3>
                <p className="text-xs text-flow-gray-400 mb-3">{tier.subtitle}</p>
                <p className="mb-1">
                  <span className={`text-4xl font-display font-black ${tier.priceClass}`}>{tier.price}</span>
                  <span className="text-sm text-flow-gray-400">/mo</span>
                </p>
                <p className="text-xs text-flow-gray-500 mb-4">Billed monthly. Cancel anytime.</p>

                <div className={`text-xs font-medium ${tier.priceClass} bg-black/30 rounded-lg px-3 py-2 mb-5 text-center`}>
                  {tier.highlight}
                </div>

                <ul className="text-left text-sm text-flow-gray-300 space-y-2.5 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 ${tier.checkClass} mt-0.5 shrink-0`} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <a href={tier.paymentUrl} className={`${tier.btnClass} w-full text-center`}>
                  {tier.btnText}
                </a>
              </motion.div>
            ))}
          </div>

          {/* One-time upload */}
          <motion.div
            className="mt-10 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="glass-card border-flow-cyan/20 p-6 flex flex-col md:flex-row items-center gap-6 hover:border-flow-cyan/40 transition-all">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-block bg-flow-cyan/10 text-flow-cyan text-xs font-semibold px-3 py-1 rounded-full mb-2">
                  PAY PER VIDEO
                </div>
                <h3 className="font-display font-bold text-xl mb-1">Single Video Upload</h3>
                <p className="text-sm text-flow-gray-300">
                  Upload one video → AI captions, music & hashtags → posted to all platforms. No subscription needed.
                </p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-4xl font-display font-black text-flow-cyan mb-1">$5</p>
                <p className="text-xs text-flow-gray-500 mb-3">one-time</p>
                <a
                  href="https://buy.stripe.com/7sY00lfwTftEfRs2KQejK03"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm bg-flow-cyan/10 text-flow-cyan border border-flow-cyan/20 hover:bg-flow-cyan/20 transition-all"
                >
                  Upload Now
                </a>
              </div>
            </div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="glass-card border-flow-green/20 p-6 max-w-2xl mx-auto mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-display font-black text-flow-green">20+</p>
                  <p className="text-xs text-flow-gray-400">Hours saved / month</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-flow-magenta">4x</p>
                  <p className="text-xs text-flow-gray-400">More reach</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-flow-yellow">10x</p>
                  <p className="text-xs text-flow-gray-400">Faster distribution</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-flow-green/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-display font-semibold text-sm mb-3 text-flow-green">Platform</h4>
              <div className="space-y-2 text-xs text-flow-gray-400">
                <Link href="/auth/login" className="block hover:text-white transition-colors">Community Feed</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Upload Video</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Live Chat</Link>
                <Link href="#pricing" className="block hover:text-white transition-colors">Pricing</Link>
              </div>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3 text-flow-magenta">Bookings</h4>
              <div className="space-y-2 text-xs text-flow-gray-400">
                <Link href="/auth/login" className="block hover:text-white transition-colors">Find Artists</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Post a Gig</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Booking Profile</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Event Calendar</Link>
              </div>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3 text-flow-cyan">DJs</h4>
              <div className="space-y-2 text-xs text-flow-gray-400">
                <Link href="/djs" className="block hover:text-white transition-colors">DJ Profiles</Link>
                <Link href="/djs" className="block hover:text-white transition-colors">Upload Mixes</Link>
                <Link href="/djs" className="block hover:text-white transition-colors">Find DJs by State</Link>
                <Link href="/djs" className="block hover:text-white transition-colors">Book a DJ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3 text-flow-yellow">Company</h4>
              <div className="space-y-2 text-xs text-flow-gray-400">
                <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-flow-green/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-flow-gray-400">
            <span className="font-display">© 2026 Flow AI by <span className="text-flow-green">GWDF</span></span>
            <span className="text-flow-gray-500 text-xs">The ESPN of Flow Arts. <span className="text-flow-green">P</span><span className="text-flow-magenta">L</span><span className="text-flow-cyan">U</span><span className="text-flow-yellow">R</span></span>
            <span>Your Vibe Attracts Your Tribe</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
