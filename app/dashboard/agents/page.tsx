'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search, Download, Volume2, Scissors, PenTool, Upload, Cookie, Music,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, ExternalLink,
  ArrowRight, Zap, TrendingUp, Eye,
} from 'lucide-react';

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

const AGENTS = [
  { id: 'scout', label: 'SCOUT', icon: Search, color: '#00FFFF', desc: 'FINDS VIRAL VIDS' },
  { id: 'downloader', label: 'DWNLD', icon: Download, color: '#00FF00', desc: 'DOWNLOADS' },
  { id: 'audio_engineer', label: 'AUDIO', icon: Volume2, color: '#FFFF00', desc: 'STRIPS AUDIO' },
  { id: 'editor', label: 'EDITR', icon: Scissors, color: '#FF00FF', desc: 'TRIMS VIDEO' },
  { id: 'copywriter', label: 'COPYW', icon: PenTool, color: '#FF8800', desc: 'WRITES META' },
  { id: 'publisher', label: 'PUBLR', icon: Upload, color: '#00FF00', desc: 'POSTS CONTENT' },
  { id: 'music_adder', label: 'MUSIC', icon: Music, color: '#FF00FF', desc: 'ADDS BEATS' },
  { id: 'cookie_refresher', label: 'COOKR', icon: Cookie, color: '#FFFF00', desc: 'KEEPS AUTH' },
];

const PIPELINE_STAGES = [
  { status: 'pending', label: 'PEND', color: '#444' },
  { status: 'downloading', label: 'DWNL', color: '#00FFFF' },
  { status: 'downloaded', label: 'DONE', color: '#00FFFF' },
  { status: 'audio_search', label: 'AUD', color: '#FFFF00' },
  { status: 'audio_ready', label: 'AUD+', color: '#FFFF00' },
  { status: 'edited', label: 'EDIT', color: '#FF00FF' },
  { status: 'metadata_ready', label: 'RDY', color: '#FF8800' },
  { status: 'uploading', label: 'UPLD', color: '#00FF00' },
  { status: 'posted', label: 'LIVE', color: '#00FF00' },
  { status: 'failed', label: 'FAIL', color: '#FF0000' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H`;
  return `${Math.floor(hrs / 24)}D`;
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
    case 'posted': return <CheckCircle2 className="w-3.5 h-3.5 drop-shadow-[0_0_6px_#00FF00]" style={{ color: '#00FF00' }} />;
    case 'failed': return <AlertTriangle className="w-3.5 h-3.5 drop-shadow-[0_0_6px_#FF0000]" style={{ color: '#FF0000' }} />;
    case 'uploading':
    case 'processing':
    case 'audio_search':
      return <Loader2 className="w-3.5 h-3.5 animate-spin drop-shadow-[0_0_6px_#00FFFF]" style={{ color: '#00FFFF' }} />;
    case 'metadata_ready': return <Zap className="w-3.5 h-3.5 drop-shadow-[0_0_6px_#FF8800]" style={{ color: '#FF8800' }} />;
    default: return <Clock className="w-3.5 h-3.5 text-flow-gray-600" />;
  }
}

// Pixel art glowstick bar
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

export default function AgentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);

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

  // Beat pulse counter for animations
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-2 border-flow-green rounded-sm animate-spin glowstick-green" />
        <span className="font-pixel text-[10px] neon-text-green neon-flicker">LOADING SWARM...</span>
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
    <div className="max-w-6xl mx-auto space-y-5 relative">
      {/* Laser beams */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="laser-h-green" style={{ top: '15%', left: 0 }} />
        <div className="laser-h-magenta" style={{ top: '45%', right: 0 }} />
        <div className="laser-v-green" style={{ left: '20%', top: 0 }} />
        <div className="laser-v-magenta" style={{ right: '30%', top: 0 }} />
        <div className="laser-h-green" style={{ top: '75%', left: '10%' }} />
        <div className="laser-v-magenta" style={{ left: '60%', top: '20%' }} />
      </div>

      {/* Scanline overlay */}
      <div className="fixed inset-0 scanlines pointer-events-none z-[1] opacity-30" />

      {/* Content */}
      <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-lg neon-text-green neon-flicker tracking-wider">
              AGENT SWARM
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <GlowstickBar color="#00FF00" width="40px" />
              <GlowstickBar color="#FF00FF" width="24px" />
              <span className="font-pixel text-[7px] text-flow-gray-500 uppercase tracking-widest">
                live monitoring
              </span>
              <GlowstickBar color="#FF00FF" width="24px" />
              <GlowstickBar color="#00FF00" width="40px" />
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 font-pixel text-[7px] px-3 py-2 rounded border border-flow-green/30 text-flow-green hover:neon-border-green transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            {lastRefresh.toLocaleTimeString()}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL', value: totalPosts, color: '#FFFFFF', borderColor: '#333' },
            { label: 'LIVE', value: postedCount, color: '#00FF00', borderColor: '#00FF0040' },
            { label: 'QUEUE', value: inPipeline, color: '#00FFFF', borderColor: '#00FFFF40' },
            { label: 'FAIL', value: failedCount, color: '#FF0000', borderColor: '#FF000040' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-lg p-3 pixel-grid relative overflow-hidden"
              style={{
                background: '#050505',
                border: `2px solid ${stat.borderColor}`,
                boxShadow: stat.value > 0 ? `0 0 10px ${stat.borderColor}, inset 0 0 10px ${stat.borderColor}` : 'none',
              }}
            >
              <div
                className="font-pixel text-xl"
                style={{ color: stat.color, textShadow: `0 0 8px ${stat.color}80` }}
              >
                {stat.value}
              </div>
              <div className="font-pixel text-[7px] mt-1 tracking-widest" style={{ color: stat.color + '80' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline Flow */}
        <div
          className="rounded-lg p-4 relative overflow-hidden pixel-grid"
          style={{
            background: '#050505',
            border: '2px solid #00FF0030',
            boxShadow: '0 0 15px #00FF0010, inset 0 0 15px #00FF0008',
          }}
        >
          <h2 className="font-pixel text-[8px] neon-text-green mb-4 tracking-widest flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 drop-shadow-[0_0_6px_#00FF00]" />
            PIPELINE FLOW
          </h2>
          <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = data.pipeline[stage.status] || 0;
              const isActive = count > 0;
              return (
                <div key={stage.status} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[56px] rounded p-2 transition-all ${isActive ? 'beat-pulse' : ''}`}
                    style={{
                      background: isActive ? stage.color + '12' : '#0a0a0a',
                      border: `2px solid ${isActive ? stage.color + '60' : '#1a1a1a'}`,
                      boxShadow: isActive ? `0 0 8px ${stage.color}40, inset 0 0 4px ${stage.color}20` : 'none',
                    }}
                  >
                    <span
                      className="font-pixel text-sm"
                      style={{
                        color: isActive ? stage.color : '#333',
                        textShadow: isActive ? `0 0 6px ${stage.color}` : 'none',
                      }}
                    >
                      {count}
                    </span>
                    <span
                      className="font-pixel text-[5px] mt-1 tracking-wider whitespace-nowrap"
                      style={{ color: isActive ? stage.color + 'A0' : '#333' }}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="mx-0.5 flex flex-col items-center gap-0.5">
                      <div className="w-3 h-px" style={{ background: `linear-gradient(90deg, ${stage.color}40, ${PIPELINE_STAGES[i + 1].color}40)` }} />
                      <ArrowRight className="w-2 h-2" style={{ color: '#333' }} />
                      <div className="w-3 h-px" style={{ background: `linear-gradient(90deg, ${stage.color}40, ${PIPELINE_STAGES[i + 1].color}40)` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agents Grid */}
        <div
          className="rounded-lg p-4 relative overflow-hidden pixel-grid"
          style={{
            background: '#050505',
            border: '2px solid #FF00FF30',
            boxShadow: '0 0 15px #FF00FF10, inset 0 0 15px #FF00FF08',
          }}
        >
          <h2 className="font-pixel text-[8px] neon-text-magenta mb-4 tracking-widest flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 drop-shadow-[0_0_6px_#FF00FF]" />
            AGENT STATUS
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {AGENTS.map(agent => {
              const lastAct = lastAgentActivity[agent.id];
              const hasError = lastAct?.action === 'error';
              const isRecent = lastAct && (Date.now() - new Date(lastAct.created_at).getTime()) < 300000;

              return (
                <div
                  key={agent.id}
                  className={`rounded p-2.5 transition-all relative overflow-hidden ${isRecent && !hasError ? 'glowstick-green' : ''} ${hasError ? 'glowstick-magenta' : ''}`}
                  style={{
                    background: '#0a0a0a',
                    border: `2px solid ${hasError ? '#FF000060' : isRecent ? agent.color + '50' : '#1a1a1a'}`,
                    boxShadow: isRecent && !hasError ? `inset 0 0 15px ${agent.color}15` : hasError ? 'inset 0 0 15px #FF000015' : 'none',
                  }}
                >
                  {/* Pixel grid inside card */}
                  <div className="absolute inset-0 pixel-grid opacity-50" />

                  <div className="relative flex items-center gap-2 mb-1.5">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{
                        background: agent.color + '20',
                        border: `1px solid ${agent.color}40`,
                        boxShadow: `0 0 6px ${agent.color}30`,
                      }}
                    >
                      <agent.icon className="w-3 h-3" style={{ color: agent.color, filter: `drop-shadow(0 0 4px ${agent.color})` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-pixel text-[7px] tracking-wider" style={{ color: agent.color, textShadow: `0 0 4px ${agent.color}80` }}>
                        {agent.label}
                      </div>
                      <div className="font-pixel text-[5px] text-flow-gray-600 tracking-wider">{agent.desc}</div>
                    </div>
                    {isRecent && !hasError && (
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{
                          background: agent.color,
                          boxShadow: `0 0 4px ${agent.color}, 0 0 8px ${agent.color}`,
                        }}
                      />
                    )}
                    {hasError && (
                      <AlertTriangle className="w-3 h-3 drop-shadow-[0_0_4px_#FF0000]" style={{ color: '#FF0000' }} />
                    )}
                  </div>
                  <div className="relative">
                    {lastAct ? (
                      <div className="font-pixel text-[5px] text-flow-gray-500 tracking-wider">
                        {getActionLabel(lastAct.action).label} {timeAgo(lastAct.created_at)}
                      </div>
                    ) : (
                      <div className="font-pixel text-[5px] text-flow-gray-700 tracking-wider">IDLE</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider glowsticks */}
        <div className="flex items-center gap-3 py-1">
          <GlowstickBar color="#00FF00" width="30%" />
          <GlowstickBar color="#FF00FF" width="20%" />
          <GlowstickBar color="#00FFFF" width="15%" />
          <GlowstickBar color="#FF00FF" width="20%" />
          <GlowstickBar color="#00FF00" width="30%" />
        </div>

        {/* Two Column: Activity Feed + Recent Posts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Activity Feed */}
          <div
            className="rounded-lg p-4 relative overflow-hidden"
            style={{
              background: '#050505',
              border: '2px solid #00FFFF30',
              boxShadow: '0 0 15px #00FFFF10',
            }}
          >
            <h2 className="font-pixel text-[8px] tracking-widest mb-3 flex items-center gap-2" style={{ color: '#00FFFF', textShadow: '0 0 6px #00FFFF' }}>
              {'>'} EVENT_LOG
            </h2>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {data.activity.length === 0 ? (
                <div className="text-center py-8">
                  <span className="font-pixel text-[6px] text-flow-gray-600 tracking-wider">WAITING FOR AGENT EVENTS...</span>
                </div>
              ) : (
                data.activity.map(act => {
                  const { label, type } = getActionLabel(act.action);
                  const agent = AGENTS.find(a => a.id === act.agent);
                  const agentColor = agent?.color || '#666';
                  return (
                    <div
                      key={act.id}
                      className="flex items-start gap-2 rounded p-2"
                      style={{
                        background: '#0a0a0a',
                        border: `1px solid ${type === 'error' ? '#FF000025' : type === 'success' ? agentColor + '20' : '#1a1a1a'}`,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: agentColor + '20', boxShadow: `0 0 4px ${agentColor}20` }}
                      >
                        {agent && <agent.icon className="w-2 h-2" style={{ color: agentColor }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-pixel text-[5px] tracking-wider" style={{ color: agentColor }}>
                            {agent?.label || act.agent.toUpperCase()}
                          </span>
                          <span
                            className="font-pixel text-[5px] px-1.5 py-0.5 rounded tracking-wider"
                            style={{
                              background: type === 'success' ? '#00FF0015' : type === 'error' ? '#FF000015' : '#ffffff08',
                              color: type === 'success' ? '#00FF00' : type === 'error' ? '#FF0000' : '#666',
                              textShadow: type === 'success' ? '0 0 4px #00FF0060' : type === 'error' ? '0 0 4px #FF000060' : 'none',
                            }}
                          >
                            {label}
                          </span>
                          <span className="font-pixel text-[5px] text-flow-gray-700 ml-auto shrink-0 tracking-wider">
                            {timeAgo(act.created_at)}
                          </span>
                        </div>
                        {act.details && Object.keys(act.details).length > 0 && (
                          <div className="font-mono text-[8px] text-flow-gray-500 mt-0.5 truncate">
                            {act.details.hashtag && `#${act.details.hashtag}`}
                            {act.details.queued && ` +${act.details.queued}`}
                            {act.details.top_likes && ` (${Number(act.details.top_likes).toLocaleString()})`}
                            {act.details.title && `"${act.details.title}"`}
                            {act.details.error && <span className="text-flow-red">{String(act.details.error).slice(0, 60)}</span>}
                            {act.details.cookies_count && `${act.details.cookies_count} cookies`}
                            {act.details.output_status && `> ${act.details.output_status}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Posts */}
          <div
            className="rounded-lg p-4 relative overflow-hidden"
            style={{
              background: '#050505',
              border: '2px solid #FF00FF30',
              boxShadow: '0 0 15px #FF00FF10',
            }}
          >
            <h2 className="font-pixel text-[8px] neon-text-magenta tracking-widest mb-3 flex items-center gap-2">
              {'>'} POSTS
            </h2>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {data.posts.map(post => (
                <div
                  key={post.id}
                  className="flex items-start gap-2 rounded p-2"
                  style={{
                    background: '#0a0a0a',
                    border: `1px solid ${post.status === 'posted' ? '#00FF0020' : post.status === 'failed' ? '#FF000020' : '#1a1a1a'}`,
                    boxShadow: post.status === 'posted' ? '0 0 8px #00FF0008' : 'none',
                  }}
                >
                  {getStatusIcon(post.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-white truncate">
                      {post.title || 'UNTITLED'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="font-pixel text-[5px] px-1.5 py-0.5 rounded tracking-wider"
                        style={{
                          background: post.status === 'posted' ? '#00FF0015' : post.status === 'failed' ? '#FF000015' : '#ffffff08',
                          color: post.status === 'posted' ? '#00FF00' : post.status === 'failed' ? '#FF0000' : '#555',
                          border: `1px solid ${post.status === 'posted' ? '#00FF0030' : post.status === 'failed' ? '#FF000030' : '#222'}`,
                          textShadow: post.status === 'posted' ? '0 0 4px #00FF0060' : 'none',
                        }}
                      >
                        {post.status.toUpperCase()}
                      </span>
                      {post.ig_like_count > 0 && (
                        <span className="font-pixel text-[5px] text-flow-gray-500 tracking-wider">
                          {post.ig_like_count.toLocaleString()}
                        </span>
                      )}
                      <span className="font-pixel text-[5px] text-flow-gray-700 tracking-wider">
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    {post.error_message && (
                      <div className="font-mono text-[8px] text-flow-red mt-1 truncate" style={{ textShadow: '0 0 4px #FF000040' }}>
                        {post.error_message}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {post.youtube_video_id && (
                        <a
                          href={`https://youtube.com/shorts/${post.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-pixel text-[5px] tracking-wider flex items-center gap-0.5 hover:underline"
                          style={{ color: '#FF0000', textShadow: '0 0 4px #FF000060' }}
                        >
                          YT <ExternalLink className="w-2 h-2" />
                        </a>
                      )}
                      {post.ig_reels_id && (
                        <span className="font-pixel text-[5px] tracking-wider" style={{ color: '#FF00FF', textShadow: '0 0 4px #FF00FF60' }}>IG</span>
                      )}
                      {post.fb_reels_id && (
                        <span className="font-pixel text-[5px] tracking-wider" style={{ color: '#0088FF', textShadow: '0 0 4px #0088FF60' }}>FB</span>
                      )}
                      <a
                        href={post.ig_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[5px] text-flow-gray-600 hover:text-flow-cyan tracking-wider flex items-center gap-0.5 ml-auto"
                      >
                        SRC <ExternalLink className="w-2 h-2" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer glowsticks */}
        <div className="flex items-center justify-center gap-2 py-2">
          <GlowstickBar color="#FF00FF" width="8px" />
          <GlowstickBar color="#00FF00" width="12px" />
          <GlowstickBar color="#FF00FF" width="16px" />
          <GlowstickBar color="#00FF00" width="20px" />
          <GlowstickBar color="#00FFFF" width="24px" />
          <GlowstickBar color="#00FF00" width="20px" />
          <GlowstickBar color="#FF00FF" width="16px" />
          <GlowstickBar color="#00FF00" width="12px" />
          <GlowstickBar color="#FF00FF" width="8px" />
        </div>
        <div className="text-center">
          <span className="font-pixel text-[6px] tracking-[0.3em]" style={{ color: '#333' }}>
            FLOW AI AGENT SWARM v3 // CYBER RAVE EDITION
          </span>
        </div>
      </div>
    </div>
  );
}
