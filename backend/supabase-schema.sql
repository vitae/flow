-- flow.ai Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ── Paid Users ───────────────────────────────────────────────────────────────
create table if not exists paid_users (
  id                        uuid default gen_random_uuid() primary key,
  email                     text unique not null,
  stripe_payment_intent_id  text unique,
  amount_paid               integer,
  currency                  text default 'usd',
  paid_at                   timestamptz default now(),
  created_at                timestamptz default now()
);

create index if not exists paid_users_email_idx on paid_users(email);
alter table paid_users enable row level security;

-- ── Artist Profiles ───────────────────────────────────────────────────────────
create table if not exists artist_profiles (
  id           uuid default gen_random_uuid() primary key,
  email        text references paid_users(email) on delete cascade,
  instagram    text,
  prop         text,
  styles       text[],
  music        text[],
  colors       text[],
  color_names  text[],
  career       text,
  goal         text,
  bio          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table artist_profiles enable row level security;

-- ── Chat History (optional) ───────────────────────────────────────────────────
create table if not exists chat_messages (
  id         uuid default gen_random_uuid() primary key,
  email      text references paid_users(email) on delete cascade,
  role       text check (role in ('user', 'assistant')),
  content    text,
  created_at timestamptz default now()
);

create index if not exists chat_messages_email_idx on chat_messages(email);
alter table chat_messages enable row level security;
