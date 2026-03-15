'use client';

import { useState } from 'react';
import { Smartphone, Copy, CheckCircle2, ArrowRight, Shield, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
    >
      {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
      {label || 'Copy'}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-lg font-bold shrink-0">
          {n}
        </div>
        <h3 className="text-xl font-bold flex-1">{title}</h3>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 text-white/80">{children}</div>}
    </div>
  );
}

export default function ShortcutSetupPage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gwdf.pro';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/swarm" className="text-white/60 hover:text-white transition-colors text-sm">
            &larr; Back to Swarm
          </Link>
          <div className="flex items-center gap-2">
            <Smartphone size={20} className="text-cyan-400" />
            <span className="font-bold">iOS Shortcut Setup</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
            <Zap size={18} className="text-yellow-400" />
            <span className="text-sm font-medium">Auto-Upload Pipeline</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Upload Videos From Your Phone
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Download any video on your phone, share it with this shortcut, and it automatically uploads to your Flow AI pipeline.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { emoji: '📥', label: 'Download Video' },
            { emoji: '📤', label: 'Share → Shortcut' },
            { emoji: '🤖', label: 'Agents Process It' },
          ].map((step, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-2">{step.emoji}</div>
              <div className="text-sm font-medium">{step.label}</div>
              {i < 2 && (
                <ArrowRight size={16} className="text-white/30 absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden md:block" />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <Step n={1} title="Set Your API Key">
            <p>
              Add an <code className="px-2 py-0.5 bg-white/10 rounded text-cyan-300">UPLOAD_API_KEY</code> environment variable to your Railway deployment. This secures your upload endpoint.
            </p>
            <div className="bg-black/60 rounded-lg p-4 font-mono text-sm space-y-2">
              <div className="text-white/40"># In Railway → Variables, add:</div>
              <div>
                UPLOAD_API_KEY=<span className="text-green-400">your-secret-key-here</span>
              </div>
            </div>
            <p className="text-sm text-white/50">
              Generate a strong key with: <code className="px-1.5 py-0.5 bg-white/10 rounded text-xs">openssl rand -hex 32</code>
            </p>
          </Step>

          <Step n={2} title="Create the iOS Shortcut">
            <p>Open the <strong>Shortcuts</strong> app on your iPhone and create a new shortcut with these actions:</p>

            <div className="space-y-3">
              <div className="bg-black/60 rounded-lg p-4 space-y-4 text-sm">
                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">1. Receive Input</div>
                  <div>Accept: <strong>Images, Media, Files</strong></div>
                  <div>Show in: <strong>Share Sheet</strong></div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">2. Get Name of Shortcut Input</div>
                  <div className="text-white/50">This gives us the filename</div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">3. Set Variable</div>
                  <div>Name: <code className="px-1.5 py-0.5 bg-white/10 rounded">fileName</code></div>
                  <div>Value: <em>Name of Shortcut Input</em></div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">4. Get Contents of URL (Step 1: Sign)</div>
                  <div className="space-y-1">
                    <div>URL: <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">{baseUrl}/api/swarm/submit</code></div>
                    <div>Method: <strong>POST</strong></div>
                    <div>Headers:</div>
                    <div className="pl-4 space-y-0.5">
                      <div><code className="text-yellow-300">Content-Type</code>: <code>application/json</code></div>
                      <div><code className="text-yellow-300">Authorization</code>: <code>Bearer YOUR_API_KEY</code></div>
                    </div>
                    <div>Request Body (JSON):</div>
                    <div className="bg-black/40 rounded p-2 font-mono text-xs">
                      {`{`}<br/>
                      &nbsp;&nbsp;{`"mode": "sign",`}<br/>
                      &nbsp;&nbsp;{`"filename": fileName,`}<br/>
                      &nbsp;&nbsp;{`"contentType": "video/mp4"`}<br/>
                      {`}`}
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">5. Get Dictionary Values</div>
                  <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">uploadUrl</code> from step 4 → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">uploadUrl</code></div>
                  <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">id</code> from step 4 → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">fileId</code></div>
                  <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">storagePath</code> from step 4 → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">storagePath</code></div>
                  <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">token</code> from step 4 → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">uploadToken</code></div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">6. Get Contents of URL (Step 2: Upload to Supabase)</div>
                  <div className="space-y-1">
                    <div>URL: <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">uploadUrl</code> (variable from step 5)</div>
                    <div>Method: <strong>PUT</strong></div>
                    <div>Headers:</div>
                    <div className="pl-4 space-y-0.5">
                      <div><code className="text-yellow-300">Content-Type</code>: <code>video/mp4</code></div>
                    </div>
                    <div>Request Body: <strong>File</strong> → <em>Shortcut Input</em></div>
                  </div>
                </div>

                <div>
                  <div className="text-cyan-400 font-bold mb-1">7. Get Contents of URL (Step 3: Register)</div>
                  <div className="space-y-1">
                    <div>URL: <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">{baseUrl}/api/swarm/submit</code></div>
                    <div>Method: <strong>POST</strong></div>
                    <div>Headers:</div>
                    <div className="pl-4 space-y-0.5">
                      <div><code className="text-yellow-300">Content-Type</code>: <code>application/json</code></div>
                      <div><code className="text-yellow-300">Authorization</code>: <code>Bearer YOUR_API_KEY</code></div>
                    </div>
                    <div>Request Body (JSON):</div>
                    <div className="bg-black/40 rounded p-2 font-mono text-xs">
                      {`{`}<br/>
                      &nbsp;&nbsp;{`"mode": "register",`}<br/>
                      &nbsp;&nbsp;{`"id": fileId,`}<br/>
                      &nbsp;&nbsp;{`"storagePath": storagePath,`}<br/>
                      &nbsp;&nbsp;{`"filename": fileName`}<br/>
                      {`}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/60 rounded-lg p-4">
                <div className="text-cyan-400 font-bold mb-2">8. Show Notification</div>
                <div className="text-sm">Title: <strong>Flow AI</strong></div>
                <div className="text-sm">Body: <strong>Video uploaded to pipeline!</strong></div>
              </div>
            </div>
          </Step>

          <Step n={3} title="Name Your Shortcut">
            <p>
              Name it something like <strong>&quot;Upload to Flow&quot;</strong>. Make sure <strong>&quot;Show in Share Sheet&quot;</strong> is enabled
              and it accepts <strong>Images, Media, Files</strong>.
            </p>
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
                <Shield size={16} />
                Pro Tip
              </div>
              <p className="text-sm">
                You can also add this shortcut to your home screen for one-tap access. In the Shortcuts app,
                tap the <strong>...</strong> menu on your shortcut and select &quot;Add to Home Screen&quot;.
              </p>
            </div>
          </Step>

          <Step n={4} title="Use It!">
            <p>Now whenever you download a video:</p>
            <ol className="list-decimal list-inside space-y-2 text-base">
              <li>Download the video from Instagram, TikTok, etc.</li>
              <li>Tap the <strong>Share</strong> button</li>
              <li>Select <strong>&quot;Upload to Flow&quot;</strong> from your shortcuts</li>
              <li>The video uploads in the background and enters the agent pipeline automatically</li>
            </ol>
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm">
                The video will appear in your Swarm dashboard with status <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">downloaded</code> —
                the agents will automatically process it through the pipeline (audio, editing, copywriting, publishing).
              </p>
            </div>
          </Step>
        </div>

        {/* Quick Reference */}
        <div className="border border-white/10 rounded-xl bg-black/40 backdrop-blur p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" />
            Quick Reference
          </h3>
          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-white/40 shrink-0 w-24">API Endpoint</span>
              <div className="flex items-center gap-2 flex-1">
                <code className="px-2 py-1 bg-white/10 rounded text-green-300 text-xs">{baseUrl}/api/swarm/submit</code>
                <CopyButton text={`${baseUrl}/api/swarm/submit`} />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 shrink-0 w-24">Auth Header</span>
              <code className="px-2 py-1 bg-white/10 rounded text-yellow-300 text-xs">Authorization: Bearer YOUR_KEY</code>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 shrink-0 w-24">Sign Body</span>
              <div className="flex items-center gap-2 flex-1">
                <code className="px-2 py-1 bg-white/10 rounded text-xs">{`{"mode":"sign","filename":"video.mp4","contentType":"video/mp4"}`}</code>
                <CopyButton text='{"mode":"sign","filename":"video.mp4","contentType":"video/mp4"}' />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 shrink-0 w-24">Register Body</span>
              <div className="flex items-center gap-2 flex-1">
                <code className="px-2 py-1 bg-white/10 rounded text-xs">{`{"mode":"register","id":"...","storagePath":"...","filename":"..."}`}</code>
                <CopyButton text='{"mode":"register","id":"...","storagePath":"...","filename":"..."}' />
              </div>
            </div>
          </div>
        </div>

        {/* Automation section */}
        <div className="border border-white/10 rounded-xl bg-black/40 backdrop-blur p-6 space-y-4">
          <h3 className="text-lg font-bold">Advanced: Auto-Run on Save</h3>
          <p className="text-white/60 text-sm">
            Want videos to upload <em>without</em> tapping Share? You can set up an Automation in the Shortcuts app:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-white/80">
            <li>Open Shortcuts → <strong>Automation</strong> tab</li>
            <li>Tap <strong>+</strong> → <strong>Create Personal Automation</strong></li>
            <li>Select <strong>&quot;App&quot;</strong> → choose your video downloader app (e.g., Safari, Instagram)</li>
            <li>Trigger: <strong>&quot;Is Closed&quot;</strong></li>
            <li>Action: <strong>Find Photos</strong> → filter by &quot;Last 1 Minute&quot; + &quot;Videos&quot;</li>
            <li>Action: <strong>Run Shortcut</strong> → select &quot;Upload to Flow&quot;</li>
            <li>Turn off &quot;Ask Before Running&quot;</li>
          </ol>
          <p className="text-xs text-white/40">
            Note: iOS may still show a notification when the automation runs. This is an iOS limitation.
          </p>
        </div>
      </div>
    </div>
  );
}
