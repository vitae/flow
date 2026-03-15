'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  Search, Download, Volume2, Scissors, PenTool, Upload, Cookie, Music,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, ExternalLink,
  Zap, TrendingUp, Eye,
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
  { id: 'scout', label: 'SCOUT', icon: Search, color: '#00FFFF', role: 'Discovers trending content' },
  { id: 'downloader', label: 'DOWNLOADER', icon: Download, color: '#00FF00', role: 'Fetches video files' },
  { id: 'audio_engineer', label: 'AUDIO ENG', icon: Volume2, color: '#FFFF00', role: 'Processes audio tracks' },
  { id: 'editor', label: 'EDITOR', icon: Scissors, color: '#FF00FF', role: 'Edits & optimizes clips' },
  { id: 'copywriter', label: 'COPYWRITER', icon: PenTool, color: '#FF8800', role: 'Generates titles & tags' },
  { id: 'publisher', label: 'PUBLISHER', icon: Upload, color: '#00FF00', role: 'Uploads to platforms' },
  { id: 'music_adder', label: 'MUSIC', icon: Music, color: '#FF00FF', role: 'Adds trending audio' },
  { id: 'cookie_refresher', label: 'COOKIES', icon: Cookie, color: '#FFFF00', role: 'Refreshes sessions' },
];

const PIPELINE_AGENTS = ['scout', 'downloader', 'audio_engineer', 'editor', 'copywriter', 'publisher'];
const SUPPORT_AGENTS = ['music_adder', 'cookie_refresher'];

const PIPELINE_STAGES = [
  { status: 'pending', label: 'PENDING', color: '#444' },
  { status: 'downloading', label: 'DOWNLOADING', color: '#00FFFF' },
  { status: 'downloaded', label: 'DOWNLOADED', color: '#00FFFF' },
  { status: 'audio_search', label: 'AUDIO SEARCH', color: '#FFFF00' },
  { status: 'audio_ready', label: 'AUDIO READY', color: '#FFFF00' },
  { status: 'edited', label: 'EDITED', color: '#FF00FF' },
  { status: 'metadata_ready', label: 'META READY', color: '#FF8800' },
  { status: 'uploading', label: 'UPLOADING', color: '#00FF00' },
  { status: 'posted', label: 'POSTED', color: '#00FF00' },
  { status: 'failed', label: 'FAILED', color: '#FF0000' },
];

/* ── Helpers ────────────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getBlurb(act: Activity): string {
  switch (act.action) {
    case 'discovered':
      return act.details.hashtag
        ? `Found #${String(act.details.hashtag)} ${act.details.top_likes ? `(${Number(act.details.top_likes).toLocaleString()} likes)` : ''}`
        : 'Scanning for viral content...';
    case 'processing':
      return act.details.title ? `Working: "${String(act.details.title).slice(0, 35)}"` : 'Processing...';
    case 'completed':
      return act.details.output_status ? `Done > ${String(act.details.output_status)}` : 'Task complete';
    case 'published':
      return 'Published to platforms!';
    case 'refreshed':
      return act.details.cookies_count ? `Refreshed ${String(act.details.cookies_count)} cookies` : 'Sessions refreshed';
    case 'error':
      return act.details.error ? `ERR: ${String(act.details.error).slice(0, 45)}` : 'Error occurred';
    default:
      return act.action.toUpperCase();
  }
}

function getActionLabel(action: string): { label: string; type: 'success' | 'error' | 'info' } {
  switch (action) {
    case 'discovered': return { label: 'VIRAL FOUND', type: 'success' };
    case 'processing': return { label: 'PROCESSING', type: 'info' };
    case 'completed': return { label: 'COMPLETE', type: 'success' };
    case 'published': return { label: 'PUBLISHED', type: 'success' };
    case 'refreshed': return { label: 'REFRESHED', type: 'success' };
    case 'error': return { label: 'ERROR', type: 'error' };
    default: return { label: action.toUpperCase(), type: 'info' };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'posted': return <CheckCircle2 className="w-4 h-4 drop-shadow-[0_0_6px_#00FF00]" style={{ color: '#00FF00' }} />;
    case 'failed': return <AlertTriangle className="w-4 h-4 drop-shadow-[0_0_6px_#FF0000]" style={{ color: '#FF0000' }} />;
    case 'uploading':
    case 'processing':
    case 'audio_search':
      return <Loader2 className="w-4 h-4 animate-spin drop-shadow-[0_0_6px_#00FFFF]" style={{ color: '#00FFFF' }} />;
    case 'metadata_ready': return <Zap className="w-4 h-4 drop-shadow-[0_0_6px_#FF8800]" style={{ color: '#FF8800' }} />;
    default: return <Clock className="w-4 h-4 text-flow-gray-600" />;
  }
}

/* ── Three.js Components ────────────────────────────────────── */

/** Glassmorphic hexagonal agent node */
function GlassAgentNode({
  position,
  color,
  label,
  blurb,
  isActive,
  hasError,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  blurb: string | null;
  isActive: boolean;
  hasError: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const col = useMemo(() => new THREE.Color(color), [color]);
  const errorCol = useMemo(() => new THREE.Color('#FF0000'), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(t * 0.3) * 0.15;
      meshRef.current.rotation.x = Math.cos(t * 0.2) * 0.05;
      if (isActive) {
        meshRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      if (isActive) {
        mat.opacity = 0.15 + Math.sin(t * 3) * 0.1;
      } else {
        mat.opacity = 0.03;
      }
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isActive ? 0.6 + Math.sin(t * 4) * 0.3 : 0.15;
    }
  });

  const activeColor = hasError ? errorCol : col;

  return (
    <group position={position}>
      {/* Outer glow sphere */}
      <mesh ref={glowRef} scale={1.8}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={activeColor} transparent opacity={0.03} />
      </mesh>

      {/* Spinning ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.02, 16, 64]} />
        <meshBasicMaterial color={activeColor} transparent opacity={0.15} />
      </mesh>

      {/* Glass orb */}
      <Float speed={isActive ? 3 : 1} rotationIntensity={0.2} floatIntensity={isActive ? 0.4 : 0.15}>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[0.9, 1]} />
          <MeshTransmissionMaterial
            backside
            samples={6}
            thickness={0.3}
            chromaticAberration={0.15}
            anisotropy={0.2}
            distortion={0.1}
            distortionScale={0.2}
            temporalDistortion={0.1}
            iridescence={1}
            iridescenceIOR={1}
            iridescenceThicknessRange={[0, 1400]}
            color={activeColor}
            transmission={0.95}
            roughness={0.05}
          />
        </mesh>
      </Float>

      {/* Agent label below (HTML for pixel font) */}
      <Html position={[0, -1.6, 0]} center distanceFactor={8}>
        <div
          className="font-pixel text-[11px] tracking-wider whitespace-nowrap text-center"
          style={{
            color,
            textShadow: `0 0 8px ${color}80`,
          }}
        >
          {label}
        </div>
      </Html>

      {/* Status dot */}
      {isActive && (
        <mesh position={[0.9, 0.9, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={hasError ? '#FF0000' : color} />
        </mesh>
      )}

      {/* Word blurb (HTML overlay for readability) */}
      {blurb && (
        <Html position={[0, 1.8, 0]} center distanceFactor={8}>
          <div
            className="font-pixel text-[10px] px-3 py-2 rounded-lg text-center whitespace-nowrap animate-fade-in max-w-[240px]"
            style={{
              color: hasError ? '#FF0000' : color,
              background: `${hasError ? '#FF0000' : color}12`,
              border: `1px solid ${hasError ? '#FF0000' : color}40`,
              textShadow: `0 0 10px ${hasError ? '#FF0000' : color}`,
              backdropFilter: 'blur(12px)',
              boxShadow: `0 0 20px ${hasError ? '#FF0000' : color}20, inset 0 0 20px ${hasError ? '#FF0000' : color}08`,
            }}
          >
            {blurb}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Directional particle stream between agents */
function ParticleStream({
  from,
  to,
  color,
  isActive,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  isActive: boolean;
}) {
  const particleCount = 20;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(color), [color]);
  const offsets = useMemo(() => Array.from({ length: particleCount }, (_, i) => i / particleCount), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < particleCount; i++) {
      const progress = ((offsets[i] + t * (isActive ? 0.3 : 0.08)) % 1);
      dummy.position.set(
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress + Math.sin(progress * Math.PI) * 0.3,
        from[2] + (to[2] - from[2]) * progress,
      );
      const scale = isActive ? 0.06 + Math.sin(progress * Math.PI) * 0.04 : 0.03;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = isActive ? 0.8 : 0.2;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={col} transparent opacity={0.2} />
    </instancedMesh>
  );
}

/** Background grid */
function GridFloor() {
  return (
    <gridHelper
      args={[60, 60, '#00FF0015', '#00FF000A']}
      position={[0, -3.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

/** Ambient floating particles */
function AmbientParticles() {
  const count = 100;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 30,
        y: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 15,
        speed: 0.2 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      })),
    [],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.offset) * 0.5,
        p.y + Math.cos(t * p.speed * 0.7 + p.offset) * 0.3,
        p.z,
      );
      dummy.scale.setScalar(0.02 + Math.sin(t + p.offset) * 0.01);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#00FF00" transparent opacity={0.3} />
    </instancedMesh>
  );
}

/* ── 3D Scene ───────────────────────────────────────────────── */
function SwarmScene({
  data,
  lastAgentActivity,
}: {
  data: DashboardData;
  lastAgentActivity: Record<string, Activity>;
}) {
  const isActive = (id: string) => {
    const act = lastAgentActivity[id];
    return act ? (Date.now() - new Date(act.created_at).getTime()) < 300000 : false;
  };
  const hasError = (id: string) => lastAgentActivity[id]?.action === 'error';
  const getBlurbForAgent = (id: string) => {
    const act = lastAgentActivity[id];
    return act ? getBlurb(act) : null;
  };

  // Pipeline positions: spread horizontally
  const spacing = 4;
  const startX = -(PIPELINE_AGENTS.length - 1) * spacing / 2;
  const pipelinePositions: Record<string, [number, number, number]> = {};
  PIPELINE_AGENTS.forEach((id, i) => {
    pipelinePositions[id] = [startX + i * spacing, 0, 0];
  });

  // Support agents below
  const supportPositions: Record<string, [number, number, number]> = {
    music_adder: [-2, -3.5, 0],
    cookie_refresher: [2, -3.5, 0],
  };

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 5]} intensity={0.5} color="#00FF00" />
      <pointLight position={[-8, 3, 3]} intensity={0.3} color="#FF00FF" />
      <pointLight position={[8, 3, 3]} intensity={0.3} color="#00FFFF" />

      <GridFloor />
      <AmbientParticles />

      {/* Pipeline agents */}
      {PIPELINE_AGENTS.map((id) => {
        const agent = AGENTS.find(a => a.id === id)!;
        return (
          <GlassAgentNode
            key={id}
            position={pipelinePositions[id]}
            color={agent.color}
            label={agent.label}
            blurb={getBlurbForAgent(id)}
            isActive={isActive(id)}
            hasError={hasError(id)}
          />
        );
      })}

      {/* Support agents */}
      {SUPPORT_AGENTS.map((id) => {
        const agent = AGENTS.find(a => a.id === id)!;
        return (
          <GlassAgentNode
            key={id}
            position={supportPositions[id]}
            color={agent.color}
            label={agent.label}
            blurb={getBlurbForAgent(id)}
            isActive={isActive(id)}
            hasError={hasError(id)}
          />
        );
      })}

      {/* Particle streams between pipeline agents */}
      {PIPELINE_AGENTS.slice(0, -1).map((id, i) => {
        const nextId = PIPELINE_AGENTS[i + 1];
        const agent = AGENTS.find(a => a.id === id)!;
        return (
          <ParticleStream
            key={`${id}-${nextId}`}
            from={pipelinePositions[id]}
            to={pipelinePositions[nextId]}
            color={agent.color}
            isActive={isActive(id) || isActive(nextId)}
          />
        );
      })}

      <Environment preset="night" />
    </>
  );
}

/* ── Glass UI Components ────────────────────────────────────── */

function GlowstickBar({ color, width }: { color: string; width: string }) {
  return (
    <div
      className="h-1 rounded-full"
      style={{
        width,
        background: color,
        boxShadow: `0 0 4px ${color}, 0 0 8px ${color}80, 0 0 16px ${color}40`,
      }}
    />
  );
}

function GlassCard({
  children,
  borderColor = '#00FF0030',
  glowColor = '#00FF00',
  className = '',
}: {
  children: React.ReactNode;
  borderColor?: string;
  glowColor?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 relative overflow-hidden ${className}`}
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 30px ${glowColor}10, inset 0 0 30px ${glowColor}05`,
      }}
    >
      {/* Glass highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}30, transparent)` }}
      />
      {children}
    </div>
  );
}

/* ── Main Dashboard Page ────────────────────────────────────── */
export default function SwarmDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-black">
        <div className="w-16 h-16 border-2 border-flow-green rounded-lg animate-spin" style={{ boxShadow: '0 0 20px #00FF0060' }} />
        <span className="font-pixel text-xs" style={{ color: '#00FF00', textShadow: '0 0 10px #00FF00' }}>
          INITIALIZING SWARM...
        </span>
      </div>
    );
  }

  const totalPosts = Object.values(data.pipeline).reduce((a, b) => a + b, 0);
  const postedCount = data.pipeline['posted'] || 0;
  const failedCount = data.pipeline['failed'] || 0;
  const inPipeline = totalPosts - postedCount - failedCount;

  const lastAgentActivity: Record<string, Activity> = {};
  for (const act of data.activity) {
    if (!lastAgentActivity[act.agent]) {
      lastAgentActivity[act.agent] = act;
    }
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Laser beams */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="laser-h-green" style={{ top: '10%', left: 0 }} />
        <div className="laser-h-magenta" style={{ top: '35%', right: 0 }} />
        <div className="laser-v-green" style={{ left: '12%', top: 0 }} />
        <div className="laser-v-magenta" style={{ right: '20%', top: 0 }} />
      </div>

      {/* Scanline overlay */}
      <div className="fixed inset-0 scanlines pointer-events-none z-[1] opacity-15" />

      <div className="relative z-10 p-6 lg:p-10 max-w-[1800px] mx-auto space-y-8">

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-pixel text-2xl lg:text-3xl tracking-wider" style={{ color: '#00FF00', textShadow: '0 0 10px #00FF00, 0 0 20px #00FF0060, 0 0 40px #00FF0030' }}>
              AGENT SWARM
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <GlowstickBar color="#00FF00" width="60px" />
              <GlowstickBar color="#FF00FF" width="36px" />
              <span className="font-pixel text-[9px] text-flow-gray-400 uppercase tracking-[0.3em]">
                live monitoring
              </span>
              <GlowstickBar color="#FF00FF" width="36px" />
              <GlowstickBar color="#00FF00" width="60px" />
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 font-pixel text-[9px] px-4 py-3 rounded-xl text-flow-green transition-all hover:scale-105"
            style={{
              background: 'rgba(0, 255, 0, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 255, 0, 0.2)',
              boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)',
            }}
          >
            <RefreshCw className="w-4 h-4" />
            {lastRefresh.toLocaleTimeString()}
          </button>
        </div>

        {/* ─── Stats Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL VIDEOS', value: totalPosts, color: '#FFFFFF', glow: '#FFFFFF' },
            { label: 'POSTED LIVE', value: postedCount, color: '#00FF00', glow: '#00FF00' },
            { label: 'IN PIPELINE', value: inPipeline, color: '#00FFFF', glow: '#00FFFF' },
            { label: 'FAILED', value: failedCount, color: '#FF0000', glow: '#FF0000' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'rgba(5, 5, 5, 0.7)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${stat.color}20`,
                boxShadow: stat.value > 0 ? `0 0 30px ${stat.glow}15, inset 0 0 30px ${stat.glow}05` : 'none',
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${stat.color}30, transparent)` }} />
              <div
                className="font-pixel text-3xl"
                style={{ color: stat.color, textShadow: `0 0 15px ${stat.color}80` }}
              >
                {stat.value}
              </div>
              <div className="font-pixel text-[9px] mt-2 tracking-widest" style={{ color: stat.color + '70' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── 3D Agent Swarm Canvas ──────────────────────────── */}
        <GlassCard borderColor="#FF00FF25" glowColor="#FF00FF" className="p-0 overflow-hidden">
          <div className="p-6 pb-2">
            <h2 className="font-pixel text-[11px] tracking-widest flex items-center gap-2" style={{ color: '#FF00FF', textShadow: '0 0 8px #FF00FF' }}>
              <Eye className="w-5 h-5 drop-shadow-[0_0_6px_#FF00FF]" />
              3D SWARM VIEW
            </h2>
          </div>
          <div className="h-[500px] lg:h-[600px] w-full">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <span className="font-pixel text-[10px]" style={{ color: '#00FF00', textShadow: '0 0 10px #00FF00' }}>RENDERING...</span>
              </div>
            }>
              <Canvas
                camera={{ position: [0, 2, 14], fov: 50 }}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
              >
                <SwarmScene data={data} lastAgentActivity={lastAgentActivity} />
              </Canvas>
            </Suspense>
          </div>
        </GlassCard>

        {/* ─── Pipeline Flow Bar ──────────────────────────────── */}
        <GlassCard borderColor="#00FF0025" glowColor="#00FF00">
          <h2 className="font-pixel text-[11px] mb-5 tracking-widest flex items-center gap-2" style={{ color: '#00FF00', textShadow: '0 0 8px #00FF00' }}>
            <TrendingUp className="w-5 h-5 drop-shadow-[0_0_6px_#00FF00]" />
            PIPELINE FLOW
          </h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = data.pipeline[stage.status] || 0;
              const isActive = count > 0;
              return (
                <div key={stage.status} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[90px] rounded-xl p-3 transition-all ${isActive ? 'beat-pulse' : ''}`}
                    style={{
                      background: isActive ? `${stage.color}08` : 'rgba(10,10,10,0.5)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${isActive ? stage.color + '50' : '#1a1a1a'}`,
                      boxShadow: isActive ? `0 0 15px ${stage.color}30, inset 0 0 10px ${stage.color}10` : 'none',
                    }}
                  >
                    <span
                      className="font-pixel text-lg"
                      style={{
                        color: isActive ? stage.color : '#333',
                        textShadow: isActive ? `0 0 10px ${stage.color}` : 'none',
                      }}
                    >
                      {count}
                    </span>
                    <span
                      className="font-pixel text-[7px] mt-1 tracking-wider whitespace-nowrap"
                      style={{ color: isActive ? stage.color + 'A0' : '#333' }}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="mx-1 flex items-center">
                      <div className="w-6 h-px" style={{ background: `linear-gradient(90deg, ${stage.color}30, ${PIPELINE_STAGES[i + 1]?.color || '#333'}30)` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Divider glowsticks */}
        <div className="flex items-center gap-3 py-1">
          <GlowstickBar color="#00FF00" width="30%" />
          <GlowstickBar color="#FF00FF" width="20%" />
          <GlowstickBar color="#00FFFF" width="15%" />
          <GlowstickBar color="#FF00FF" width="20%" />
          <GlowstickBar color="#00FF00" width="30%" />
        </div>

        {/* ─── Two Column: Activity Feed + Recent Posts ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Feed */}
          <GlassCard borderColor="#00FFFF25" glowColor="#00FFFF">
            <h2 className="font-pixel text-[11px] tracking-widest mb-4 flex items-center gap-2" style={{ color: '#00FFFF', textShadow: '0 0 8px #00FFFF' }}>
              {'>'} EVENT_LOG
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {data.activity.length === 0 ? (
                <div className="text-center py-12">
                  <span className="font-pixel text-[9px] text-flow-gray-600 tracking-wider">WAITING FOR AGENT EVENTS...</span>
                </div>
              ) : (
                data.activity.map(act => {
                  const { label, type } = getActionLabel(act.action);
                  const agent = AGENTS.find(a => a.id === act.agent);
                  const agentColor = agent?.color || '#666';
                  return (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 rounded-xl p-3"
                      style={{
                        background: 'rgba(10, 10, 10, 0.6)',
                        backdropFilter: 'blur(8px)',
                        border: `1px solid ${type === 'error' ? '#FF000020' : type === 'success' ? agentColor + '15' : '#1a1a1a'}`,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: agentColor + '15', boxShadow: `0 0 8px ${agentColor}15` }}
                      >
                        {agent && <agent.icon className="w-3.5 h-3.5" style={{ color: agentColor }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-[8px] tracking-wider" style={{ color: agentColor, textShadow: `0 0 4px ${agentColor}60` }}>
                            {agent?.label || act.agent.toUpperCase()}
                          </span>
                          <span
                            className="font-pixel text-[7px] px-2 py-0.5 rounded-md tracking-wider"
                            style={{
                              background: type === 'success' ? '#00FF0010' : type === 'error' ? '#FF000010' : '#ffffff06',
                              color: type === 'success' ? '#00FF00' : type === 'error' ? '#FF0000' : '#666',
                              textShadow: type !== 'info' ? `0 0 4px ${type === 'success' ? '#00FF00' : '#FF0000'}60` : 'none',
                            }}
                          >
                            {label}
                          </span>
                          <span className="font-pixel text-[7px] text-flow-gray-700 ml-auto shrink-0 tracking-wider">
                            {timeAgo(act.created_at)}
                          </span>
                        </div>
                        {act.details && Object.keys(act.details).length > 0 && (
                          <div className="font-mono text-[10px] text-flow-gray-400 mt-1 truncate">
                            {act.details.hashtag ? `#${String(act.details.hashtag)}` : null}
                            {act.details.queued ? ` +${String(act.details.queued)}` : null}
                            {act.details.top_likes ? ` (${Number(act.details.top_likes).toLocaleString()} likes)` : null}
                            {act.details.title ? ` "${String(act.details.title)}"` : null}
                            {act.details.error ? <span className="text-flow-red"> {String(act.details.error).slice(0, 80)}</span> : null}
                            {act.details.cookies_count ? ` ${String(act.details.cookies_count)} cookies` : null}
                            {act.details.output_status ? ` > ${String(act.details.output_status)}` : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>

          {/* Recent Posts */}
          <GlassCard borderColor="#FF00FF25" glowColor="#FF00FF">
            <h2 className="font-pixel text-[11px] tracking-widest mb-4 flex items-center gap-2" style={{ color: '#FF00FF', textShadow: '0 0 8px #FF00FF' }}>
              {'>'} POSTS
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {data.posts.map(post => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{
                    background: 'rgba(10, 10, 10, 0.6)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${post.status === 'posted' ? '#00FF0015' : post.status === 'failed' ? '#FF000015' : '#1a1a1a'}`,
                    boxShadow: post.status === 'posted' ? '0 0 15px #00FF0008' : 'none',
                  }}
                >
                  {getStatusIcon(post.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-white truncate">
                      {post.title || 'UNTITLED'}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="font-pixel text-[7px] px-2 py-0.5 rounded-md tracking-wider"
                        style={{
                          background: post.status === 'posted' ? '#00FF0010' : post.status === 'failed' ? '#FF000010' : '#ffffff06',
                          color: post.status === 'posted' ? '#00FF00' : post.status === 'failed' ? '#FF0000' : '#555',
                          textShadow: post.status === 'posted' ? '0 0 4px #00FF0060' : 'none',
                        }}
                      >
                        {post.status.toUpperCase()}
                      </span>
                      {post.ig_like_count > 0 && (
                        <span className="font-pixel text-[7px] text-flow-gray-400 tracking-wider">
                          {post.ig_like_count.toLocaleString()} likes
                        </span>
                      )}
                      <span className="font-pixel text-[7px] text-flow-gray-700 tracking-wider">
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    {post.error_message && (
                      <div className="font-mono text-[10px] text-flow-red mt-1.5 truncate" style={{ textShadow: '0 0 4px #FF000040' }}>
                        {post.error_message}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {post.youtube_video_id && (
                        <a
                          href={`https://youtube.com/shorts/${post.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-pixel text-[7px] tracking-wider flex items-center gap-1 hover:underline"
                          style={{ color: '#FF0000', textShadow: '0 0 4px #FF000060' }}
                        >
                          YT <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {post.ig_reels_id && (
                        <span className="font-pixel text-[7px] tracking-wider" style={{ color: '#FF00FF', textShadow: '0 0 4px #FF00FF60' }}>IG</span>
                      )}
                      {post.fb_reels_id && (
                        <span className="font-pixel text-[7px] tracking-wider" style={{ color: '#0088FF', textShadow: '0 0 4px #0088FF60' }}>FB</span>
                      )}
                      <a
                        href={post.ig_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[7px] text-flow-gray-600 hover:text-flow-cyan tracking-wider flex items-center gap-1 ml-auto"
                      >
                        SRC <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-3">
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
          <span className="font-pixel text-[8px] tracking-[0.3em]" style={{ color: '#333' }}>
            FLOW AI AGENT SWARM v5 // GLASSMORPHIC 3D EDITION
          </span>
        </div>
      </div>
    </div>
  );
}
