-- Run this in your Supabase SQL editor

create table if not exists creators (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  handle text not null,
  platform text not null default 'instagram',
  city text,
  followers integer default 0,
  engagement_rate numeric default 0,
  bio text,
  recent_captions text,
  signal_audience_alignment numeric default 0,
  signal_content_quality numeric default 0,
  signal_engagement_authenticity numeric default 0,
  signal_brand_safety numeric default 0,
  signal_campaign_readiness numeric default 0,
  missing_signals text[] default '{}',
  approved boolean default false,
  status text default 'pending',
  outreach_email text,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null default 'gifting',
  occasion text,
  city text,
  budget numeric,
  deliverables text,
  deadline date,
  status text default 'active',
  created_at timestamp with time zone default now()
);

create table if not exists campaign_matches (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  score numeric,
  reason text,
  created_at timestamp with time zone default now()
);

-- Seed default campaigns
insert into campaigns (name, type, occasion, city, deliverables, deadline, status)
values
  ('Mother''s Day 2026', 'gifting', 'Mother''s Day', 'Nashville', '1 Instagram Reel + 2 Stories', '2026-05-01', 'active'),
  ('Nordstrom Launch — Austin', 'paid', 'Retail Launch', 'Austin', '1 TikTok + 1 Instagram post', '2026-07-01', 'active')
on conflict do nothing;
