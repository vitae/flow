'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Video, Upload, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Video as VideoType, VideoPost } from '@/lib/types';

const statusColors: Record<string, string> = {
  uploading: 'bg-flow-yellow/10 text-flow-yellow border-flow-yellow/20',
  processing: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  stripping_audio: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  generating_captions: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  fetching_music: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  merging: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  transcoding: 'bg-flow-magenta/10 text-flow-magenta border-flow-magenta/20',
  ready: 'bg-flow-green/10 text-flow-green border-flow-green/20',
  posting: 'bg-flow-yellow/10 text-flow-yellow border-flow-yellow/20',
  posted: 'bg-flow-green/10 text-flow-green border-flow-green/20',
  failed: 'bg-flow-red/10 text-flow-red border-flow-red/20',
};

export default function DashboardPage() {
  const supabase = createClient();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [posts, setPosts] = useState<Record<string, VideoPost[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: vids } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (vids) {
        setVideos(vids as VideoType[]);
        // Fetch posts for all videos
        const videoIds = vids.map(v => v.id);
        if (videoIds.length > 0) {
          const { data: allPosts } = await supabase
            .from('video_posts')
            .select('*')
            .in('video_id', videoIds);
          if (allPosts) {
            const grouped: Record<string, VideoPost[]> = {};
            allPosts.forEach((p: VideoPost) => {
              if (!grouped[p.video_id]) grouped[p.video_id] = [];
              grouped[p.video_id].push(p);
            });
            setPosts(grouped);
          }
        }
      }
      setLoading(false);
    };

    fetchData();

    // Realtime subscription for live status updates
    const channel = supabase
      .channel('video-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, (payload) => {
        setVideos(prev => prev.map(v => v.id === payload.new.id ? { ...v, ...payload.new } as VideoType : v));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const stats = {
    total: videos.length,
    posted: videos.filter(v => v.status === 'posted').length,
    processing: videos.filter(v => !['posted', 'failed', 'ready'].includes(v.status)).length,
    failed: videos.filter(v => v.status === 'failed').length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl mb-1">Dashboard</h1>
          <p className="text-flow-gray-400 text-sm">Manage your video uploads and distributions</p>
        </div>
        <Link href="/dashboard/upload" className="btn-primary text-sm">
          <Upload className="w-4 h-4" /> Upload
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total videos', value: stats.total, icon: Video, color: 'text-flow-green' },
          { label: 'Posted', value: stats.posted, icon: CheckCircle, color: 'text-flow-green' },
          { label: 'Processing', value: stats.processing, icon: Clock, color: 'text-flow-magenta' },
          { label: 'Failed', value: stats.failed, icon: AlertCircle, color: 'text-flow-red' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-flow-gray-400 text-xs">{s.label}</span>
            </div>
            <p className="font-display font-bold text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Video list */}
      {loading ? (
        <div className="text-center py-20 text-flow-gray-400">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <Video className="w-12 h-12 text-flow-gray-600 mx-auto mb-4" />
          <h2 className="font-display font-semibold text-lg mb-2">No videos yet</h2>
          <p className="text-flow-gray-400 mb-6">Upload your first video to get started</p>
          <Link href="/dashboard/upload" className="btn-primary">
            <Upload className="w-4 h-4" /> Upload video
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div key={video.id} className="glass-card p-5 hover:border-flow-green/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display font-semibold truncate">{video.title}</h3>
                    <span className={`status-badge border ${statusColors[video.status] || ''}`}>
                      {video.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {video.description && (
                    <p className="text-flow-gray-400 text-sm mb-3 line-clamp-1">{video.description}</p>
                  )}
                  {/* Platform badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {video.target_platforms.map((platform) => {
                      const post = posts[video.id]?.find(p => p.platform === platform);
                      return (
                        <span
                          key={platform}
                          className={`status-badge border ${
                            post?.status === 'posted'
                              ? 'bg-flow-green/10 text-flow-green border-flow-green/20'
                              : post?.status === 'failed'
                              ? 'bg-flow-red/10 text-flow-red border-flow-red/20'
                              : 'bg-flow-gray-800 text-flow-gray-400 border-flow-gray-700'
                          }`}
                        >
                          {platform}
                          {post?.platform_post_url && (
                            <a href={post.platform_post_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {/* Hashtags preview */}
                  {video.hashtags.length > 0 && (
                    <p className="text-flow-green/60 text-xs mt-2 truncate">
                      {video.hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}
                      {video.hashtags.length > 5 && ` +${video.hashtags.length - 5} more`}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-flow-gray-500 whitespace-nowrap">
                  {new Date(video.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
