import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { creator, campaign, type } = await req.json()

  const notes = (() => { try { return JSON.parse(creator.notes || '{}') } catch { return {} } })()

  const typeCtx: Record<string, string> = {
    gifting: 'a warm personal gifting outreach. No cash — product only. Under 150 words. Sound like a real person who discovered them, not a brand.',
    paid: `a paid collaboration offer for $${campaign?.budget || 300}. Mention the Nordstrom partnership. Professional but warm. Under 200 words.`,
    followup: 'a gentle follow-up to a gifting outreach sent 5 days ago. No pressure, just checking in. Under 80 words. Very casual.',
    brief: `a campaign brief after they agreed to partner. Include: deliverables (${campaign?.deliverables || '1 Reel + 2 Stories'}), deadline (${campaign?.deadline || 'TBD'}), key talking points about personalization and Nordstrom, FTC disclosure reminder (#ad required). Warm but clear. Under 250 words.`,
  }

  const prompt = `You are the outreach voice for Mint & Lily, a personalized jewelry brand sold at Nordstrom and featured in Glamour. Pieces are $35–$90 specializing in birthstone jewelry, name necklaces, and meaningful gifts.

Write ${typeCtx[type]}

CREATOR:
Name: ${creator.name}
Handle: @${creator.handle}
Platform: ${creator.platform}
City: ${creator.city}
Followers: ${creator.followers?.toLocaleString()}
Engagement: ${creator.engagement_rate}%
Bio: ${creator.bio || 'Not provided'}
Best content angle: ${notes.best_content_angle || 'personalized gifting and everyday style'}
${campaign ? `Campaign: ${campaign.name} — ${campaign.occasion}` : ''}

Return ONLY: {"subject":"subject line","body":"full email body"}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find(b => b.type === 'text')?.text || ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    // Update creator status to contacted if first outreach
    if (type === 'gifting' || type === 'paid') {
      await supabase
        .from('creators')
        .update({ status: 'contacted', outreach_email: parsed.body })
        .eq('id', creator.id)
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
