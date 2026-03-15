'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mic2, MapPin, Music, Calendar, Search, Star, Play,
  Globe, Users, ArrowRight, ChevronRight, Headphones, Radio
} from 'lucide-react';
import { useState } from 'react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

const GENRES = [
  'Bass Music', 'House', 'Techno', 'Dubstep', 'Drum & Bass',
  'Psytrance', 'Deep House', 'Progressive', 'Ambient', 'Breaks',
  'Glitch Hop', 'Future Bass', 'Melodic Bass', 'Midtempo',
];

const FEATURED_DJS = [
  {
    name: 'DJ Luminance',
    genres: ['Bass Music', 'Glitch Hop'],
    state: 'Colorado',
    city: 'Denver',
    bio: 'Bass-heavy sets for fire circles and festival stages. 8 years spinning at transformational events.',
    rate: '$150/hr',
    color: '#FF00FF',
  },
  {
    name: 'SolarBeats',
    genres: ['House', 'Deep House'],
    state: 'California',
    city: 'Los Angeles',
    bio: 'Sunset sets and deep grooves. Resident at Flow Fest LA. Available for private events and festivals.',
    rate: '$200/hr',
    color: '#00FFFF',
  },
  {
    name: 'Prism Sound',
    genres: ['Psytrance', 'Progressive'],
    state: 'Oregon',
    city: 'Portland',
    bio: 'Psychedelic journeys for flow jams. Regular at Pacific NW burns and underground events.',
    rate: '$125/hr',
    color: '#FFFF00',
  },
  {
    name: 'BassAlchemy',
    genres: ['Dubstep', 'Midtempo'],
    state: 'Texas',
    city: 'Austin',
    bio: 'Heavy wobbles meet melodic drops. Perfect for gloving and LED shows. 500+ events played.',
    rate: '$175/hr',
    color: '#00FF00',
  },
  {
    name: 'VelvetGroove',
    genres: ['Melodic Bass', 'Future Bass'],
    state: 'Florida',
    city: 'Miami',
    bio: 'Emotional basslines and uplifting energy. Festival mainstage and intimate flow circles.',
    rate: '$225/hr',
    color: '#FF6B6B',
  },
  {
    name: 'Frequency Shift',
    genres: ['Techno', 'Breaks'],
    state: 'New York',
    city: 'Brooklyn',
    bio: 'Dark warehouse techno meets breakbeat energy. Underground flow events and art installations.',
    rate: '$175/hr',
    color: '#8B5CF6',
  },
];

export default function DJsPage() {
  const [selectedState, setSelectedState] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDJs = FEATURED_DJS.filter((dj) => {
    if (selectedState && dj.state !== selectedState) return false;
    if (selectedGenre && !dj.genres.includes(selectedGenre)) return false;
    if (searchQuery && !dj.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
            <Link href="/#community" className="hover:text-flow-green transition-colors">Community</Link>
            <Link href="/#bookings" className="hover:text-flow-green transition-colors">Bookings</Link>
            <Link href="/djs" className="text-flow-cyan font-medium">DJs</Link>
            <Link href="/#pricing" className="hover:text-flow-green transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="btn-secondary text-sm py-2 px-4">
              Log in
            </Link>
            <Link href="/auth/login" className="btn-primary text-sm py-2 px-4">
              Create DJ Profile
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-flow-cyan/5 via-transparent to-flow-magenta/3 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-flow-cyan/20 bg-flow-cyan/5 px-4 py-1.5 text-sm text-flow-cyan mb-8">
              <Mic2 className="w-3.5 h-3.5" />
              DJ Platform by GWDF
            </div>

            <h1 className="font-display font-black text-4xl md:text-6xl leading-[1.1] tracking-tight mb-6">
              DJs: <span className="text-flow-cyan">promote your music.</span>
              <br />
              <span className="text-flow-magenta">Get booked</span> for shows.
            </h1>

            <p className="text-lg text-flow-gray-200 max-w-2xl mx-auto mb-4 leading-relaxed">
              Create your DJ profile, upload mixes, and get discovered by event producers
              looking for talent in your state. The flow arts community needs your sound.
            </p>

            <div className="flex items-center justify-center gap-3 text-sm mb-10">
              <span className="text-flow-green font-display font-semibold">Peace</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-magenta font-display font-semibold">Love</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-cyan font-display font-semibold">Unity</span>
              <span className="text-flow-gray-600">·</span>
              <span className="text-flow-yellow font-display font-semibold">Respect</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-display font-bold bg-flow-cyan text-black hover:bg-flow-cyan/90 transition-all text-lg">
                <Mic2 className="w-5 h-5" /> Create DJ Profile
              </Link>
              <a href="#browse" className="btn-secondary text-lg px-8 py-4">
                <Search className="w-5 h-5" /> Browse DJs
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-t border-flow-green/10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Mic2, title: 'Create Profile', desc: 'Add your stage name, genres, location, rates & bio', color: 'text-flow-cyan' },
              { icon: Music, title: 'Upload Mixes', desc: 'Share your best sets. Flow artists discover your sound', color: 'text-flow-magenta' },
              { icon: MapPin, title: 'Get Found', desc: 'Promoters search by state and genre to find you', color: 'text-flow-green' },
              { icon: Calendar, title: 'Get Booked', desc: 'Accept gigs, manage calendar, grow your career', color: 'text-flow-yellow' },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="glass-card p-6 text-center relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-flow-gray-800 border border-flow-gray-700 flex items-center justify-center text-xs font-bold text-flow-gray-400">
                  {i + 1}
                </div>
                <step.icon className={`w-8 h-8 ${step.color} mx-auto mb-3`} />
                <h3 className="font-display font-semibold mb-2">{step.title}</h3>
                <p className="text-xs text-flow-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse DJs */}
      <section id="browse" className="py-20 px-6 border-t border-flow-green/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              Find DJs <span className="text-flow-cyan">in your state</span>
            </h2>
            <p className="text-flow-gray-300">Browse by location, genre, or search by name</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-10 max-w-3xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flow-gray-500" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-flow-gray-900 border border-flow-gray-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:border-flow-cyan focus:outline-none"
              />
            </div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:border-flow-cyan focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">All States</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-flow-gray-900 border border-flow-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:border-flow-cyan focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">All Genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* DJ Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDJs.map((dj, i) => (
              <motion.div
                key={dj.name}
                className="glass-card p-6 hover:border-flow-cyan/20 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-xl"
                    style={{ backgroundColor: dj.color + '20', color: dj.color }}
                  >
                    {dj.name[0]}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold group-hover:text-flow-cyan transition-colors">{dj.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-flow-gray-400">
                      <MapPin className="w-3 h-3" />
                      {dj.city}, {dj.state}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-flow-gray-300 mb-4 line-clamp-2">{dj.bio}</p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {dj.genres.map((g) => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-flow-cyan/10 text-flow-cyan border border-flow-cyan/20">
                      {g}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-flow-gray-500">
                    <span className="flex items-center gap-1"><Headphones className="w-3 h-3" /> 3 mixes</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-flow-yellow" /> 4.8</span>
                  </div>
                  <span className="text-sm font-display font-semibold text-flow-cyan">{dj.rate}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href="/auth/login" className="flex-1 text-center text-xs py-2 rounded-lg bg-flow-cyan/10 text-flow-cyan border border-flow-cyan/20 hover:bg-flow-cyan/20 transition-all font-medium">
                    Book DJ
                  </Link>
                  <Link href="/auth/login" className="flex-1 text-center text-xs py-2 rounded-lg bg-flow-gray-800 text-flow-gray-300 border border-flow-gray-700 hover:border-flow-gray-500 transition-all font-medium">
                    View Profile
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredDJs.length === 0 && (
            <div className="text-center py-20">
              <Mic2 className="w-12 h-12 text-flow-gray-600 mx-auto mb-4" />
              <h3 className="font-display font-semibold text-lg mb-2">No DJs found</h3>
              <p className="text-flow-gray-400 text-sm mb-6">Try adjusting your filters or be the first DJ in this area!</p>
              <Link href="/auth/login" className="btn-primary text-sm">
                Create DJ Profile
              </Link>
            </div>
          )}

          <div className="text-center mt-12">
            <p className="text-flow-gray-400 text-sm mb-4">
              Don&apos;t see yourself here? Create your DJ profile and get discovered.
            </p>
            <Link href="/auth/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-display font-bold bg-flow-cyan text-black hover:bg-flow-cyan/90 transition-all">
              <Mic2 className="w-4 h-4" /> Create Your DJ Profile — Free
            </Link>
          </div>
        </div>
      </section>

      {/* CTA for event producers */}
      <section className="py-16 px-6 border-t border-flow-green/10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="glass-card border-flow-magenta/20 p-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Calendar className="w-10 h-10 text-flow-magenta mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl mb-3">
              Event Producer? <span className="text-flow-magenta">Post a gig.</span>
            </h2>
            <p className="text-flow-gray-300 mb-6 max-w-lg mx-auto">
              Looking for a DJ or flow artist for your next event? Post your gig details and let talent come to you.
              Browse by state, genre, and availability.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login" className="btn-magenta text-sm px-6 py-3">
                <Calendar className="w-4 h-4" /> Post a Gig — Free
              </Link>
              <Link href="/#bookings" className="btn-secondary text-sm px-6 py-3">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-flow-green/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-flow-gray-400">
          <span className="font-display">© 2026 Flow AI by <span className="text-flow-green">GWDF</span></span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <span className="text-xs">
            <span className="text-flow-green">P</span><span className="text-flow-magenta">L</span><span className="text-flow-cyan">U</span><span className="text-flow-yellow">R</span> · Your Vibe Attracts Your Tribe
          </span>
        </div>
      </footer>
    </main>
  );
}
