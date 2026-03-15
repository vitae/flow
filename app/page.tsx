'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Upload, Sparkles, Music, Hash, Share2, Zap, ArrowRight, Check, Crown, Rocket, Users } from 'lucide-react';

const features = [
  { icon: Upload, title: 'Upload once', desc: 'Drag & drop your video — we handle the rest', color: 'text-flow-green' },
  { icon: Music, title: 'Trending music', desc: 'Auto-add royalty-free trending tracks from YouTube', color: 'text-flow-magenta' },
  { icon: Sparkles, title: 'AI captions', desc: 'Auto-generated captions burned into every video', color: 'text-flow-green' },
  { icon: Hash, title: 'Smart hashtags', desc: 'AI picks trending + niche hashtags per platform', color: 'text-flow-magenta' },
  { icon: Share2, title: 'Post everywhere', desc: 'YouTube, Instagram, Facebook, Threads — simultaneously', color: 'text-flow-green' },
  { icon: Zap, title: 'Auto-format', desc: 'Transcoded to each platform\'s ideal specs', color: 'text-flow-magenta' },
];

const platforms = [
  { name: 'YouTube', users: '2.7B', color: '#FF0000' },
  { name: 'Instagram', users: '2.4B', color: '#E4405F' },
  { name: 'Facebook', users: '3.1B', color: '#1877F2' },
  { name: 'Threads', users: '300M', color: '#8B5CF6' },
];

const tiers = [
  {
    name: 'Starter',
    price: '$9.99',
    subtitle: 'Perfect for flow artists just starting to build an audience',
    badge: null,
    badgeClass: '',
    priceClass: 'text-flow-green',
    checkClass: 'text-flow-green',
    borderClass: 'glass-card',
    btnClass: 'btn-secondary',
    btnText: 'Start Free Trial',
    paymentUrl: 'https://buy.stripe.com/cNi5kFacz1COax8fxCejK00',
    highlight: 'Save 20+ hours/month on video editing',
    features: [
      '10 videos / month',
      'Auto AI captions on every video',
      '2 platforms (YouTube + Instagram)',
      'Basic hashtag suggestions',
      'Standard processing speed',
      'Community music library (1K+ tracks)',
      'Basic video analytics',
      'Flow artist profile page',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$19.99',
    subtitle: 'For serious flow artists ready to grow & monetize',
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
      'AI captions + custom styles & colors',
      'All 4 platforms (YouTube, IG, FB, Threads)',
      'Trending music library (10K+ tracks)',
      'AI hashtags + trending tags per platform',
      'Priority processing (2x faster)',
      'Scheduled posting & smart queue',
      'Performance analytics dashboard',
      'Promo Boost — we repost you (2x/month)',
      'AI thumbnail generator',
      'Festival & gig discovery feed',
      'Brand partnership opportunities',
      'Priority email + chat support',
    ],
  },
  {
    name: 'Unlimited',
    price: '$29.99',
    subtitle: 'For pros, teams & brands who want maximum reach',
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
      'Unlimited videos — post as much as you want',
      'AI captions + custom fonts & animations',
      'All platforms + early access (TikTok, X coming)',
      'Full music library + upload your own audio',
      'AI hashtags + competitor analysis + viral trends',
      'Fastest processing (5x faster)',
      'Smart scheduling — AI picks best time to post',
      'Advanced analytics + audience growth insights',
      'Promo Boost — we repost you (8x/month)',
      'AI thumbnail + cover image generator',
      'Custom branding, watermarks & intro/outro',
      'Multi-account support (up to 5 brands)',
      'Team collaboration (3 seats included)',
      'Featured on GWDF.pro community spotlight',
      'API access for custom automation',
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
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="btn-secondary text-sm py-2 px-4">
              Log in
            </Link>
            <Link href="/auth/login" className="btn-primary text-sm py-2 px-4">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-flow-green/20 bg-flow-green/5 px-4 py-1.5 text-sm text-flow-green mb-8">
              <Zap className="w-3.5 h-3.5" />
              Powered by AI
            </div>

            <h1 className="font-display font-black text-5xl md:text-7xl leading-[1.1] tracking-tight mb-6">
              Upload once.
              <br />
              <span className="text-flow-green text-glow-green">Post everywhere.</span>
            </h1>

            <p className="text-lg md:text-xl text-flow-gray-200 max-w-2xl mx-auto mb-10 leading-relaxed">
              AI strips your audio, adds trending music, generates captions & hashtags,
              then posts to YouTube, Instagram, Facebook & Threads — all at once.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login" className="btn-primary text-lg px-8 py-4">
                Start uploading <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#features" className="btn-secondary text-lg px-8 py-4">
                See how it works
              </Link>
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
              Reach billions of users across every platform
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 rounded-xl border border-flow-gray-700 bg-flow-gray-900/50 px-5 py-3 hover:border-flow-gray-500 transition-all"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-display font-semibold text-sm">{p.name}</span>
                  <div className="flex items-center gap-1 text-flow-gray-400">
                    <Users className="w-3 h-3" />
                    <span className="text-xs font-medium">{p.users} users</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-flow-gray-600 mt-4">
              Combined reach of <span className="text-flow-green font-semibold">8.5 billion+</span> monthly active users
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              The full pipeline, <span className="text-flow-magenta text-glow-magenta">automated</span>
            </h2>
            <p className="text-flow-gray-300 text-lg">Six steps. Zero manual work.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="glass-card p-6 group hover:border-flow-green/30 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-10 h-10 rounded-lg bg-flow-gray-800 flex items-center justify-center mb-4 ${f.color} group-hover:bg-flow-green/10 transition-colors`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-flow-gray-300 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              Choose your <span className="text-flow-green">flow</span>
            </h2>
            <p className="text-flow-gray-300 text-lg">Start free. Scale when you&apos;re ready.</p>
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
                  <span className={`text-4xl font-display font-black ${tier.priceClass}`}>
                    {tier.price}
                  </span>
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
                  Upload one video and we&apos;ll post it to all your connected platforms with AI captions, trending music & hashtags. No subscription needed.
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

          {/* Social proof + urgency */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="glass-card border-flow-green/20 p-6 max-w-2xl mx-auto mb-8">
              <p className="text-flow-green font-display font-semibold text-sm mb-2">
                Why flow artists love Flow AI
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-display font-black text-flow-green">20+</p>
                  <p className="text-xs text-flow-gray-400">Hours saved per month</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-flow-magenta">4x</p>
                  <p className="text-xs text-flow-gray-400">More reach across platforms</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-black text-flow-yellow">10x</p>
                  <p className="text-xs text-flow-gray-400">Faster content distribution</p>
                </div>
              </div>
            </div>
            <p className="text-flow-gray-400 text-sm mb-4">
              Stop spending hours editing, captioning, and posting manually.
              <br />
              <span className="text-white font-medium">Upload once — reach billions.</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 text-flow-gray-500 text-xs">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-flow-magenta" />
                <span>10x faster distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-flow-yellow" />
                <span>AI-optimized for each platform</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-flow-green" />
                <span>Trending content engine</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-flow-green/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-flow-gray-400">
          <span className="font-display">© 2026 Flow AI by <span className="text-flow-green">GWDF</span></span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <span>Your Vibe Attracts Your Tribe</span>
        </div>
      </footer>
    </main>
  );
}
