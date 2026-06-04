import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const creator = await req.json()

  const prompt = `You are the scoring engine for Mint & Lily's creator program. Mint & Lily is a personalized jewelry brand ($35–$90) sold at Nordstrom and featured in Glamour. They specialize in birthstone necklaces, name jewelry, and meaningful personalized pieces. Buyer: women 28–50 who shop Nordstrom and buy gifts for meaningful occasions.

Score this creator on all 5 signals (0.50–0.95). Be realistic and nuanced.

CREATOR:
Name: ${creator.name}
Handle: @${creator.handle}
Platform: ${creator.platform}
City: ${creator.city}
Followers: ${creator.followers?.toLocaleString()}
Engagement Rate: ${creator.engagement_rate}%
Bio: ${creator.bio || 'Not provided'}
Recent Captions: ${creator.recent_captions || 'Not provided'}

Return ONLY this JSON:
{
  "signals": {
    "audience_alignment": 0.00,
    "content_quality": 0.00,
    "engagement_authenticity": 0.00,
    "brand_safety": 0.00,
    "campaign_readiness": 0.00
  },
  "approved": true,
  "reasoning": "2-3 sentence assessment",
  "strengths": ["strength 1", "strength 2"],
  "concerns": [],
  "recommended_campaign_type": "gifting",
  "best_content_angle": "one sentence describing ideal content angle"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find(b => b.type === 'text')?.text || ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const missing = Object.entries(parsed.signals)
      .filter(([, v]) => (v as number) < 0.65)
      .map(([k]) => k)

    const { data, error } = await supabase
      .from('creators')
      .update({
        signal_audience_alignment: parsed.signals.audience_alignment,
        signal_content_quality: parsed.signals.content_quality,
        signal_engagement_authenticity: parsed.signals.engagement_authenticity,
        signal_brand_safety: parsed.signals.brand_safety,
        signal_campaign_readiness: parsed.signals.campaign_readiness,
        missing_signals: missing,
        approved: parsed.approved,
        status: parsed.approved ? 'approved' : 'rejected',
        notes: JSON.stringify({
          reasoning: parsed.reasoning,
          strengths: parsed.strengths,
          concerns: parsed.concerns,
          recommended_campaign_type: parsed.recommended_campaign_type,
          best_content_angle: parsed.best_content_angle,
        }),
      })
      .eq('id', creator.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ creator: data, analysis: parsed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
