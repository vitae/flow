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
  { id: 'scout', label: 'Scout', icon: Search, color: '#00FFFF', desc: 'Finds viral videos' },
  { id: 'downloader', label: 'Downloader', icon: Download, color: '#00FF00', desc: 'Downloads videos' },
  { id: 'audio_engineer', label: 'Audio', icon: Volume2, color: '#FFFF00', desc: 'Strips audio' },
  { id: 'editor', label: 'Editor', icon: Scissors, color: '#FF00FF', desc: 'Trims to Shorts' },
  { id: 'copywriter', label: 'Copywriter', icon: PenTool, color: '#FF8800', desc: 'Writes metadata' },
  { id: 'publisher', label: 'Publisher', icon: Upload, color: '#00FF00', desc: 'Posts to platforms' },
  { id: 'music_adder', label: 'Music', icon: Music, color: '#FF00FF', desc: 'Adds trending audio' },
  { id: 'cookie_refresher', label: 'Cookies', icon: Cookie, color: '#FFFF00', desc: 'Refreshes YT auth' },
];

const PIPELINE_STAGES = [
  { status: 'pending', label: 'Pending', color: '#666' },
  { status: 'downloading', label: 'Downloading', color: '#00FFFF' },
  { status: 'downloaded', label: 'Downloaded', color: '#00FFFF' },
  { status: 'audio_search', label: 'Audio', color: '#FFFF00' },
  { status: 'audio_ready', label: 'Audio Ready', color: '#FFFF00' },
  { status: 'edited', label: 'Edited', color: '#FF00FF' },
  { status: 'metadata_ready', label: 'Ready', color: '#FF8800' },
  { status: 'uploading', label: 'Uploading', color: '#00FF00' },
  { status: 'posted', label: 'Posted', color: '#00FF00' },
  { status: 'failed', label: 'Failed', color: '#FF0000' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getActionLabel(action: string): { label: string; type: 'success' | 'error' | 'info' } {
  switch (action) {
    case 'discovered': return { label: 'Found viral videos', type: 'success' };
    case 'processing': return { label: 'Processing', type: 'info' };
    case 'completed': return { label: 'Completed', type: 'success' };
    case 'published': return { label: 'Published', type: 'success' };
    case 'refreshed': return { label: 'Cookies refreshed', type: 'success' };
    case 'error': return { label: 'Error', type: 'error' };
    default: return { label: action, type: 'info' };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'posted': return <CheckCircle2 className="w-3.5 h-3.5 text-flow-green" />;
    case 'failed': return <AlertTriangle className="w-3.5 h-3.5 text-flow-red" />;
    case 'uploading':
    case 'processing':
    case 'audio_search':
      return <Loader2 className="w-3.5 h-3.5 text-flow-cyan animate-spin" />;
    case 'metadata_ready': return <Zap className="w-3.5 h-3.5 text-orange-400" />;
    default: return <Clock className="w-3.5 h-3.5 text-flow-gray-500" />;
  }
}

export default function AgentDashboard() {
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
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-flow-green animate-spin" />
      </div>
    );
  }

  const totalPosts = Object.values(data.pipeline).reduce((a, b) => a + b, 0);
  const postedCount = data.pipeline['posted'] || 0;
  const failedCount = data.pipeline['failed'] || 0;
  const inPipeline = totalPosts - postedCount - failedCount;

  // Get last activity per agent
  const lastAgentActivity: Record<string, Activity> = {};
  for (const act of data.activity) {
    if (!lastAgentActivity[act.agent]) {
      lastAgentActivity[act.agent] = act;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Agent Swarm</h1>
          <p className="text-sm text-flow-gray-400 mt-1">Real-time pipeline monitoring</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-xs text-flow-gray-400 hover:text-flow-green transition-colors px-3 py-1.5 rounded-lg border border-flow-gray-800 hover:border-flow-green/30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-gray-800 p-4">
          <div className="text-2xl font-bold text-white">{totalPosts}</div>
          <div className="text-xs text-flow-gray-400 mt-1">Total Posts</div>
        </div>
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-green/20 p-4">
          <div className="text-2xl font-bold text-flow-green">{postedCount}</div>
          <div className="text-xs text-flow-gray-400 mt-1">Published</div>
        </div>
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-cyan/20 p-4">
          <div className="text-2xl font-bold text-flow-cyan">{inPipeline}</div>
          <div className="text-xs text-flow-gray-400 mt-1">In Pipeline</div>
        </div>
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-red/20 p-4">
          <div className="text-2xl font-bold text-flow-red">{failedCount}</div>
          <div className="text-xs text-flow-gray-400 mt-1">Failed</div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="rounded-xl bg-flow-gray-900/80 border border-flow-gray-800 p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-flow-green" />
          Pipeline Flow
        </h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = data.pipeline[stage.status] || 0;
            return (
              <div key={stage.status} className="flex items-center">
                <div
                  className="flex flex-col items-center min-w-[72px] rounded-lg p-2 transition-all"
                  style={{
                    backgroundColor: count > 0 ? stage.color + '10' : 'transparent',
                    border: `1px solid ${count > 0 ? stage.color + '30' : '#222'}`,
                  }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: count > 0 ? stage.color : '#444' }}
                  >
                    {count}
                  </span>
                  <span className="text-[9px] text-flow-gray-500 whitespace-nowrap">{stage.label}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-flow-gray-700 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="rounded-xl bg-flow-gray-900/80 border border-flow-gray-800 p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-flow-cyan" />
          Agent Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {AGENTS.map(agent => {
            const lastAct = lastAgentActivity[agent.id];
            const hasError = lastAct?.action === 'error';
            const isRecent = lastAct && (Date.now() - new Date(lastAct.created_at).getTime()) < 300000; // 5min

            return (
              <div
                key={agent.id}
                className="rounded-lg p-3 border transition-all"
                style={{
                  backgroundColor: isRecent ? agent.color + '08' : '#0a0a0a',
                  borderColor: hasError ? '#FF000030' : isRecent ? agent.color + '25' : '#222',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: agent.color + '15' }}
                  >
                    <agent.icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white">{agent.label}</div>
                    <div className="text-[9px] text-flow-gray-500">{agent.desc}</div>
                  </div>
                  {isRecent && !hasError && (
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: agent.color }} />
                  )}
                  {hasError && (
                    <AlertTriangle className="w-3.5 h-3.5 text-flow-red" />
                  )}
                </div>
                {lastAct ? (
                  <div className="text-[10px] text-flow-gray-500">
                    {getActionLabel(lastAct.action).label} &middot; {timeAgo(lastAct.created_at)}
                  </div>
                ) : (
                  <div className="text-[10px] text-flow-gray-600">No activity yet</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Activity Feed + Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Activity Feed</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {data.activity.length === 0 ? (
              <p className="text-xs text-flow-gray-500 text-center py-8">No activity yet. Agents will log events here once they start processing.</p>
            ) : (
              data.activity.map(act => {
                const { label, type } = getActionLabel(act.action);
                const agent = AGENTS.find(a => a.id === act.agent);
                return (
                  <div
                    key={act.id}
                    className="flex items-start gap-2 rounded-lg p-2 bg-flow-gray-900/50 border border-flow-gray-800/50"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: (agent?.color || '#666') + '15' }}
                    >
                      {agent && <agent.icon className="w-2.5 h-2.5" style={{ color: agent.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-flow-gray-300">
                          {agent?.label || act.agent}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          type === 'success' ? 'bg-flow-green/10 text-flow-green' :
                          type === 'error' ? 'bg-flow-red/10 text-flow-red' :
                          'bg-flow-gray-800 text-flow-gray-400'
                        }`}>
                          {label}
                        </span>
                        <span className="text-[9px] text-flow-gray-600 ml-auto shrink-0">
                          {timeAgo(act.created_at)}
                        </span>
                      </div>
                      {act.details && Object.keys(act.details).length > 0 && (
                        <div className="text-[9px] text-flow-gray-500 mt-0.5 truncate">
                          {act.details.hashtag && `#${act.details.hashtag}`}
                          {act.details.queued && ` — ${act.details.queued} queued`}
                          {act.details.top_likes && ` (top: ${Number(act.details.top_likes).toLocaleString()} likes)`}
                          {act.details.title && `"${act.details.title}"`}
                          {act.details.error && <span className="text-flow-red">{String(act.details.error).slice(0, 80)}</span>}
                          {act.details.cookies_count && `${act.details.cookies_count} cookies`}
                          {act.details.output_status && `→ ${act.details.output_status}`}
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
        <div className="rounded-xl bg-flow-gray-900/80 border border-flow-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Posts</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {data.posts.map(post => (
              <div
                key={post.id}
                className="flex items-start gap-2.5 rounded-lg p-2.5 bg-flow-gray-900/50 border border-flow-gray-800/50"
              >
                {getStatusIcon(post.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">
                    {post.title || 'Untitled'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                      post.status === 'posted' ? 'bg-flow-green/10 text-flow-green border-flow-green/20' :
                      post.status === 'failed' ? 'bg-flow-red/10 text-flow-red border-flow-red/20' :
                      'bg-flow-gray-800 text-flow-gray-400 border-flow-gray-700'
                    }`}>
                      {post.status}
                    </span>
                    {post.ig_like_count > 0 && (
                      <span className="text-[9px] text-flow-gray-500">
                        {post.ig_like_count.toLocaleString()} likes
                      </span>
                    )}
                    <span className="text-[9px] text-flow-gray-600">
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                  {post.error_message && (
                    <div className="text-[9px] text-flow-red mt-1 truncate">
                      {post.error_message}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {post.youtube_video_id && (
                      <a
                        href={`https://youtube.com/shorts/${post.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-flow-red hover:underline flex items-center gap-0.5"
                      >
                        YT <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                    {post.ig_reels_id && (
                      <span className="text-[9px] text-purple-400">IG Reel</span>
                    )}
                    {post.fb_reels_id && (
                      <span className="text-[9px] text-blue-400">FB Reel</span>
                    )}
                    <a
                      href={post.ig_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-flow-gray-500 hover:text-flow-cyan flex items-center gap-0.5 ml-auto"
                    >
                      Source <ExternalLink className="w-2 h-2" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
