'use client';

import { useState } from 'react';
import { Smartphone, Copy, CheckCircle2, ArrowRight, Shield, Zap, ChevronDown, ChevronUp, Download } from 'lucide-react';
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

function InstallShortcut({ baseUrl }: { baseUrl: string }) {
  const [apiKey, setApiKey] = useState('');
  const [installed, setInstalled] = useState(false);

  function handleInstall() {
    if (!apiKey.trim()) return;
    const downloadUrl = `${baseUrl}/api/swarm/shortcut?key=${encodeURIComponent(apiKey.trim())}`;
    window.location.href = downloadUrl;
    setInstalled(true);
    setTimeout(() => setInstalled(false), 5000);
  }

  return (
    <div className="border-2 border-cyan-500/30 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-purple-500/10 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
          <Download size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Install Shortcut</h2>
          <p className="text-white/50 text-sm">One-tap install — enter your API key and download</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Your UPLOAD_API_KEY</label>
          <input
            type="text"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your API key from Railway"
            className="w-full px-4 py-3 bg-black/60 border border-white/20 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <p className="text-xs text-white/40 mt-1">
            This is the <code className="px-1 py-0.5 bg-white/10 rounded">UPLOAD_API_KEY</code> from your Railway environment variables.
          </p>
        </div>

        <button
          onClick={handleInstall}
          disabled={!apiKey.trim()}
          className="w-full py-3 rounded-lg font-bold text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 active:scale-[0.98]"
        >
          {installed ? 'Opening Shortcuts...' : 'Download Shortcut'}
        </button>

        {installed && (
          <p className="text-center text-sm text-green-400">
            Tap &quot;Add Shortcut&quot; when iOS prompts you. Then share any video and select &quot;Upload to Flow&quot;.
          </p>
        )}
      </div>
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
            Share a video from your Camera Roll or Files app — the shortcut uploads it directly into your YouTube Shorts pipeline.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { emoji: '🎬', label: 'Pick a Video' },
            { emoji: '📤', label: 'Share → Shortcut' },
            { emoji: '🤖', label: 'Auto YouTube Shorts' },
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

        {/* One-tap install */}
        <InstallShortcut baseUrl={baseUrl} />

        {/* Manual Steps (collapsed by default) */}
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
                  <div className="text-white/50">This gives us the filename (e.g. <code className="px-1 py-0.5 bg-white/10 rounded">IMG_1234.MOV</code>)</div>
                  <div className="mt-1">Set variable: <code className="px-1.5 py-0.5 bg-white/10 rounded">fileName</code> = <em>Name of Shortcut Input</em></div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">3. Get Contents of URL (Warm-up)</div>
                  <div className="space-y-1">
                    <div>URL: <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">{baseUrl}/api/swarm/submit</code></div>
                    <div>Method: <strong>GET</strong></div>
                  </div>
                  <div className="text-white/50 text-xs mt-1">
                    Wakes up the server to avoid cold-start timeouts on the next calls.
                  </div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">4. Get Contents of URL (Sign)</div>
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
                      &nbsp;&nbsp;{`"filename": fileName`}<br/>
                      {`}`}
                    </div>
                    <div className="text-white/50 text-xs mt-1">
                      The server auto-detects the content type from the filename (.MOV, .MP4, etc.) — no need to specify it.
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/10 pb-3">
                  <div className="text-cyan-400 font-bold mb-1">5. If <em>Dictionary Value</em> for <code className="px-1 py-0.5 bg-white/10 rounded">uploadUrl</code> has any value</div>
                  <div className="text-white/50 text-xs">This catches sign errors — if the server returned an error, <code className="px-1 py-0.5 bg-white/10 rounded">uploadUrl</code> won&apos;t exist.</div>
                  <div className="mt-2 pl-4 border-l-2 border-cyan-500/30 space-y-3">
                    <div>
                      <div className="text-white/60 font-medium mb-1">Get Dictionary Values from step 4:</div>
                      <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">uploadUrl</code> → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">uploadUrl</code></div>
                      <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">id</code> → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">fileId</code></div>
                      <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">storagePath</code> → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">storagePath</code></div>
                      <div>Get <code className="px-1.5 py-0.5 bg-white/10 rounded">contentType</code> → set as variable <code className="px-1.5 py-0.5 bg-white/10 rounded">contentType</code></div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-cyan-400 font-bold mb-1">6. Get Contents of URL (Upload to Supabase)</div>
                      <div className="space-y-1">
                        <div>URL: <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">uploadUrl</code> (variable)</div>
                        <div>Method: <strong>PUT</strong></div>
                        <div>Headers:</div>
                        <div className="pl-4 space-y-0.5">
                          <div><code className="text-yellow-300">Content-Type</code>: <code>contentType</code> (variable from step 5)</div>
                        </div>
                        <div>Request Body: <strong>File</strong> → <em>Shortcut Input</em></div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-cyan-400 font-bold mb-1">7. Get Contents of URL (Register)</div>
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

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-cyan-400 font-bold mb-1">8. Show Notification</div>
                      <div>Title: <strong>Flow AI</strong></div>
                      <div>Body: <strong>Video uploaded to pipeline!</strong></div>
                    </div>
                  </div>
                  <div className="mt-3 pl-4 border-l-2 border-red-500/30">
                    <div className="text-red-400 font-bold mb-1">Otherwise:</div>
                    <div className="text-cyan-400 font-bold mb-1">Show Notification</div>
                    <div>Title: <strong>Flow AI</strong></div>
                    <div>Body: <strong>Upload failed — check your API key and try again.</strong></div>
                  </div>
                </div>

                <div>
                  <div className="text-cyan-400 font-bold mb-1">End If</div>
                </div>
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
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4 space-y-2">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Open a video in your <strong>Camera Roll</strong> or <strong>Files</strong></li>
                <li>Tap <strong>Share</strong></li>
                <li>Select <strong>&quot;Upload to Flow&quot;</strong></li>
                <li>The video uploads directly to the pipeline</li>
              </ol>
            </div>

            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 mt-2">
              <p className="text-sm">
                The video enters the pipeline as <code className="px-1.5 py-0.5 bg-white/10 rounded text-green-300">downloaded</code> —
                agents handle audio stripping, 9:16 formatting, 1080x1920 scaling, ≤59s trimming, viral titles, and YouTube Shorts upload automatically.
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
                <code className="px-2 py-1 bg-white/10 rounded text-xs">{`{"mode":"sign","filename":"video.mov"}`}</code>
                <CopyButton text='{"mode":"sign","filename":"video.mov"}' />
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
            <li>Select <strong>&quot;App&quot;</strong> → choose <strong>Safari</strong></li>
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
