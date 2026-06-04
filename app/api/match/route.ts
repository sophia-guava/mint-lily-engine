import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { campaign, creators } = await req.json()

  const prompt = `You are the campaign matching engine for Mint & Lily's creator program.

CAMPAIGN: ${JSON.stringify({ name: campaign.name, type: campaign.type, occasion: campaign.occasion, city: campaign.city || 'Any', deliverables: campaign.deliverables, deadline: campaign.deadline, budget: campaign.budget || 'gifting' })}

CREATORS: ${JSON.stringify(creators.map((c: any) => ({ id: c.id, name: c.name, city: c.city, followers: c.followers, platform: c.platform, engagement_rate: c.engagement_rate, signals: { audience_alignment: c.signal_audience_alignment, content_quality: c.signal_content_quality, engagement_authenticity: c.signal_engagement_authenticity, brand_safety: c.signal_brand_safety, campaign_readiness: c.signal_campaign_readiness }, bio: c.bio })))}

Score each creator's fit for this specific campaign (0.0–1.0). Consider city match, campaign type, occasion fit, and signal scores.
Return ONLY: {"matches":{"creator_id":{"score":0.00,"reason":"one sentence"},...}}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find(b => b.type === 'text')?.text || ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    // Delete old matches for this campaign
    await supabase.from('campaign_matches').delete().eq('campaign_id', campaign.id)

    // Insert new matches
    const matchRows = Object.entries(parsed.matches).map(([creatorId, result]: any) => ({
      campaign_id: campaign.id,
      creator_id: creatorId,
      score: result.score,
      reason: result.reason,
    }))

    if (matchRows.length > 0) {
      await supabase.from('campaign_matches').insert(matchRows)
    }

    return NextResponse.json({ matches: parsed.matches })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
