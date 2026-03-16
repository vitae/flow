'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import {
  Search, Download, Volume2, Scissors, PenTool, Upload, Cookie, Music,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, ExternalLink,
  Zap, TrendingUp, Terminal, ChevronRight, ArrowRight, X, UploadCloud,
  Film, Smartphone,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────── */
interface Activity {
  id: string;
  agent: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Post {
  id: string;
  status: string;
  title: string | null;
  ig_like_count: number;
  ig_permalink: string;
  youtube_video_id: string | null;
  ig_reels_id: string | null;
  fb_reels_id: string | null;
  error_message: string | null;
  failed_at_stage: string | null;
  created_at: string;
}

interface DashboardData {
  pipeline: Record<string, number>;
  activity: Activity[];
  posts: Post[];
}

/* ── Agent Definitions ──────────────────────────────────────── */
const AGENTS = [
  { id: 'scout', label: 'SCOUT', icon: Search, color: '#00FFFF', role: 'Discovers trending content', order: 1 },
  { id: 'downloader', label: 'DOWNLOADER', icon: Download, color: '#00FF00', role: 'Fetches video files', order: 2 },
  { id: 'audio_engineer', label: 'AUDIO ENG', icon: Volume2, color: '#FFFF00', role: 'Processes audio tracks', order: 3 },
  { id: 'editor', label: 'EDITOR', icon: Scissors, color: '#FF00FF', role: 'Edits & optimizes clips', order: 4 },
  { id: 'copywriter', label: 'COPYWRITER', icon: PenTool, color: '#FF8800', role: 'Generates titles & tags', order: 5 },
  { id: 'publisher', label: 'PUBLISHER', icon: Upload, color: '#00FF00', role: 'Uploads to platforms', order: 6 },
  { id: 'music_adder', label: 'MUSIC', icon: Music, color: '#FF00FF', role: 'Adds trending audio', order: 7 },
  { id: 'cookie_refresher', label: 'COOKIES', icon: Cookie, color: '#FFFF00', role: 'Refreshes sessions', order: 8 },
];

const PIPELINE_AGENTS = ['scout', 'downloader', 'audio_engineer', 'editor', 'copywriter', 'publisher'];
const SUPPORT_AGENTS = ['music_adder', 'cookie_refresher'];

/** Interval in ms between each agent's runs */
const AGENT_INTERVALS: Record<string, number> = {
  scout: 6 * 60 * 60 * 1000,        // 6 hours (IG API rate limit)
  downloader: 10 * 1000,             // 10 seconds (reactive)
  audio_engineer: 10 * 1000,         // 10 seconds (reactive)
  editor: 10 * 1000,                 // 10 seconds (reactive)
  copywriter: 10 * 1000,             // 10 seconds (reactive)
  publisher: 60 * 1000,              // 60 seconds (reactive, 8/day cap)
  music_adder: 30 * 1000,            // 30 seconds (reactive)
  cookie_refresher: 45 * 60 * 1000,  // 45 minutes
};

const PIPELINE_STAGES = [
  { status: 'pending', label: 'PEND', color: '#444' },
  { status: 'downloading', label: 'DWNL', color: '#00FFFF' },
  { status: 'downloaded', label: 'DONE', color: '#00FFFF' },
  { status: 'audio_search', label: 'AUD', color: '#FFFF00' },
  { status: 'audio_ready', label: 'AUD+', color: '#FFFF00' },
  { status: 'edited', label: 'EDIT', color: '#FF00FF' },
  { status: 'metadata_ready', label: 'META', color: '#FF8800' },
  { status: 'uploading', label: 'UPLD', color: '#00FF00' },
  { status: 'posted', label: 'LIVE', color: '#00FF00' },
  { status: 'failed', label: 'FAIL', color: '#FF0000' },
];

/* ── Helpers ────────────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Countdown until next run: interval - (now - lastActivity) */
function getCountdown(agentId: string, lastActivityTime: string | undefined): { label: string; nextRunTime: string } {
  const interval = AGENT_INTERVALS[agentId] || 10000;
  if (!lastActivityTime) {
    // No activity yet — show when next run would be based on interval from now
    const nextRun = new Date(Date.now() + interval);
    const nextRunStr = nextRun.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { label: 'WAITING', nextRunTime: nextRunStr };
  }
  const elapsed = Date.now() - new Date(lastActivityTime).getTime();
  const remaining = Math.max(0, interval - elapsed);
  const nextRun = new Date(Date.now() + remaining);
  const nextRunStr = nextRun.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (remaining === 0) return { label: 'DUE NOW', nextRunTime: nextRunStr };
  if (remaining < 60000) return { label: `${Math.ceil(remaining / 1000)}s`, nextRunTime: nextRunStr };
  if (remaining < 3600000) {
    const m = Math.floor(remaining / 60000);
    const s = Math.ceil((remaining % 60000) / 1000);
    return { label: `${m}m ${s}s`, nextRunTime: nextRunStr };
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return { label: `${h}h ${m}m`, nextRunTime: nextRunStr };
}

function getIntervalLabel(agentId: string): string {
  const ms = AGENT_INTERVALS[agentId] || 10000;
  if (ms < 60000) return `every ${ms / 1000}s`;
  if (ms < 3600000) return `every ${ms / 60000}m`;
  return `every ${ms / 3600000}h`;
}

function ts(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function activityToLogLines(act: Activity, color: string): { text: string; color: string; dim?: boolean }[] {
  const lines: { text: string; color: string; dim?: boolean }[] = [];
  const t = ts(act.created_at);

  switch (act.action) {
    case 'discovered':
      lines.push({ text: `[${t}] DISCOVERED viral content`, color });
      if (act.details.hashtag) lines.push({ text: `  hashtag: #${String(act.details.hashtag)}`, color, dim: true });
      if (act.details.top_likes) lines.push({ text: `  likes: ${Number(act.details.top_likes).toLocaleString()}`, color, dim: true });
      if (act.details.queued) lines.push({ text: `  queued: +${String(act.details.queued)}`, color, dim: true });
      break;
    case 'processing':
      lines.push({ text: `[${t}] PROCESSING`, color });
      if (act.details.title) lines.push({ text: `  "${String(act.details.title).slice(0, 45)}"`, color, dim: true });
      break;
    case 'completed':
      lines.push({ text: `[${t}] COMPLETED`, color: '#00FF00' });
      if (act.details.output_status) lines.push({ text: `  > ${String(act.details.output_status)}`, color: '#00FF00', dim: true });
      break;
    case 'published':
      lines.push({ text: `[${t}] PUBLISHED`, color: '#00FF00' });
      break;
    case 'refreshed':
      lines.push({ text: `[${t}] REFRESHED`, color });
      if (act.details.cookies_count) lines.push({ text: `  cookies: ${String(act.details.cookies_count)}`, color, dim: true });
      break;
    case 'heartbeat':
      lines.push({ text: `[${t}] ALIVE — ${String(act.details.status || 'polling')}`, color, dim: true });
      break;
    case 'error':
      lines.push({ text: `[${t}] ERROR`, color: '#FF0000' });
      if (act.details.error) lines.push({ text: `  ${String(act.details.error).slice(0, 60)}`, color: '#FF0000', dim: true });
      break;
    default:
      lines.push({ text: `[${t}] ${act.action.toUpperCase()}`, color });
      break;
  }
  return lines;
}

function getThinking(agentId: string, lastAct: Activity | undefined): { thinking: string; next: string } {
  if (!lastAct) return { thinking: 'Idle. Waiting for work...', next: 'Poll for new tasks' };
  if (lastAct.action === 'heartbeat') return { thinking: 'Running. Polling for work...', next: `Status: ${String(lastAct.details.status || 'active')}` };
  if (lastAct.action === 'error') return { thinking: 'Last run failed. Will retry.', next: 'Retry after cooldown' };

  const map: Record<string, Record<string, { thinking: string; next: string }>> = {
    scout: {
      discovered: { thinking: 'Found viral content. Evaluating metrics.', next: 'Scan next hashtag batch' },
      _default: { thinking: 'Scanning trending hashtags...', next: 'Query Instagram Graph API' },
    },
    downloader: {
      completed: { thinking: 'Download complete. File saved.', next: 'Check pending downloads' },
      processing: { thinking: 'Fetching video from CDN...', next: 'Save to storage' },
      _default: { thinking: 'Monitoring download queue...', next: 'Poll pending posts' },
    },
    audio_engineer: {
      completed: { thinking: 'Audio extracted and analyzed.', next: 'Check downloaded queue' },
      processing: { thinking: 'Stripping audio track...', next: 'Run frequency analysis' },
      _default: { thinking: 'Waiting for downloads...', next: 'Poll downloaded queue' },
    },
    editor: {
      completed: { thinking: 'Video trimmed for Shorts.', next: 'Check audio_ready videos' },
      processing: { thinking: 'Trimming to Shorts format...', next: 'Apply filters' },
      _default: { thinking: 'Waiting for processed audio...', next: 'Poll audio_ready queue' },
    },
    copywriter: {
      completed: { thinking: 'Title & hashtags generated.', next: 'Check edited videos' },
      processing: { thinking: 'Generating viral title with AI...', next: 'Write SEO description' },
      _default: { thinking: 'Waiting for edited videos...', next: 'Poll edited queue' },
    },
    publisher: {
      published: { thinking: 'Content live on all platforms!', next: 'Check for next ready video (8/day cap)' },
      processing: { thinking: 'Uploading to YouTube Shorts...', next: 'Post to IG & FB Reels' },
      _default: { thinking: 'Checking metadata_ready queue...', next: 'Upload highest viral first' },
    },
    music_adder: {
      completed: { thinking: 'Trending audio added.', next: 'Check next video' },
      _default: { thinking: 'Monitoring for videos needing music...', next: 'Search trending sounds' },
    },
    cookie_refresher: {
      refreshed: { thinking: 'Sessions refreshed.', next: 'Sleep 45m' },
      _default: { thinking: 'Preparing refresh cycle...', next: 'Launch headless browser' },
    },
  };

  const agentMap = map[agentId] || {};
  return agentMap[lastAct.action] || agentMap._default || { thinking: 'Processing...', next: 'Continue' };
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'posted': return <CheckCircle2 className="w-5 h-5 drop-shadow-[0_0_6px_#00FF00]" style={{ color: '#00FF00' }} />;
    case 'failed': return <AlertTriangle className="w-5 h-5 drop-shadow-[0_0_6px_#FF0000]" style={{ color: '#FF0000' }} />;
    case 'uploading': case 'processing': case 'audio_search':
      return <Loader2 className="w-5 h-5 animate-spin drop-shadow-[0_0_6px_#00FFFF]" style={{ color: '#00FFFF' }} />;
    case 'metadata_ready': return <Zap className="w-5 h-5 drop-shadow-[0_0_6px_#FF8800]" style={{ color: '#FF8800' }} />;
    default: return <Clock className="w-5 h-5 text-flow-gray-600" />;
  }
}

/* ── Three.js Mini Orb ──────────────────────────────────────── */
function GlassOrb({ color, isActive }: { color: string; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const col = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.4;
      meshRef.current.scale.setScalar(isActive ? 1 + Math.sin(t * 2.5) * 0.06 : 1);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.6;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isActive ? 0.5 + Math.sin(t * 3) * 0.3 : 0.1;
    }
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.015, 16, 48]} />
        <meshBasicMaterial color={col} transparent opacity={0.1} />
      </mesh>
      <Float speed={isActive ? 3 : 1.5} rotationIntensity={0.15} floatIntensity={isActive ? 0.3 : 0.1}>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[0.75, 1]} />
          <MeshTransmissionMaterial
            backside samples={4} thickness={0.25} chromaticAberration={0.1}
            anisotropy={0.15} distortion={0.08} distortionScale={0.15}
            temporalDistortion={0.08} iridescence={1} iridescenceIOR={1}
            iridescenceThicknessRange={[0, 1400]} color={col}
            transmission={0.95} roughness={0.05}
          />
        </mesh>
      </Float>
      {isActive && (
        <mesh scale={1.5}>
          <sphereGeometry args={[0.75, 24, 24]} />
          <meshBasicMaterial color={col} transparent opacity={0.06} />
        </mesh>
      )}
      <ambientLight intensity={0.15} />
      <pointLight position={[2, 2, 2]} intensity={0.4} color={color} />
      <Environment preset="night" />
    </>
  );
}

/* ── Flower of Life Loader ──────────────────────────────────── */
function FlowerOfLifeLoader() {
  const PLUR = ['#00FF00', '#FF00FF', '#00FFFF', '#FFFF00', '#FF0000', '#FF8800', '#00FF88'];
  const R = 28; // circle radius
  const CX = 80; // center x
  const CY = 80; // center y

  // 7 circles: 1 center + 6 surrounding at 60° intervals
  const circles: { cx: number; cy: number }[] = [{ cx: CX, cy: CY }];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    circles.push({ cx: CX + R * Math.cos(angle), cy: CY + R * Math.sin(angle) });
  }

  return (
    <div className="w-40 h-40 relative">
      <svg viewBox="0 0 160 160" className="w-full h-full">
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={R}
            fill="none"
            strokeWidth={1.5}
            stroke={PLUR[i % PLUR.length]}
            strokeDasharray={`${2 * Math.PI * R}`}
            strokeDashoffset={`${2 * Math.PI * R}`}
            style={{
              animation: `flower-draw 2s ease-in-out ${i * 0.2}s infinite`,
              filter: `drop-shadow(0 0 4px ${PLUR[i % PLUR.length]}) drop-shadow(0 0 8px ${PLUR[i % PLUR.length]}60)`,
            }}
          />
        ))}
      </svg>
      <style>{`
        @keyframes flower-draw {
          0% { stroke-dashoffset: ${2 * Math.PI * R}; opacity: 0.3; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: ${-(2 * Math.PI * R)}; opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

/* ── Glass UI ───────────────────────────────────────────────── */
function GlowstickBar({ color, width }: { color: string; width: string }) {
  return (
    <div className="h-1.5 rounded-full" style={{
      width, background: color,
      boxShadow: `0 0 4px ${color}, 0 0 8px ${color}80, 0 0 16px ${color}40`,
    }} />
  );
}

function GlassCard({ children, borderColor = '#00FF0030', glowColor = '#00FF00', className = '' }: {
  children: React.ReactNode; borderColor?: string; glowColor?: string; className?: string;
}) {
  return (
    <div className={`rounded-2xl p-6 relative overflow-hidden ${className}`} style={{
      background: 'rgba(5, 5, 5, 0.8)', backdropFilter: 'blur(20px)',
      border: `1px solid ${borderColor}`,
      boxShadow: `0 0 30px ${glowColor}10, inset 0 0 30px ${glowColor}05`,
    }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${glowColor}30, transparent)` }} />
      {children}
    </div>
  );
}

/* ── Agent Terminal Card ────────────────────────────────────── */
function AgentTerminal({
  agent, activities, isActive, hasError, pulsePhase, countdown,
}: {
  agent: typeof AGENTS[number];
  activities: Activity[];
  isActive: boolean;
  hasError: boolean;
  pulsePhase: number;
  countdown: { label: string; nextRunTime: string };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAct = activities[0];
  const { thinking, next } = getThinking(agent.id, lastAct);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activities]);

  const logLines = useMemo(() => {
    const reversed = [...activities].reverse();
    const lines: { text: string; color: string; dim?: boolean }[] = [];
    for (const act of reversed) lines.push(...activityToLogLines(act, agent.color));
    return lines;
  }, [activities, agent.color]);

  const borderCol = hasError ? '#FF0000' : isActive ? agent.color : '#1a1a1a';

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-500 relative"
      style={{
        background: 'rgba(5, 5, 5, 0.85)',
        backdropFilter: 'blur(20px)',
        border: `2px solid ${borderCol}${isActive ? '70' : '40'}`,
        boxShadow: isActive
          ? `0 0 40px ${agent.color}20, 0 0 80px ${agent.color}10, inset 0 0 30px ${agent.color}08`
          : hasError ? '0 0 30px #FF000015' : 'none',
        minHeight: 460,
      }}
    >
      {/* Directional pulse border — sweeps clockwise */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none z-20"
        style={{
          background: `conic-gradient(from ${pulsePhase * 360}deg, ${agent.color}00, ${agent.color}${isActive ? '40' : '15'}, ${agent.color}00, ${agent.color}00)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '2px',
          borderRadius: 'inherit',
        }}
      />

      {/* Glass top highlight */}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${agent.color}50, transparent)` }} />

      {/* Order badge */}
      <div
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-pixel text-sm z-10"
        style={{
          background: `${agent.color}15`,
          border: `1px solid ${agent.color}30`,
          color: agent.color,
          textShadow: `0 0 6px ${agent.color}`,
        }}
      >
        {agent.order}
      </div>

      {/* Terminal Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: `${agent.color}15`, background: `${agent.color}06` }}>
        {/* 3D orb */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center" style={{ background: `${agent.color}10` }}>
              <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
            </div>
          }>
            <Canvas camera={{ position: [0, 0, 2.8], fov: 45 }} dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
              <GlassOrb color={agent.color} isActive={isActive} />
            </Canvas>
          </Suspense>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-base tracking-wider" style={{ color: agent.color, textShadow: `0 0 8px ${agent.color}80` }}>
              {agent.label}
            </span>
            {isActive && !hasError && (
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: agent.color, boxShadow: `0 0 8px ${agent.color}` }} />
            )}
            {hasError && <AlertTriangle className="w-5 h-5" style={{ color: '#FF0000' }} />}
          </div>
          <div className="font-mono text-sm text-white mt-0.5">{agent.role}</div>
        </div>

        <Terminal className="w-5 h-5 flex-shrink-0" style={{ color: `${agent.color}40` }} />
      </div>

      {/* Thinking + Next + Countdown bar */}
      <div className="px-5 py-3 border-b space-y-2" style={{ borderColor: `${agent.color}10`, background: `${agent.color}03` }}>
        <div className="flex items-start gap-2">
          <span className="font-pixel text-[10px] tracking-wider shrink-0 mt-0.5" style={{ color: `${agent.color}` }}>THINK</span>
          <span className="font-mono text-sm leading-snug" style={{ color: `${agent.color}` }}>{thinking}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-pixel text-[10px] tracking-wider shrink-0 mt-0.5" style={{ color: '#00FF00' }}>NEXT</span>
          <span className="font-mono text-sm text-white leading-snug flex items-center gap-1">
            <ChevronRight className="w-4 h-4 inline flex-shrink-0" style={{ color: '#00FF00' }} />
            {next}
          </span>
        </div>
        {/* Countdown timer */}
        <div className="flex items-center gap-2 pt-1">
          <span className="font-pixel text-[10px] tracking-wider shrink-0" style={{ color: countdown.label === 'DUE NOW' ? '#00FF00' : agent.color }}>
            TIMER
          </span>
          <div className="flex items-center gap-3 flex-1">
            <span
              className={`font-pixel text-base tracking-wider ${countdown.label === 'DUE NOW' ? 'animate-pulse' : ''}`}
              style={{
                color: countdown.label === 'DUE NOW' ? '#00FF00' : agent.color,
                textShadow: countdown.label === 'DUE NOW' ? '0 0 10px #00FF00' : `0 0 6px ${agent.color}60`,
              }}
            >
              {countdown.label}
            </span>
            <span className="font-mono text-sm text-white">@ {countdown.nextRunTime}</span>
            <span className="font-mono text-xs text-white/50">({getIntervalLabel(agent.id)})</span>
          </div>
        </div>
      </div>

      {/* Terminal Log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-1 font-mono text-sm leading-relaxed"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${agent.color}30 transparent` }}>
        {logLines.length === 0 ? (
          <div className="text-white/40 py-6 text-center">
            <span className="font-pixel text-xs tracking-wider">NO ACTIVITY YET</span>
            <div className="mt-2 text-base text-white/30">Waiting for events...</div>
          </div>
        ) : (
          logLines.map((line, i) => (
            <div key={i} style={{
              color: line.dim ? '#FFFFFFCC' : line.color,
              textShadow: !line.dim ? `0 0 4px ${line.color}40` : 'none',
            }}>
              {line.text}
            </div>
          ))
        )}
        <div className="flex items-center gap-1 mt-1">
          <span style={{ color: agent.color }}>$</span>
          <span className="inline-block w-3 h-5 animate-pulse" style={{ background: `${agent.color}80` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t flex items-center justify-between" style={{ borderColor: `${agent.color}10`, background: `${agent.color}03` }}>
        <span className="font-pixel text-[10px] tracking-widest" style={{ color: agent.color }}>{activities.length} EVENTS</span>
        {lastAct && <span className="font-pixel text-[10px] tracking-wider" style={{ color: isActive ? agent.color : 'white' }}>LAST: {timeAgo(lastAct.created_at)}</span>}
        <span className="font-pixel text-[10px] tracking-widest" style={{ color: isActive ? agent.color : hasError ? '#FF0000' : 'white' }}>
          {isActive ? 'ONLINE' : hasError ? 'ERROR' : 'IDLE'}
        </span>
      </div>
    </div>
  );
}

/* ── Directional Flow Arrow ─────────────────────────────────── */
function FlowArrow({ fromColor, toColor, pulsePhase }: { fromColor: string; toColor: string; pulsePhase: number }) {
  const opacity = 0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.3;
  return (
    <div className="flex items-center justify-center py-2 lg:py-0 lg:px-1">
      <div className="flex items-center gap-1">
        <div className="w-8 h-0.5 rounded-full" style={{
          background: `linear-gradient(90deg, ${fromColor}, ${toColor})`,
          opacity, boxShadow: `0 0 6px ${toColor}40`,
        }} />
        <ArrowRight className="w-5 h-5" style={{ color: toColor, opacity: opacity + 0.2, filter: `drop-shadow(0 0 4px ${toColor}60)` }} />
      </div>
    </div>
  );
}

/* ── Upload Types ───────────────────────────────────────────── */
interface UploadJob {
  id: string;
  file: File;
  title: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  error?: string;
}

/* ── Upload Queue Toast (persistent bottom-right) ──────────── */
function UploadQueueToast({ jobs, onDismiss }: { jobs: UploadJob[]; onDismiss: (id: string) => void }) {
  if (jobs.length === 0) return null;

  const active = jobs.filter(j => j.status === 'uploading' || j.status === 'queued').length;
  const done = jobs.filter(j => j.status === 'done').length;
  const errored = jobs.filter(j => j.status === 'error').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 space-y-2">
      {/* Summary bar */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{
        background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)',
        border: '1px solid #00FF0030', boxShadow: '0 0 30px #00FF0015',
      }}>
        <div className="flex items-center gap-2">
          {active > 0 && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00FF00' }} />}
          {active === 0 && done > 0 && <CheckCircle2 className="w-4 h-4" style={{ color: '#00FF00' }} />}
          <span className="font-pixel text-[10px] tracking-wider text-white">
            {active > 0 ? `UPLOADING ${active}` : `${done} DONE`}
            {errored > 0 && <span style={{ color: '#FF0000' }}> · {errored} FAILED</span>}
          </span>
        </div>
        <span className="font-mono text-xs text-white/50">{jobs.length} total</span>
      </div>

      {/* Individual file rows */}
      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00FF0030 transparent' }}>
        {jobs.map(job => (
          <div key={job.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{
            background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)',
            border: `1px solid ${job.status === 'error' ? '#FF000030' : job.status === 'done' ? '#00FF0020' : '#00FF0015'}`,
          }}>
            {/* Status icon */}
            {job.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#00FF00' }} />}
            {job.status === 'queued' && <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#FFFF00' }} />}
            {job.status === 'done' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#00FF00' }} />}
            {job.status === 'error' && <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#FF0000' }} />}

            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-white truncate">{job.file.name}</div>
              <div className="font-mono text-[10px] text-white/40">
                {(job.file.size / (1024 * 1024)).toFixed(1)} MB
                {job.title && ` · ${job.title}`}
              </div>
              {job.status === 'uploading' && (
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: '#00FF0015' }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{
                    width: `${job.progress}%`, background: '#00FF00',
                    boxShadow: '0 0 6px #00FF00',
                  }} />
                </div>
              )}
              {job.error && <div className="font-mono text-[10px] mt-0.5" style={{ color: '#FF0000' }}>{job.error}</div>}
            </div>

            {/* Dismiss when done/error */}
            {(job.status === 'done' || job.status === 'error') && (
              <button onClick={() => onDismiss(job.id)} className="flex-shrink-0 text-white/30 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Upload Modal (multi-file, queues immediately) ─────────── */
function UploadModal({ onClose, onQueueFiles }: {
  onClose: () => void;
  onQueueFiles: (files: { file: File; title: string }[]) => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).filter(f => {
      if (!f.type.startsWith('video/')) { setError('Only video files are accepted'); return false; }
      if (f.size > 200 * 1024 * 1024) { setError(`${f.name} exceeds 200MB limit`); return false; }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) setError('');
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0) return;
    onQueueFiles(selectedFiles.map(file => ({ file, title })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative rounded-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(8, 8, 8, 0.95)',
          backdropFilter: 'blur(30px)',
          border: '1px solid #00FF0030',
          boxShadow: '0 0 60px #00FF0015, inset 0 0 60px #00FF0005',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#00FF0015' }}>
          <div className="flex items-center gap-3">
            <UploadCloud className="w-6 h-6" style={{ color: '#00FF00' }} />
            <span className="font-pixel text-sm tracking-wider" style={{ color: '#00FF00', textShadow: '0 0 8px #00FF0080' }}>
              SUBMIT VIDEOS
            </span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop zone */}
          <div
            className={`rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'scale-[1.02]' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              background: dragOver ? '#00FF0010' : '#0a0a0a',
              border: `2px dashed ${selectedFiles.length > 0 ? '#00FF0050' : dragOver ? '#00FF0060' : '#1a1a1a'}`,
              boxShadow: selectedFiles.length > 0 ? '0 0 20px #00FF0010' : 'none',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            <div className="space-y-3">
              <UploadCloud className="w-12 h-12 mx-auto" style={{ color: selectedFiles.length > 0 ? '#00FF00' : '#333' }} />
              <div className="font-pixel text-xs tracking-wider" style={{ color: selectedFiles.length > 0 ? '#00FF00' : 'white' }}>
                {selectedFiles.length > 0 ? `${selectedFiles.length} VIDEO${selectedFiles.length > 1 ? 'S' : ''} SELECTED` : 'DROP VIDEOS HERE'}
              </div>
              <div className="font-mono text-xs text-white/40">
                Select multiple files · MP4, MOV, WebM (max 200MB each)
              </div>
            </div>
          </div>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00FF0030 transparent' }}>
              {selectedFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: '#0a0a0a', border: '1px solid #00FF0015' }}>
                  <Film className="w-4 h-4 flex-shrink-0" style={{ color: '#00FF00' }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-white truncate">{f.name}</div>
                    <div className="font-mono text-[10px] text-white/40">{(f.size / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeFile(i); }} className="text-white/30 hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Title input */}
          <div>
            <label className="font-pixel text-[10px] tracking-wider block mb-2" style={{ color: '#00FF00' }}>
              TITLE (OPTIONAL — APPLIES TO ALL)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Video title..."
              className="w-full rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-white/20 outline-none"
              style={{
                background: '#0a0a0a',
                border: '1px solid #00FF0020',
                boxShadow: 'inset 0 0 10px #00000050',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="font-mono text-xs p-3 rounded-lg" style={{ color: '#FF0000', background: '#FF000010', border: '1px solid #FF000020' }}>
              {error}
            </div>
          )}

          {/* Info */}
          <div className="font-mono text-xs text-white/50 leading-relaxed">
            Videos upload in the background — you can close this and keep working.
            Each video skips the downloader and goes straight into the pipeline.
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={selectedFiles.length === 0}
            className="w-full font-pixel text-sm tracking-wider py-4 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: selectedFiles.length > 0 ? '#00FF0015' : '#0a0a0a',
              border: `2px solid ${selectedFiles.length > 0 ? '#00FF0050' : '#1a1a1a'}`,
              color: '#00FF00',
              textShadow: selectedFiles.length > 0 ? '0 0 8px #00FF00' : 'none',
              boxShadow: selectedFiles.length > 0 ? '0 0 30px #00FF0015' : 'none',
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <UploadCloud className="w-5 h-5" />
              {selectedFiles.length > 1 ? `QUEUE ${selectedFiles.length} VIDEOS` : 'SUBMIT TO PIPELINE'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────── */
export default function SwarmDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadJob[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Two-step upload: get signed URL → upload directly to storage → register in DB */
  const uploadFile = useCallback(async (job: UploadJob) => {
    setUploadQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'uploading' as const, progress: 2 } : j));

    try {
      // Step 1: Get a signed upload URL from our API
      const signRes = await fetch('/api/swarm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sign', filename: job.file.name, contentType: job.file.type }),
      });
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get upload URL');
      }
      const { id, uploadUrl, token, storagePath } = await signRes.json();

      setUploadQueue(prev => prev.map(j => j.id === job.id ? { ...j, progress: 5 } : j));

      // Step 2: Upload file directly to Supabase Storage with real progress via XHR
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = 5 + (e.loaded / e.total) * 85; // 5-90%
            setUploadQueue(prev => prev.map(j => j.id === job.id ? { ...j, progress: pct } : j));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Storage upload failed (${xhr.status})`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', job.file.type);
        if (token) xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(job.file);
      });

      setUploadQueue(prev => prev.map(j => j.id === job.id ? { ...j, progress: 92 } : j));

      // Step 3: Register the file in the database
      const regRes = await fetch('/api/swarm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'register', id, storagePath, title: job.title, filename: job.file.name }),
      });
      if (!regRes.ok) {
        const err = await regRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to register video');
      }

      setUploadQueue(prev => prev.map(j =>
        j.id === job.id ? { ...j, status: 'done' as const, progress: 100 } : j
      ));
      fetchData();
    } catch (err: unknown) {
      setUploadQueue(prev => prev.map(j =>
        j.id === job.id ? { ...j, status: 'error' as const, progress: 0, error: err instanceof Error ? err.message : 'Upload failed' } : j
      ));
    }
  }, [fetchData]);

  /** Queue multiple files — each uploads concurrently in background */
  const queueFiles = useCallback((files: { file: File; title: string }[]) => {
    const newJobs: UploadJob[] = files.map(({ file, title }) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      title,
      status: 'queued' as const,
      progress: 0,
    }));
    setUploadQueue(prev => [...prev, ...newJobs]);
    for (const job of newJobs) uploadFile(job);
  }, [uploadFile]);

  const dismissUploadJob = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(j => j.id !== id));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Directional pulse animation — cycles through agents
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-black">
        <FlowerOfLifeLoader />
        <span className="font-pixel text-base" style={{ color: '#00FF00', textShadow: '0 0 10px #00FF00' }}>
          INITIALIZING SWARM...
        </span>
      </div>
    );
  }

  const totalPosts = Object.values(data.pipeline).reduce((a, b) => a + b, 0);
  const postedCount = data.pipeline['posted'] || 0;
  const failedCount = data.pipeline['failed'] || 0;
  const inPipeline = totalPosts - postedCount - failedCount;

  // Group activities by agent
  const activitiesByAgent: Record<string, Activity[]> = {};
  for (const agent of AGENTS) activitiesByAgent[agent.id] = [];
  for (const act of data.activity) {
    if (activitiesByAgent[act.agent]) activitiesByAgent[act.agent].push(act);
  }

  const isAgentActive = (id: string) => {
    const last = activitiesByAgent[id]?.[0];
    return last ? (Date.now() - new Date(last.created_at).getTime()) < 300000 : false;
  };
  const isAgentError = (id: string) => activitiesByAgent[id]?.[0]?.action === 'error';

  // Pulse phase per agent (0-1, cycling through in order)
  const cycleDuration = 4000; // 4s full cycle
  const now = tick * 50;
  const getPulsePhase = (order: number) => {
    const offset = ((order - 1) / 8); // stagger per agent
    return ((now / cycleDuration + offset) % 1);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Lasers */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="laser-h-green" style={{ top: '8%', left: 0 }} />
        <div className="laser-h-magenta" style={{ top: '50%', right: 0 }} />
        <div className="laser-v-green" style={{ left: '8%', top: 0 }} />
        <div className="laser-v-magenta" style={{ right: '12%', top: 0 }} />
      </div>
      <div className="fixed inset-0 scanlines pointer-events-none z-[1] opacity-10" />

      <div className="relative z-10 p-4 lg:p-8 max-w-[2000px] mx-auto space-y-6">

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-pixel text-2xl lg:text-3xl tracking-wider" style={{ color: '#00FF00', textShadow: '0 0 10px #00FF00, 0 0 25px #00FF0060, 0 0 50px #00FF0030' }}>
              AGENT SWARM
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <GlowstickBar color="#00FF00" width="60px" />
              <GlowstickBar color="#FF00FF" width="36px" />
              <span className="font-pixel text-xs text-white uppercase tracking-[0.3em]">terminal view</span>
              <GlowstickBar color="#FF00FF" width="36px" />
              <GlowstickBar color="#00FF00" width="60px" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Stats */}
            <div className="flex items-center gap-6">
              {[
                { label: 'TOTAL', value: totalPosts, color: '#FFFFFF' },
                { label: 'LIVE', value: postedCount, color: '#00FF00' },
                { label: 'QUEUE', value: inPipeline, color: '#00FFFF' },
                { label: 'FAIL', value: failedCount, color: '#FF0000' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="font-pixel text-3xl" style={{ color: s.color, textShadow: `0 0 10px ${s.color}60` }}>{s.value}</div>
                  <div className="font-pixel text-[10px] tracking-widest mt-0.5" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(0,255,0,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,0,0.3)', color: '#00FF00', textShadow: '0 0 6px #00FF0060' }}>
              <UploadCloud className="w-5 h-5" />
              UPLOAD
            </button>
            <a href="/swarm/shortcut"
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(0,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', textShadow: '0 0 6px #00FFFF60' }}>
              <Smartphone className="w-5 h-5" />
              iOS
            </a>
            <button onClick={async () => { try { const r = await fetch('/api/swarm/push-pipeline', { method: 'POST' }); const d = await r.json(); alert(d.ok ? `SUCCESS! ${d.youtube_url}\n\n${(d.log||[]).join('\n')}` : `FAILED: ${d.error || d.failed_at}\n\n${(d.log||[]).join('\n')}`); fetchData(); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(0,255,0,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,0,0.5)', color: '#00FF00', textShadow: '0 0 8px #00FF0080' }}>
              <RefreshCw className="w-5 h-5" />
              PUSH
            </button>
            <button onClick={async () => { try { const c = prompt('How many videos? (1-10)', '5'); if (!c) return; alert('BURST MODE: Scouting + processing ' + c + ' videos. This will take a few minutes...'); const r = await fetch('/api/swarm/burst', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: parseInt(c) }) }); const d = await r.json(); alert(d.ok ? `BURST COMPLETE!\n${d.summary}\n\n${(d.log||[]).slice(-10).join('\n')}` : `BURST FAILED: ${d.error}\n\n${(d.log||[]).join('\n')}`); fetchData(); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105 animate-pulse"
              style={{ background: 'rgba(255,200,0,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,200,0,0.6)', color: '#FFC800', textShadow: '0 0 10px #FFC80090' }}>
              <Zap className="w-5 h-5" />
              BURST
            </button>
            <button onClick={async () => { try { const igUrl = prompt('Paste an Instagram Reel URL to test the full pipeline:', 'https://www.instagram.com/reel/...'); if (!igUrl || !igUrl.includes('instagram.com')) return; alert('Testing full pipeline with this reel... This takes 1-2 minutes.'); const r = await fetch('/api/swarm/test-single', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: igUrl }) }); const d = await r.json(); alert(d.ok ? `SUCCESS! YouTube Short: ${d.youtube_url}\n\n${(d.log||[]).join('\n')}` : `FAILED: ${d.error}\n\n${(d.log||[]).join('\n')}`); fetchData(); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(0,200,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,200,255,0.5)', color: '#00C8FF', textShadow: '0 0 8px #00C8FF80' }}>
              <ArrowRight className="w-5 h-5" />
              TEST
            </button>
            <button onClick={async () => { try { const r = await fetch('/api/swarm/test-youtube', { method: 'POST' }); const d = await r.json(); alert(d.ok ? `YouTube OK! Channel: ${d.channel}` : `YouTube BROKEN: [${d.stage}] ${d.error}`); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(255,0,0,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,0,0,0.3)', color: '#FF4444', textShadow: '0 0 6px #FF444460' }}>
              <RefreshCw className="w-5 h-5" />
              YT AUTH
            </button>
            <button onClick={async () => { try { const r = await fetch('/api/swarm/retry-failed', { method: 'POST' }); const d = await r.json(); alert(`Retried ${d.retried || 0} failed posts`); fetchData(); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(255,100,0,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,100,0,0.3)', color: '#FF6400', textShadow: '0 0 6px #FF640060' }}>
              <RefreshCw className="w-5 h-5" />
              RETRY
            </button>
            <button onClick={async () => { try { const raw = prompt('Paste YouTube Studio cookies (raw from browser):'); if (!raw) return; const r = await fetch('/api/swarm/store-cookies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) }); const d = await r.json(); alert(d.ok ? `Stored ${d.parsed} cookies!` : `Failed: ${d.error}`); } catch { alert('Failed to store cookies'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(200,100,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(200,100,255,0.3)', color: '#C864FF', textShadow: '0 0 6px #C864FF60' }}>
              <Terminal className="w-5 h-5" />
              COOKIES
            </button>
            <button onClick={async () => { try { const r = await fetch('/api/swarm/diagnose'); const d = await r.json(); alert(JSON.stringify(d.checks || d, null, 2)); } catch { alert('Worker unreachable'); } }}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(255,0,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,0,255,0.3)', color: '#FF00FF', textShadow: '0 0 6px #FF00FF60' }}>
              <RefreshCw className="w-5 h-5" />
              DIAGNOSE
            </button>
            <button onClick={fetchData}
              className="flex items-center gap-2 font-pixel text-xs px-5 py-3 rounded-xl text-flow-green transition-all hover:scale-105"
              style={{ background: 'rgba(0,255,0,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,0,0.2)' }}>
              <RefreshCw className="w-5 h-5" />
              {lastRefresh.toLocaleTimeString()}
            </button>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onQueueFiles={queueFiles}
          />
        )}

        {/* Background Upload Queue Toast */}
        <UploadQueueToast jobs={uploadQueue} onDismiss={dismissUploadJob} />

        {/* ─── Pipeline Flow (compact) ────────────────────────── */}
        <div className="rounded-xl px-5 py-3 flex items-center gap-1 overflow-x-auto" style={{
          background: 'rgba(5,5,5,0.7)', backdropFilter: 'blur(20px)', border: '1px solid #00FF0015',
        }}>
          <TrendingUp className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: '#00FF0060' }} />
          {PIPELINE_STAGES.map((stage, i) => {
            const count = data.pipeline[stage.status] || 0;
            const active = count > 0;
            return (
              <div key={stage.status} className="flex items-center">
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${active ? 'beat-pulse' : ''}`} style={{
                  background: active ? `${stage.color}08` : 'transparent',
                  border: `1px solid ${active ? stage.color + '40' : 'transparent'}`,
                }}>
                  <span className="font-pixel text-lg" style={{ color: active ? stage.color : '#222', textShadow: active ? `0 0 8px ${stage.color}` : 'none' }}>{count}</span>
                  <span className="font-pixel text-[10px] tracking-wider whitespace-nowrap" style={{ color: active ? stage.color : 'white' }}>{stage.label}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-4 h-4 mx-0.5 flex-shrink-0" style={{ color: '#1a1a1a' }} />}
              </div>
            );
          })}
        </div>

        {/* ─── Agent Terminals (pipeline order with arrows) ──── */}
        <div>
          {/* Pipeline row — large cards with directional arrows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
            {PIPELINE_AGENTS.map((id, i) => {
              const agent = AGENTS.find(a => a.id === id)!;
              const nextAgent = PIPELINE_AGENTS[i + 1] ? AGENTS.find(a => a.id === PIPELINE_AGENTS[i + 1]) : null;
              return (
                <div key={id}>
                  <AgentTerminal
                    agent={agent}
                    activities={activitiesByAgent[id]}
                    isActive={isAgentActive(id)}
                    hasError={isAgentError(id)}
                    pulsePhase={getPulsePhase(agent.order)}
                    countdown={getCountdown(id, activitiesByAgent[id]?.[0]?.created_at)}
                  />
                  {/* Flow arrow between cards (shown on mobile only between rows) */}
                  {nextAgent && (
                    <div className="lg:hidden">
                      <FlowArrow fromColor={agent.color} toColor={nextAgent.color} pulsePhase={getPulsePhase(agent.order)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Support agents row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #FF00FF20, transparent)' }} />
            <span className="font-pixel text-xs tracking-widest" style={{ color: '#FF00FF' }}>SUPPORT AGENTS</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #FF00FF20, transparent)' }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {SUPPORT_AGENTS.map(id => {
              const agent = AGENTS.find(a => a.id === id)!;
              return (
                <AgentTerminal
                  key={id}
                  agent={agent}
                  activities={activitiesByAgent[id]}
                  isActive={isAgentActive(id)}
                  hasError={isAgentError(id)}
                  pulsePhase={getPulsePhase(agent.order)}
                  countdown={getCountdown(id, activitiesByAgent[id]?.[0]?.created_at)}
                />
              );
            })}
          </div>
        </div>

        {/* ─── Recent Posts ───────────────────────────────────── */}
        <GlassCard borderColor="#FF00FF20" glowColor="#FF00FF">
          <h2 className="font-pixel text-base tracking-widest mb-4 flex items-center gap-2" style={{ color: '#FF00FF', textShadow: '0 0 8px #FF00FF' }}>
            {'>'} RECENT POSTS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
            {data.posts.map(post => (
              <div key={post.id} className="flex items-start gap-3 rounded-xl p-4" style={{
                background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(8px)',
                border: `1px solid ${post.status === 'posted' ? '#00FF0015' : post.status === 'failed' ? '#FF000015' : '#1a1a1a'}`,
              }}>
                {getStatusIcon(post.status)}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-base text-white truncate">{post.title || 'UNTITLED'}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-pixel text-[10px] px-2 py-1 rounded-md tracking-wider" style={{
                      background: post.status === 'posted' ? '#00FF0010' : post.status === 'failed' ? '#FF000010' : '#ffffff06',
                      color: post.status === 'posted' ? '#00FF00' : post.status === 'failed' ? '#FF0000' : '#555',
                    }}>
                      {post.status.toUpperCase()}
                    </span>
                    {post.ig_like_count > 0 && <span className="font-mono text-sm text-white">{post.ig_like_count.toLocaleString()}</span>}
                    <span className="font-mono text-sm text-white/70">{timeAgo(post.created_at)}</span>
                  </div>
                  {post.error_message && (
                    <div className="font-mono text-xs text-flow-red mt-1.5 truncate">{post.error_message}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {post.youtube_video_id && (
                      <a href={`https://youtube.com/shorts/${post.youtube_video_id}`} target="_blank" rel="noopener noreferrer"
                        className="font-pixel text-[10px] tracking-wider flex items-center gap-1 hover:underline" style={{ color: '#FF0000' }}>
                        YT <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {post.ig_reels_id && <span className="font-pixel text-[10px]" style={{ color: '#FF00FF' }}>IG</span>}
                    {post.fb_reels_id && <span className="font-pixel text-[10px]" style={{ color: '#0088FF' }}>FB</span>}
                    <a href={post.ig_permalink} target="_blank" rel="noopener noreferrer"
                      className="font-pixel text-[10px] text-white/50 hover:text-flow-cyan tracking-wider flex items-center gap-1 ml-auto">
                      SRC <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-2">
          <GlowstickBar color="#FF00FF" width="10px" />
          <GlowstickBar color="#00FF00" width="14px" />
          <GlowstickBar color="#FF00FF" width="18px" />
          <GlowstickBar color="#00FF00" width="22px" />
          <GlowstickBar color="#00FFFF" width="26px" />
          <GlowstickBar color="#00FF00" width="22px" />
          <GlowstickBar color="#FF00FF" width="18px" />
          <GlowstickBar color="#00FF00" width="14px" />
          <GlowstickBar color="#FF00FF" width="10px" />
        </div>
        <div className="text-center pb-4">
          <span className="font-pixel text-xs tracking-[0.3em]" style={{ color: 'white' }}>
            FLOW AI AGENT SWARM v8 // TERMINAL EDITION
          </span>
        </div>
      </div>
    </div>
  );
}
