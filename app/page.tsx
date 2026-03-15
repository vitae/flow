'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Upload, Sparkles, Music, Hash, Share2, Zap, ArrowRight } from 'lucide-react';

const features = [
  { icon: Upload, title: 'Upload once', desc: 'Drag & drop your video — we handle the rest', color: 'text-flow-green' },
  { icon: Music, title: 'Trending music', desc: 'Auto-add royalty-free trending tracks from YouTube', color: 'text-flow-magenta' },
  { icon: Sparkles, title: 'AI captions', desc: 'Auto-generated captions burned into every video', color: 'text-flow-green' },
  { icon: Hash, title: 'Smart hashtags', desc: 'AI picks trending + niche hashtags per platform', color: 'text-flow-magenta' },
  { icon: Share2, title: 'Post everywhere', desc: 'YouTube, Instagram, Facebook, X — simultaneously', color: 'text-flow-green' },
  { icon: Zap, title: 'Auto-format', desc: 'Transcoded to each platform\'s ideal specs', color: 'text-flow-magenta' },
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
              then posts to YouTube, Instagram, Facebook & X — all at once.
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

          {/* Platform icons */}
          <motion.div
            className="mt-16 flex items-center justify-center gap-8 text-flow-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-sm uppercase tracking-wider">Distributes to</span>
            <div className="flex gap-6 text-flow-gray-300">
              {['YouTube', 'Instagram', 'Facebook', 'X'].map((p) => (
                <span key={p} className="font-display font-semibold text-sm border border-flow-gray-600 rounded-lg px-3 py-1">
                  {p}
                </span>
              ))}
            </div>
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
      <section className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl mb-12">
            Simple <span className="text-flow-green">pricing</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="glass-card p-8">
              <h3 className="font-display font-bold text-xl mb-2">Free</h3>
              <p className="text-3xl font-display font-black text-flow-green mb-4">$0<span className="text-sm text-flow-gray-400">/mo</span></p>
              <ul className="text-left text-sm text-flow-gray-300 space-y-2 mb-6">
                <li>• 3 videos / month</li>
                <li>• Auto captions</li>
                <li>• 2 platforms max</li>
              </ul>
              <Link href="/auth/login" className="btn-secondary w-full">Get started</Link>
            </div>
            <div className="glass-card-magenta p-8 border-flow-magenta/30">
              <div className="inline-block bg-flow-magenta/10 text-flow-magenta text-xs font-semibold px-3 py-1 rounded-full mb-3">POPULAR</div>
              <h3 className="font-display font-bold text-xl mb-2">Pro</h3>
              <p className="text-3xl font-display font-black text-flow-magenta mb-4">$29<span className="text-sm text-flow-gray-400">/mo</span></p>
              <ul className="text-left text-sm text-flow-gray-300 space-y-2 mb-6">
                <li>• Unlimited videos</li>
                <li>• All 4 platforms</li>
                <li>• Trending music + hashtags</li>
                <li>• Priority processing</li>
              </ul>
              <Link href="/auth/login" className="btn-magenta w-full">Go Pro</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-flow-green/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-flow-gray-400">
          <span className="font-display">© 2026 Flow AI by <span className="text-flow-green">GWDF</span></span>
          <span>Your Vibe Attracts Your Tribe</span>
        </div>
      </footer>
    </main>
  );
}
