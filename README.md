# FLOW AI

**Upload once. Post everywhere.**

AI-powered video distribution platform by [GWDF](https://gwdf.pro). Upload a video — Flow strips the audio, generates captions, adds trending royalty-free music, picks optimal hashtags, and posts to YouTube, Instagram, Facebook & X simultaneously.

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: Supabase (Postgres + Auth + Storage + Realtime)
- **Payments**: Stripe (subscriptions)
- **AI**: Claude (hashtag generation, music matching)
- **Captions**: OpenAI Whisper / AssemblyAI
- **Video Processing**: FFmpeg (strip audio, merge music, burn captions, transcode)
- **iOS Native**: Capacitor 6
- **Styling**: Tailwind CSS + GWDF brand system (Montserrat, #00FF00 + #FF00FF)
- **Deployment**: Vercel + Railway (FFmpeg worker)

## Quick Start

```bash
# Clone
git clone https://github.com/vitae/flow.git
cd flow

# Install
npm install

# Set up environment
cp .env.example .env.local
# Fill in your API keys

# Set up database
# Paste supabase/schema.sql into Supabase SQL Editor

# Run
npm run dev
```

## iOS Build

```bash
# Build for static export
npm run build

# Initialize Capacitor
npm run ios:init
npm run ios:add

# Sync and open in Xcode
npm run ios:build
```

## Video Processing Pipeline

```
Upload → Strip Audio → Generate Captions → Fetch Trending Music
  → Merge Audio + Burn Captions → Platform Transcode → Post Everywhere
```

Each step runs as a background job. Users see real-time status via Supabase Realtime.

## Platform Requirements

| Platform | API | Requirements |
|----------|-----|-------------|
| YouTube | Google YouTube Data API v3 | Google Cloud project, OAuth consent screen verification |
| Instagram | Meta Graph API | Business/Creator account, linked Facebook Page, App Review |
| Facebook | Meta Graph API | Facebook Page, App Review for `pages_manage_posts` |
| X/Twitter | Twitter API v2 | Pro API access ($100/mo), OAuth 2.0 with PKCE |

## Project Structure

```
flow/
├── app/
│   ├── layout.tsx              # Root layout + providers
│   ├── page.tsx                # Landing page
│   ├── middleware.ts           # Auth protection
│   ├── auth/
│   │   ├── login/page.tsx      # Login (OAuth + magic link)
│   │   └── callback/route.ts   # Auth callback
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard sidebar
│   │   ├── page.tsx            # Video list + stats
│   │   ├── upload/page.tsx     # Upload + platform selection
│   │   ├── connections/page.tsx # Social OAuth connections
│   │   └── settings/page.tsx   # Profile + subscription
│   └── api/
│       ├── process/route.ts    # Video processing orchestrator
│       ├── hashtags/route.ts   # Claude hashtag generation
│       ├── music/route.ts      # YouTube Audio Library search
│       ├── oauth/
│       │   ├── youtube/        # Google OAuth flow
│       │   ├── instagram/      # Meta OAuth (IG + FB)
│       │   └── twitter/        # X OAuth 2.0 + PKCE
│       └── webhooks/
│           └── stripe/route.ts # Subscription webhooks
├── lib/
│   ├── types.ts                # TypeScript types
│   ├── supabase/client.ts      # Supabase browser + server clients
│   └── platforms/posting.ts    # Platform upload implementations
├── supabase/
│   └── schema.sql              # Full database schema
├── styles/
│   └── globals.css             # GWDF brand styles
├── capacitor.config.json       # iOS native config
└── .env.example                # Environment template
```

## Brand

- **Colors**: `#00FF00` (green) + `#FF00FF` (magenta) on black
- **Font**: Montserrat
- **Tagline**: "Your Vibe Attracts Your Tribe"
- **Domain**: gwdf.pro

---

Built by GWDF • Glow Wit Da Flow
