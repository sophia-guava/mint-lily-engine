import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Creator = {
  id: string
  name: string
  handle: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  city: string
  followers: number
  engagement_rate: number
  bio: string
  recent_captions: string
  signal_audience_alignment: number
  signal_content_quality: number
  signal_engagement_authenticity: number
  signal_brand_safety: number
  signal_campaign_readiness: number
  missing_signals: string[]
  approved: boolean
  status: 'pending' | 'scoring' | 'approved' | 'rejected' | 'contacted' | 'active'
  outreach_email?: string
  notes?: string
  gifting_cost: number
  cash_paid: number
  promo_uses: number
  link_clicks: number
  revenue_generated: number
  created_at: string
}

export type Campaign = {
  id: string
  name: string
  type: 'gifting' | 'paid' | 'affiliate' | 'product_launch'
  occasion: string
  city?: string
  budget?: number
  deliverables: string
  deadline: string
  status: 'active' | 'draft' | 'completed'
  created_at: string
}

export type CampaignMatch = {
  id: string
  campaign_id: string
  creator_id: string
  score: number
  reason: string
  created_at: string
}
