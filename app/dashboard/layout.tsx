'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Upload, Link2, Settings, LogOut, Menu, X,
  Video, ChevronRight, Sparkles, Rocket, MessageCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import type { User as FlowUser } from '@/lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload },
  { href: '/dashboard/connections', label: 'Connections', icon: Link2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const AI_PROMPTS = [
  {
    message: "Want to level up your flow arts? I can help you build a practice routine, find inspiration, and grow your audience.",
    cta: "Let's talk goals",
    type: 'coach' as const,
  },
  {
    message: "Ready to make money doing what you love? Flow artists are earning through performances, tutorials, and brand deals.",
    cta: "Show me how",
    type: 'monetize' as const,
  },
  {
    message: "Want a promo boost? Upload a 1-min video and we'll repost it across every platform to grow your following.",
    cta: "Boost my profile",
    type: 'boost' as const,
  },
];

const COACH_QUESTIONS = [
  "What flow toy are you most focused on right now?",
  "How long have you been practicing flow arts?",
  "What's your biggest challenge — technique, creativity, or consistency?",
  "Do you perform live or mainly create content?",
  "Are you looking to go pro or keep it as a passion?",
  "What would your dream flow career look like?",
];

const MONETIZE_TIPS = [
  "Teach workshops — online or at festivals. Flow artists charge $50-200/hr for private lessons.",
  "Create tutorial content — YouTube and Instagram tutorials build audience & ad revenue.",
  "Brand partnerships — LED prop companies sponsor artists with 5K+ followers.",
  "Festival performances — flow stages at EDM festivals pay $200-1000/set.",
  "Custom prop reviews — manufacturers send free gear for honest reviews.",
  "Sell your own content packs — transitions, combos, and tutorials as digital products.",
];

const BOOST_INFO = {
  title: "GWDF Pro Boost",
  description: "Upload a 1-minute highlight reel and we'll distribute it across YouTube Shorts, Instagram Reels, Facebook, and Threads — all at once. Our AI adds trending music, captions, and hashtags to maximize your reach.",
  steps: [
    "Upload your best 1-min flow video",
    "Our AI adds captions, trending music & hashtags",
    "We post to every connected platform simultaneously",
    "Watch your audience grow across all channels",
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<FlowUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [aiView, setAiView] = useState<'prompts' | 'coach' | 'monetize' | 'boost'>('prompts');
  const [coachStep, setCoachStep] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) setUser(data as FlowUser);
    };
    getUser();
  }, []);

  // Rotate AI prompts
  useEffect(() => {
    if (aiView !== 'prompts') return;
    const interval = setInterval(() => {
      setCurrentPromptIndex(prev => (prev + 1) % AI_PROMPTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [aiView]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAiCta = (type: 'coach' | 'monetize' | 'boost') => {
    setAiView(type);
    setAiExpanded(true);
    setCoachStep(0);
  };

  const userColor = user?.favorite_color || '#00FF00';

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-flow-dark border-r border-flow-green/10
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-flow-green/10">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-flow-green flex items-center justify-center">
                <span className="font-display font-black text-black text-sm">F</span>
              </div>
              <span className="font-display font-bold text-lg">
                <span className="text-flow-green">FLOW</span>
                <span className="text-flow-gray-400 ml-1 text-xs">AI</span>
              </span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-flow-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Upload CTA */}
          <div className="p-4">
            <Link href="/dashboard/upload" className="btn-primary w-full text-sm">
              <Upload className="w-4 h-4" /> Upload video
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                    ${active
                      ? 'bg-flow-green/10 text-flow-green border border-flow-green/20'
                      : 'text-flow-gray-300 hover:bg-flow-gray-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  {item.label}
                  {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* AI Coach Section */}
          <div className="px-3 pb-2">
            <button
              onClick={() => {
                setAiExpanded(!aiExpanded);
                if (!aiExpanded) setAiView('prompts');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-flow-magenta/10 to-purple-500/10 border border-flow-magenta/20 hover:border-flow-magenta/40 transition-all"
            >
              <Sparkles className="w-4 h-4 text-flow-magenta" />
              <span className="text-xs font-medium text-flow-magenta flex-1 text-left">Flow AI Coach</span>
              {aiExpanded ? <ChevronDown className="w-3.5 h-3.5 text-flow-magenta" /> : <ChevronUp className="w-3.5 h-3.5 text-flow-magenta" />}
            </button>

            {aiExpanded && (
              <div className="mt-2 rounded-lg bg-flow-gray-900/80 border border-flow-gray-700 p-3 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                {aiView === 'prompts' && (
                  <>
                    <div className="flex items-start gap-2">
                      <MessageCircle className="w-4 h-4 text-flow-magenta mt-0.5 shrink-0" />
                      <p className="text-xs text-flow-gray-300 leading-relaxed">
                        {AI_PROMPTS[currentPromptIndex].message}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAiCta(AI_PROMPTS[currentPromptIndex].type)}
                      className="w-full text-xs font-medium py-2 rounded-lg bg-flow-magenta/10 text-flow-magenta border border-flow-magenta/20 hover:bg-flow-magenta/20 transition-all"
                    >
                      {AI_PROMPTS[currentPromptIndex].cta}
                    </button>
                    <div className="flex justify-center gap-1">
                      {AI_PROMPTS.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPromptIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                            i === currentPromptIndex ? 'bg-flow-magenta w-4' : 'bg-flow-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {aiView === 'coach' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-flow-magenta" />
                      <span className="text-xs font-semibold text-flow-magenta">Flow Coach</span>
                    </div>
                    <div className="bg-flow-magenta/5 rounded-lg p-2.5 border border-flow-magenta/10">
                      <p className="text-xs text-flow-gray-300 leading-relaxed">
                        {COACH_QUESTIONS[coachStep]}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {coachStep > 0 && (
                        <button
                          onClick={() => setCoachStep(prev => prev - 1)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-flow-gray-700 text-flow-gray-400 hover:text-white transition-colors"
                        >
                          Back
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (coachStep < COACH_QUESTIONS.length - 1) {
                            setCoachStep(prev => prev + 1);
                          } else {
                            setAiView('prompts');
                          }
                        }}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-flow-magenta/10 text-flow-magenta border border-flow-magenta/20 hover:bg-flow-magenta/20 transition-all"
                      >
                        {coachStep < COACH_QUESTIONS.length - 1 ? 'Next' : 'Done'}
                      </button>
                    </div>
                    <button onClick={() => setAiView('prompts')} className="text-[10px] text-flow-gray-500 hover:text-flow-gray-300 w-full text-center">
                      Back to menu
                    </button>
                  </>
                )}

                {aiView === 'monetize' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Rocket className="w-3.5 h-3.5 text-flow-green" />
                      <span className="text-xs font-semibold text-flow-green">Make Money Flowing</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {MONETIZE_TIPS.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 bg-flow-green/5 rounded-lg p-2 border border-flow-green/10">
                          <span className="text-flow-green text-xs font-bold mt-0.5">{i + 1}</span>
                          <p className="text-xs text-flow-gray-300 leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/dashboard/upload"
                      className="block w-full text-xs font-medium py-2 rounded-lg bg-flow-green/10 text-flow-green border border-flow-green/20 hover:bg-flow-green/20 transition-all text-center"
                    >
                      Start creating content
                    </Link>
                    <button onClick={() => setAiView('prompts')} className="text-[10px] text-flow-gray-500 hover:text-flow-gray-300 w-full text-center">
                      Back to menu
                    </button>
                  </>
                )}

                {aiView === 'boost' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Rocket className="w-3.5 h-3.5 text-flow-yellow" />
                      <span className="text-xs font-semibold text-flow-yellow">{BOOST_INFO.title}</span>
                    </div>
                    <p className="text-xs text-flow-gray-300 leading-relaxed">
                      {BOOST_INFO.description}
                    </p>
                    <div className="space-y-1.5">
                      {BOOST_INFO.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-flow-yellow/10 border border-flow-yellow/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-flow-yellow">{i + 1}</span>
                          </div>
                          <p className="text-xs text-flow-gray-400">{step}</p>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/dashboard/upload"
                      className="block w-full text-xs font-medium py-2 rounded-lg bg-flow-yellow/10 text-flow-yellow border border-flow-yellow/20 hover:bg-flow-yellow/20 transition-all text-center"
                    >
                      Upload & Boost Now
                    </Link>
                    <button onClick={() => setAiView('prompts')} className="text-[10px] text-flow-gray-500 hover:text-flow-gray-300 w-full text-center">
                      Back to menu
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* User Profile Card */}
          <div className="p-3 border-t border-flow-green/10">
            <Link href="/dashboard/settings" className="block rounded-lg bg-flow-gray-900/50 border border-flow-gray-800 hover:border-flow-green/20 p-3 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                  style={{
                    backgroundColor: userColor + '20',
                    color: userColor,
                    border: `2px solid ${userColor}40`,
                  }}
                >
                  {user?.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-flow-green transition-colors">
                    {user?.display_name || 'Set up profile'}
                  </p>
                  <p className="text-[10px] text-flow-gray-500 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Flow toys badges */}
              {user?.flow_toys && user.flow_toys.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {user.flow_toys.slice(0, 3).map((toy) => (
                    <span
                      key={toy}
                      className="text-[9px] px-1.5 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: userColor + '10',
                        color: userColor,
                        borderColor: userColor + '30',
                      }}
                    >
                      {toy}
                    </span>
                  ))}
                  {user.flow_toys.length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-flow-gray-800 text-flow-gray-500">
                      +{user.flow_toys.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Bio preview */}
              {user?.bio && (
                <p className="text-[10px] text-flow-gray-500 line-clamp-2 leading-relaxed mb-2">
                  {user.bio}
                </p>
              )}

              {/* Location */}
              {user?.location && (
                <p className="text-[10px] text-flow-gray-600 truncate">
                  {user.location}
                </p>
              )}

              {/* Subscription badge */}
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                  user?.subscription_tier === 'pro'
                    ? 'bg-flow-magenta/10 text-flow-magenta border border-flow-magenta/20'
                    : 'bg-flow-gray-800 text-flow-gray-500 border border-flow-gray-700'
                }`}>
                  {user?.subscription_tier === 'pro' ? 'PRO' : 'FREE'}
                </span>
                <span className="text-[9px] text-flow-gray-600 group-hover:text-flow-green transition-colors">
                  Edit profile →
                </span>
              </div>
            </Link>

            <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-flow-gray-500 hover:text-flow-red text-xs transition-colors w-full mt-2 py-1.5">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-flow-green/10 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-flow-gray-400">
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Video className="w-5 h-5 text-flow-green" />
            <span className="font-display font-bold text-flow-green">FLOW</span>
          </Link>
          <div className="w-6" />
        </header>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
