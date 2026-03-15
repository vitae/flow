-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FLOW AI — Full Supabase Schema                                        ║
-- ║  Run in Supabase SQL Editor → New Query                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Enable extensions ────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users (extends Supabase Auth) ────────────────────────────────────────────
create table if not exists public.users (
  id                  uuid references auth.users(id) on delete cascade primary key,
  email               text unique not null,
  display_name        text,
  avatar_url          text,
  subscription_tier   text default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  stripe_customer_id  text unique,
  videos_this_month   integer default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── Videos ───────────────────────────────────────────────────────────────────
create table if not exists public.videos (
  id                      uuid default uuid_generate_v4() primary key,
  user_id                 uuid references public.users(id) on delete cascade not null,
  title                   text not null,
  description             text,
  original_storage_path   text not null,
  processed_storage_path  text,
  thumbnail_url           text,
  duration_seconds        integer,
  file_size_bytes         bigint,
  status                  text default 'uploading' check (status in (
    'uploading', 'processing', 'stripping_audio', 'generating_captions',
    'fetching_music', 'merging', 'transcoding', 'ready', 'posting', 'posted', 'failed'
  )),
  captions_srt            text,
  captions_vtt            text,
  hashtags                text[] default '{}',
  music_track_id          text,
  music_track_title       text,
  music_source            text check (music_source in ('youtube_audio_library', 'custom')),
  target_platforms        text[] default '{}',
  error_message           text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.videos enable row level security;
create policy "Users can view own videos" on public.videos for select using (auth.uid() = user_id);
create policy "Users can insert own videos" on public.videos for insert with check (auth.uid() = user_id);
create policy "Users can update own videos" on public.videos for update using (auth.uid() = user_id);
create policy "Users can delete own videos" on public.videos for delete using (auth.uid() = user_id);

create index idx_videos_user_id on public.videos(user_id);
create index idx_videos_status on public.videos(status);


-- ── Social Connections (OAuth tokens per platform) ───────────────────────────
create table if not exists public.social_connections (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.users(id) on delete cascade not null,
  platform            text not null check (platform in ('youtube', 'instagram', 'facebook', 'twitter')),
  platform_user_id    text not null,
  platform_username   text,
  access_token        text not null,           -- encrypted at rest via Supabase Vault
  refresh_token       text,
  token_expires_at    timestamptz,
  page_id             text,                    -- Facebook Page ID / IG Business Account ID
  page_name           text,
  is_active           boolean default true,
  connected_at        timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(user_id, platform)
);

alter table public.social_connections enable row level security;
create policy "Users can view own connections" on public.social_connections for select using (auth.uid() = user_id);
create policy "Users can manage own connections" on public.social_connections for all using (auth.uid() = user_id);


-- ── Video Posts (one per platform per video) ─────────────────────────────────
create table if not exists public.video_posts (
  id                  uuid default uuid_generate_v4() primary key,
  video_id            uuid references public.videos(id) on delete cascade not null,
  platform            text not null check (platform in ('youtube', 'instagram', 'facebook', 'twitter')),
  platform_post_id    text,
  platform_post_url   text,
  status              text default 'queued' check (status in ('queued', 'uploading', 'processing', 'posted', 'failed')),
  error_message       text,
  posted_at           timestamptz,
  created_at          timestamptz default now(),
  unique(video_id, platform)
);

alter table public.video_posts enable row level security;
create policy "Users can view own posts" on public.video_posts for select
  using (exists (select 1 from public.videos where videos.id = video_posts.video_id and videos.user_id = auth.uid()));


-- ── Video Jobs (processing pipeline tracking) ────────────────────────────────
create table if not exists public.video_jobs (
  id              uuid default uuid_generate_v4() primary key,
  video_id        uuid references public.videos(id) on delete cascade not null,
  job_type        text not null check (job_type in (
    'strip_audio', 'generate_captions', 'fetch_music', 'merge_audio', 'transcode', 'post'
  )),
  status          text default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  platform        text check (platform in ('youtube', 'instagram', 'facebook', 'twitter')),
  progress        integer default 0,
  result_data     jsonb,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);

alter table public.video_jobs enable row level security;
create policy "Users can view own jobs" on public.video_jobs for select
  using (exists (select 1 from public.videos where videos.id = video_jobs.video_id and videos.user_id = auth.uid()));

create index idx_video_jobs_video_id on public.video_jobs(video_id);
create index idx_video_jobs_status on public.video_jobs(status);


-- ── Music Tracks (cached YouTube Audio Library) ──────────────────────────────
create table if not exists public.music_tracks (
  id                  uuid default uuid_generate_v4() primary key,
  youtube_video_id    text unique not null,
  title               text not null,
  artist              text not null,
  genre               text,
  mood                text,
  duration_seconds    integer,
  preview_url         text,
  download_url        text not null,
  license             text not null,
  trending_score      integer default 0,
  fetched_at          timestamptz default now()
);

-- Music tracks are public (read-only for users)
alter table public.music_tracks enable row level security;
create policy "Anyone can view music tracks" on public.music_tracks for select to authenticated using (true);


-- ── Subscriptions (Stripe sync) ──────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                      uuid default uuid_generate_v4() primary key,
  user_id                 uuid references public.users(id) on delete cascade unique not null,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  status                  text default 'inactive' check (status in ('active', 'inactive', 'past_due', 'canceled')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);


-- ── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute procedure update_updated_at();
create trigger videos_updated_at before update on public.videos
  for each row execute procedure update_updated_at();
create trigger social_connections_updated_at before update on public.social_connections
  for each row execute procedure update_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute procedure update_updated_at();


-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  524288000,  -- 500MB max
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'audio/mpeg', 'audio/mp3']
) on conflict (id) do nothing;

-- Storage policies
create policy "Users can upload videos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own videos" on storage.objects
  for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own videos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
