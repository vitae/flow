'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, Film, Music, Sparkles, Hash, Check, Loader2,
  Youtube, Instagram, Facebook, Twitter
} from 'lucide-react';
import type { Platform, UploadFormData } from '@/lib/types';

const platforms: { id: Platform; label: string; icon: typeof Youtube; color: string }[] = [
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'hover:border-red-500/50 peer-checked:border-red-500 peer-checked:bg-red-500/10' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'hover:border-pink-500/50 peer-checked:border-pink-500 peer-checked:bg-pink-500/10' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'hover:border-blue-500/50 peer-checked:border-blue-500 peer-checked:bg-blue-500/10' },
  { id: 'twitter', label: 'X / Twitter', icon: Twitter, color: 'hover:border-gray-400/50 peer-checked:border-gray-400 peer-checked:bg-gray-400/10' },
];

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState<UploadFormData>({
    title: '',
    description: '',
    target_platforms: [],
    music_track_id: null,
    auto_captions: true,
    auto_hashtags: true,
    auto_music: true,
  });

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (f) {
      setFile(f);
      if (!form.title) {
        setForm(prev => ({ ...prev, title: f.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  }, [form.title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.avi'] },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false,
  });

  const togglePlatform = (platform: Platform) => {
    setForm(prev => ({
      ...prev,
      target_platforms: prev.target_platforms.includes(platform)
        ? prev.target_platforms.filter(p => p !== platform)
        : [...prev.target_platforms, platform],
    }));
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a video file');
    if (!form.title) return toast.error('Please enter a title');
    if (form.target_platforms.length === 0) return toast.error('Select at least one platform');

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // 1. Upload to Supabase Storage
      const ext = file.name.split('.').pop();
      const storagePath = `${session.user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(50);

      // 2. Create video record
      const { data: video, error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: session.user.id,
          title: form.title,
          description: form.description,
          original_storage_path: storagePath,
          file_size_bytes: file.size,
          target_platforms: form.target_platforms,
          status: 'processing',
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setUploadProgress(75);

      // 3. Trigger processing pipeline
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          video_id: video.id,
          auto_captions: form.auto_captions,
          auto_hashtags: form.auto_hashtags,
          auto_music: form.auto_music,
        }),
      });

      if (!res.ok) throw new Error('Failed to start processing');
      setUploadProgress(100);

      toast.success('Video uploaded! Processing started.');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl mb-1">Upload video</h1>
        <p className="text-flow-gray-400 text-sm">Upload once — we handle captions, music, hashtags & distribution</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          glass-card p-12 text-center cursor-pointer transition-all duration-200 mb-6
          ${isDragActive ? 'border-flow-green/60 bg-flow-green/5' : 'hover:border-flow-green/30'}
          ${file ? 'border-flow-green/40' : ''}
        `}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <Film className="w-12 h-12 text-flow-green mx-auto mb-3" />
            <p className="font-display font-semibold text-lg">{file.name}</p>
            <p className="text-flow-gray-400 text-sm mt-1">
              {(file.size / (1024 * 1024)).toFixed(1)} MB • Click or drag to replace
            </p>
          </div>
        ) : (
          <div>
            <Upload className="w-12 h-12 text-flow-gray-500 mx-auto mb-3" />
            <p className="font-display font-semibold text-lg mb-1">
              {isDragActive ? 'Drop it here' : 'Drag & drop your video'}
            </p>
            <p className="text-flow-gray-400 text-sm">MP4, MOV, WebM, AVI • Max 500MB</p>
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-flow-gray-300 mb-1.5 block">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="My awesome video"
            className="input-field"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-flow-gray-300 mb-1.5 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="What's this video about?"
            rows={3}
            className="input-field resize-none"
          />
        </div>
      </div>

      {/* Platform selection */}
      <div className="mb-6">
        <label className="text-sm font-medium text-flow-gray-300 mb-3 block">Post to</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {platforms.map((p) => {
            const selected = form.target_platforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`
                  glass-card p-4 text-center transition-all duration-200 relative
                  ${selected ? 'border-flow-green/50 bg-flow-green/5' : 'hover:border-flow-gray-500'}
                `}
              >
                {selected && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-flow-green" />
                  </div>
                )}
                <p.icon className={`w-6 h-6 mx-auto mb-2 ${selected ? 'text-flow-green' : 'text-flow-gray-400'}`} />
                <span className={`text-sm font-medium ${selected ? 'text-flow-green' : 'text-flow-gray-300'}`}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Features toggles */}
      <div className="glass-card p-5 mb-8">
        <h3 className="font-display font-semibold text-sm mb-4 text-flow-magenta">AI Processing</h3>
        <div className="space-y-3">
          {[
            { key: 'auto_captions' as const, label: 'Auto-generate captions', desc: 'AI transcribes & burns captions into the video', icon: Sparkles },
            { key: 'auto_hashtags' as const, label: 'Trending hashtags', desc: 'AI picks trending + niche hashtags per platform', icon: Hash },
            { key: 'auto_music' as const, label: 'Add trending music', desc: 'Replaces audio with a royalty-free trending track', icon: Music },
          ].map((toggle) => (
            <label key={toggle.key} className="flex items-center justify-between py-2 cursor-pointer group">
              <div className="flex items-center gap-3">
                <toggle.icon className="w-4 h-4 text-flow-magenta" />
                <div>
                  <p className="text-sm font-medium">{toggle.label}</p>
                  <p className="text-xs text-flow-gray-400">{toggle.desc}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form[toggle.key]}
                  onChange={() => setForm(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${form[toggle.key] ? 'bg-flow-green' : 'bg-flow-gray-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${form[toggle.key] ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="mb-6">
          <div className="h-2 bg-flow-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-flow-green rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-flow-gray-400 text-xs mt-2 text-center">{uploadProgress}% uploaded</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="btn-primary w-full text-lg py-4 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
        ) : (
          <><Upload className="w-5 h-5" /> Upload & distribute</>
        )}
      </button>
    </div>
  );
}
