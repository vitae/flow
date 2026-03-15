'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Upload, Link2, Settings, LogOut, Menu, X,
  Video, ChevronRight
} from 'lucide-react';
import type { User as FlowUser } from '@/lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload },
  { href: '/dashboard/connections', label: 'Connections', icon: Link2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<FlowUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-flow-dark border-r border-flow-green/10
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

          {/* User */}
          <div className="p-4 border-t border-flow-green/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-flow-green/20 flex items-center justify-center text-flow-green font-display font-bold text-xs">
                {user?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.display_name || 'Loading...'}</p>
                <p className="text-xs text-flow-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-flow-gray-400 hover:text-flow-red text-sm transition-colors w-full">
              <LogOut className="w-4 h-4" /> Sign out
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
