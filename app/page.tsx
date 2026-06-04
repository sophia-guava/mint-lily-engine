'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Creator, Campaign } from '@/lib/supabase'

type View = 'dashboard' | 'intake' | 'scoring' | 'campaigns' | 'outreach' | 'manage'

const NAV = [
  { id: 'dashboard' as View, label: 'Dashboard', icon: '◈' },
  { id: 'intake' as View, label: 'Creator Intake', icon: '⊕' },
  { id: 'scoring' as View, label: 'Scoring Engine', icon: '◎' },
  { id: 'campaigns' as View, label: 'Campaign Matcher', icon: '⊗' },
  { id: 'outreach' as View, label: 'Outreach Center', icon: '◉' },
  { id: 'manage' as View, label: 'Manage Campaigns', icon: '✦' },
]

function getColor(s: number) { return s >= 0.75 ? '#7a9e87' : s >= 0.5 ? '#c9a84c' : '#c9706a' }
function getCls(s: number) { return s >= 0.75 ? 'high' : s >= 0.5 ? 'mid' : 'low' }
function avgSignals(c: Creator) { return (c.signal_audience_alignment + c.signal_content_quality + c.signal_engagement_authenticity + c.signal_brand_safety + c.signal_campaign_readiness) / 5 }
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: 'badge-muted', scoring: 'badge-gold', approved: 'badge-green', rejected: 'badge-red', contacted: 'badge-blue', active: 'badge-green' }
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>
}

export default function Home() {
  const [view, setView] = useState<View>('dashboard')
  const [creators, setCreators] = useState<Creator[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [{ data: c }, { data: camp }] = await Promise.all([
      supabase.from('creators').select('*').order('created_at', { ascending: false }),
      supabase.from('campaigns').select('*').order('created_at', { ascending: true }),
    ])
    if (c) setCreators(c)
    if (camp) setCampaigns(camp)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div className="loading-dots"><span /><span /><span /></div>
      <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading engine...</span>
    </div>
  )

  const pending = creators.filter(c => c.status === 'pending').length

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark">M&L</div>
          <div>
            <div className="brand-name">Mint & Lily</div>
            <div className="brand-sub">Creator Engine</div>
          </div>
        </div>
        <ul className="nav-list">
          {NAV.map(item => (
            <li key={item.id}>
              <button className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'intake' && pending > 0 && <span className="nav-badge">{pending}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer"><div className="status-dot" /><span>Engine Active</span></div>
      </nav>
      <main className="main-content">
        {view === 'dashboard' && <Dashboard creators={creators} campaigns={campaigns} setView={setView} />}
        {view === 'intake' && <CreatorIntake onAdded={fetchAll} setView={setView} creators={creators} />}
        {view === 'scoring' && <ScoringEngine creators={creators} onUpdate={fetchAll} />}
        {view === 'campaigns' && <CampaignMatcher creators={creators} campaigns={campaigns} onUpdate={fetchAll} />}
        {view === 'outreach' && <OutreachCenter creators={creators} campaigns={campaigns} onUpdate={fetchAll} />}
        {view === 'manage' && <ManageCampaigns campaigns={campaigns} onUpdate={fetchAll} />}
      </main>
    </div>
  )
}

// ── DASHBOARD ──────────────────────────────────────────────
function Dashboard({ creators, campaigns, setView }: { creators: Creator[]; campaigns: Campaign[]; setView: (v: View) => void }) {
  const approved = creators.filter(c => c.approved).length
  const active = creators.filter(c => c.status === 'active').length

  // Forward-looking projections based on active campaigns + creators
  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const approvedCreators = creators.filter(c => c.approved)
  const pendingCreators = creators.filter(c => c.status === 'pending' || c.status === 'contacted')

  const projectedGiftingSpend = activeCampaigns
    .filter(c => c.type === 'gifting' || c.type === 'product_launch')
    .length * approvedCreators.length * 55

  const projectedPaidSpend = activeCampaigns
    .filter(c => c.type === 'paid')
    .reduce((sum, c) => sum + (c.budget || 0), 0)

  const totalProjectedSpend = projectedGiftingSpend + projectedPaidSpend

  const estTotalReach = approvedCreators.reduce((sum, c) => sum + c.followers, 0)
  const estTotalEngagements = approvedCreators.reduce((sum, c) => sum + (c.followers * c.engagement_rate / 100), 0)
  const projectedCPM = estTotalReach > 0 && totalProjectedSpend > 0
    ? (totalProjectedSpend / estTotalReach * 1000) : 0
  const giftingVsPaidSplit = totalProjectedSpend > 0
    ? Math.round(projectedGiftingSpend / totalProjectedSpend * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Overview</div>
        <h1 className="page-title">Creator Engine</h1>
        <p className="page-sub">AI-powered influencer program for Mint & Lily</p>
      </div>
      <div className="stat-grid">
        {[{ label: 'Total Creators', value: creators.length, sub: 'in pipeline' }, { label: 'Approved', value: approved, sub: 'cleared signals' }, { label: 'Active', value: active, sub: 'in campaigns' }, { label: 'Live Campaigns', value: campaigns.filter(c => c.status === 'active').length, sub: 'running now' }].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Recent Creators</span>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setView('intake')}>+ Add Creator</button>
            </div>
            {creators.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">◈</div><div className="empty-title">No creators yet</div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setView('intake')}>Add Creator</button></div>
            ) : (
              <table className="table"><thead><tr><th>Creator</th><th>City</th><th>Status</th></tr></thead>
              <tbody>{creators.slice(0, 6).map(c => (
                <tr key={c.id}><td><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>@{c.handle}</div></td>
                <td style={{ color: 'var(--ink-muted)', fontSize: 12 }}>{c.city}</td>
                <td><StatusBadge status={c.status} /></td></tr>
              ))}</tbody></table>
            )}
          </div>

          {/* Program Finance Summary */}
          <div className="card">
            <div className="card-header"><span className="card-title">Program Finance Summary</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Projected Spend', value: totalProjectedSpend > 0 ? `$${totalProjectedSpend.toLocaleString()}` : '—', sub: `${activeCampaigns.length} active campaigns`, color: 'var(--ink)' },
                  { label: 'Est. Total Reach', value: estTotalReach > 1000 ? `${(estTotalReach/1000).toFixed(0)}K` : estTotalReach > 0 ? estTotalReach.toString() : '—', sub: 'across approved creators', color: '#7a9e87' },
                  { label: 'Projected CPM', value: projectedCPM > 0 ? `$${projectedCPM.toFixed(2)}` : '—', sub: 'cost per 1K impressions', color: 'var(--ink)' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--parchment)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, color: item.color, lineHeight: 1 }}>{item.value}</div>
                    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginTop: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Est. Engagements</span>
                <span style={{ fontWeight: 500 }}>{estTotalEngagements > 1000 ? `${(estTotalEngagements/1000).toFixed(1)}K` : Math.round(estTotalEngagements) > 0 ? Math.round(estTotalEngagements).toString() : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Gifting vs Paid Split</span>
                <span style={{ fontWeight: 500 }}>{giftingVsPaidSplit > 0 ? `${giftingVsPaidSplit}% gifting / ${100 - giftingVsPaidSplit}% paid` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Creators in Pipeline</span>
                <span style={{ fontWeight: 500 }}>{approvedCreators.length} approved · {pendingCreators.length} pending</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Active Campaigns</span></div>
            <div className="card-body">
              {campaigns.filter(c => c.status === 'active').map(camp => (
                <div key={camp.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>{camp.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{camp.city && `${camp.city} · `}{camp.type} · {camp.deadline}</div></div>
                  <span className={`badge ${camp.type === 'paid' ? 'badge-gold' : 'badge-muted'}`}>{camp.type}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Engine Status</span></div>
            <div className="card-body">
              {[{ l: 'Scoring Engine', s: 'Active', c: 'badge-green' }, { l: 'Campaign Matcher', s: 'Active', c: 'badge-green' }, { l: 'Brand Voice (Claude)', s: 'Connected', c: 'badge-green' }, { l: 'Supabase Persistence', s: 'Live', c: 'badge-green' }].map(i => (
                <div key={i.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13 }}>{i.l}</span><span className={`badge ${i.c}`}>{i.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CREATOR INTAKE ─────────────────────────────────────────
function CreatorIntake({ onAdded, setView, creators }: { onAdded: () => void; setView: (v: View) => void; creators: Creator[] }) {
  const [form, setForm] = useState({ name: '', handle: '', platform: 'instagram', city: '', followers: '', avg_likes: '', avg_comments: '', bio: '', recent_captions: '' })
  const [saving, setSaving] = useState(false)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Auto-calculate engagement rate from likes + comments + followers
  const engagementRate = (() => {
    const followers = parseInt(form.followers) || 0
    const likes = parseInt(form.avg_likes) || 0
    const comments = parseInt(form.avg_comments) || 0
    if (!followers || (!likes && !comments)) return 0
    return ((likes + comments) / followers * 100)
  })()

  const engagementLabel = engagementRate === 0 ? '' : engagementRate < 1 ? '⚠ Low' : engagementRate < 3 ? 'Average' : engagementRate < 6 ? '✓ Good' : '✓ Excellent'
  const engagementColor = engagementRate === 0 ? 'var(--ink-muted)' : engagementRate < 1 ? '#c9706a' : engagementRate < 3 ? '#c9a84c' : '#7a9e87'

  const handleAdd = async () => {
    if (!form.name || !form.handle) return
    setSaving(true)
    await supabase.from('creators').insert({ name: form.name, handle: form.handle, platform: form.platform, city: form.city, followers: parseInt(form.followers) || 0, engagement_rate: parseFloat(engagementRate.toFixed(2)), bio: form.bio, recent_captions: form.recent_captions, status: 'pending', approved: false })
    await onAdded()
    setForm({ name: '', handle: '', platform: 'instagram', city: '', followers: '', avg_likes: '', avg_comments: '', bio: '', recent_captions: '' })
    setSaving(false)
    setView('scoring')
  }

  const lookupUrl = form.handle ? (form.platform === 'tiktok'
    ? `https://www.hypeauditor.com/tiktok/${form.handle}/`
    : `https://www.hypeauditor.com/instagram/${form.handle}/`) : null

  return (
    <div>
      <div className="page-header"><div className="page-eyebrow">Step 1</div><h1 className="page-title">Creator Intake</h1><p className="page-sub">Add a creator — the engine scores them automatically.</p></div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Creator Profile</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group"><label className="label">Full Name</label><input className="input" placeholder="Jessica Taylor" value={form.name} onChange={e => f('name', e.target.value)} /></div>
              <div className="form-group">
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Handle</span>
                  {lookupUrl && <a href={lookupUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 500 }}>Look up on HypeAuditor →</a>}
                </label>
                <input className="input" placeholder="jessicataylor (no @)" value={form.handle} onChange={e => f('handle', e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="label">Platform</label>
                <select className="select" value={form.platform} onChange={e => f('platform', e.target.value)}>
                  <option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="facebook">Facebook</option>
                </select>
              </div>
              <div className="form-group"><label className="label">City</label><input className="input" placeholder="Nashville, TN" value={form.city} onChange={e => f('city', e.target.value)} /></div>
            </div>

            {/* Engagement Calculator */}
            <div style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10, fontWeight: 500 }}>Engagement Calculator</div>
              <div className="grid-2" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="label">Followers</label><input className="input" type="number" placeholder="12000" value={form.followers} onChange={e => f('followers', e.target.value)} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}><label className="label">Avg Likes</label><input className="input" type="number" placeholder="480" value={form.avg_likes} onChange={e => f('avg_likes', e.target.value)} /></div>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}><label className="label">Avg Comments</label><input className="input" type="number" placeholder="32" value={form.avg_comments} onChange={e => f('avg_comments', e.target.value)} /></div>
                </div>
              </div>
              {engagementRate > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, color: engagementColor }}>{engagementRate.toFixed(1)}%</span>
                  <span style={{ fontSize: 11, color: engagementColor, fontWeight: 500 }}>{engagementLabel}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-muted)', marginLeft: 'auto' }}>engagement rate</span>
                </div>
              )}
            </div>

            <div className="form-group"><label className="label">Bio</label><textarea className="textarea" placeholder="Paste their bio or describe their content focus..." value={form.bio} onChange={e => f('bio', e.target.value)} /></div>
            <div className="form-group"><label className="label">Recent Captions (2–3 posts)</label><textarea className="textarea" style={{ minHeight: 120 }} placeholder="Paste recent captions — used for brand alignment scoring..." value={form.recent_captions} onChange={e => f('recent_captions', e.target.value)} /></div>
            <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} onClick={handleAdd} disabled={!form.name || !form.handle || saving}>
              {saving ? <><div className="loading-dots"><span /><span /><span /></div> Saving...</> : '◈ Add to Engine & Score'}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Pipeline ({creators.length})</span></div>
          {creators.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>No creators yet</div> : (
            <table className="table"><thead><tr><th>Creator</th><th>Engagement</th><th>Status</th></tr></thead>
            <tbody>{creators.slice(0, 8).map(c => (
              <tr key={c.id}><td><div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>@{c.handle} · {c.city}</div></td>
              <td style={{ fontSize: 13, color: c.engagement_rate >= 3 ? '#7a9e87' : c.engagement_rate >= 1 ? '#c9a84c' : 'var(--ink-muted)', fontWeight: 500 }}>{c.engagement_rate > 0 ? `${c.engagement_rate}%` : '—'}</td>
              <td><StatusBadge status={c.status} /></td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SCORING ENGINE ─────────────────────────────────────────
const SIG_LABELS: Record<string, string> = { signal_audience_alignment: 'Audience Alignment', signal_content_quality: 'Content Quality', signal_engagement_authenticity: 'Engagement Authenticity', signal_brand_safety: 'Brand Safety', signal_campaign_readiness: 'Campaign Readiness' }
const SIG_KEYS = ['signal_audience_alignment', 'signal_content_quality', 'signal_engagement_authenticity', 'signal_brand_safety', 'signal_campaign_readiness'] as const

function ScoringEngine({ creators, onUpdate }: { creators: Creator[]; onUpdate: () => void }) {
  const [selId, setSelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const selected = creators.find(c => c.id === selId)
  const avg = selected ? avgSignals(selected) : 0

  const runScoring = async (creator: Creator) => {
    setLoading(true); setAnalysis('')
    await supabase.from('creators').update({ status: 'scoring' }).eq('id', creator.id)
    await onUpdate()
    try {
      const res = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creator) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const a = data.analysis
      setAnalysis(`${a.reasoning}\n\n✓ Strengths: ${a.strengths.join(' · ')}${a.concerns.length ? `\n⚠ Concerns: ${a.concerns.join(' · ')}` : ''}\n\n◈ Recommended: ${a.recommended_campaign_type} campaign\n◈ Best angle: ${a.best_content_angle}`)
      await onUpdate()
    } catch (e: any) {
      setAnalysis(`Error: ${e.message}`)
      await supabase.from('creators').update({ status: 'pending' }).eq('id', creator.id)
      await onUpdate()
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header"><div className="page-eyebrow">Step 2</div><h1 className="page-title">Scoring Engine</h1><p className="page-sub">Sonnet evaluates each creator against 5 brand fit signals.</p></div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Creator Queue ({creators.length})</span></div>
          {creators.length === 0 ? <div className="empty-state"><div className="empty-icon">◎</div><div className="empty-title">Queue empty</div><div className="empty-sub">Add creators in Intake first</div></div> : creators.map(c => {
            const a = avgSignals(c)
            return (
              <div key={c.id} onClick={() => { setSelId(c.id); setAnalysis('') }} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selId === c.id ? 'var(--gold-pale)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.1s' }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>@{c.handle} · {c.city} · {c.followers.toLocaleString()} followers</div></div>
                {c.status === 'scoring' ? <div className="loading-dots"><span /><span /><span /></div>
                  : a > 0 ? <div className={`score-circle ${getCls(a)}`}><span className="score-num">{Math.round(a * 100)}</span><span className="score-denom">/100</span></div>
                    : <span className="badge badge-muted">Unscored</span>}
              </div>
            )
          })}
        </div>
        <div>
          {!selected ? <div className="card"><div className="empty-state"><div className="empty-icon">◎</div><div className="empty-title">Select a creator</div></div></div> : (
            <>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div><div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 20, fontWeight: 500 }}>{selected.name}</div><div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>@{selected.handle} · {selected.platform} · {selected.city}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {avg > 0 && <div className={`score-circle ${getCls(avg)}`}><span className="score-num">{Math.round(avg * 100)}</span><span className="score-denom">/100</span></div>}
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: 16 }}>
                    {SIG_KEYS.map(key => (
                      <div key={key} className="signal-row">
                        <span className="signal-label">{SIG_LABELS[key]}</span>
                        <div className="signal-bar-track"><div className="signal-bar-fill" style={{ width: `${(selected[key] as number) * 100}%`, background: getColor(selected[key] as number) }} /></div>
                        <span className="signal-score" style={{ color: getColor(selected[key] as number) }}>{(selected[key] as number) > 0 ? Math.round((selected[key] as number) * 100) : '—'}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} onClick={() => runScoring(selected)} disabled={loading}>
                    {loading ? <><div className="loading-dots"><span /><span /><span /></div> Scoring...</> : `${avg > 0 ? '↻ Re-run' : '◎ Run'} Scoring Engine`}
                  </button>
                </div>
              </div>
              {(analysis || (selected.notes && avg > 0)) && (
                <div className="ai-response">
                  {analysis || (() => { try { const n = JSON.parse(selected.notes || '{}'); return `${n.reasoning}\n\n✓ Strengths: ${n.strengths?.join(' · ')}${n.concerns?.length ? `\n⚠ Concerns: ${n.concerns?.join(' · ')}` : ''}\n\n◈ Recommended: ${n.recommended_campaign_type} campaign\n◈ Best angle: ${n.best_content_angle}` } catch { return '' } })()}
                </div>
              )}
              <CreatorROIPanel creator={selected} onUpdate={onUpdate} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CAMPAIGN MATCHER ────────────────────────────────────────
function CampaignMatcher({ creators, campaigns, onUpdate }: { creators: Creator[]; campaigns: Campaign[]; onUpdate: () => void }) {
  const [selCamp, setSelCamp] = useState(campaigns[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, { score: number; reason: string }>>({})
  const campaign = campaigns.find(c => c.id === selCamp)
  const approved = creators.filter(c => c.approved)

  // Refresh campaigns list when view loads
  useEffect(() => { onUpdate() }, [])
  useEffect(() => { if (campaigns.length > 0 && !selCamp) setSelCamp(campaigns[0].id) }, [campaigns])

  const runMatcher = async () => {
    if (!campaign || approved.length === 0) return
    setLoading(true); setResults({})
    const res = await fetch('/api/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign, creators: approved }) })
    const data = await res.json()
    if (data.matches) setResults(data.matches)
    setLoading(false)
  }

  const sorted = Object.entries(results).sort(([, a], [, b]) => b.score - a.score)

  return (
    <div>
      <div className="page-header"><div className="page-eyebrow">Step 3</div><h1 className="page-title">Campaign Matcher</h1><p className="page-sub">Match approved creators to campaigns by fit score.</p></div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Campaigns</span></div>
            {campaigns.map(camp => (
              <div key={camp.id} onClick={() => { setSelCamp(camp.id); setResults({}) }} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selCamp === camp.id ? 'var(--gold-pale)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>{camp.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{camp.city && `${camp.city} · `}{camp.occasion} · {camp.deadline}</div></div>
                  <span className={`badge ${camp.type === 'paid' ? 'badge-gold' : 'badge-muted'}`}>{camp.type}</span>
                </div>
              </div>
            ))}
          </div>
          {campaign && (
            <div className="card">
              <div className="card-header"><span className="card-title">Details</span></div>
              <div className="card-body">
                {[{ l: 'Type', v: campaign.type }, { l: 'Occasion', v: campaign.occasion }, { l: 'City', v: campaign.city || 'Any' }, { l: 'Deliverables', v: campaign.deliverables }, { l: 'Deadline', v: campaign.deadline }, { l: 'Budget', v: campaign.budget ? `$${campaign.budget}/creator` : 'Gifting only' }].map(i => (
                  <div key={i.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--ink-muted)' }}>{i.l}</span><span style={{ fontWeight: 500 }}>{i.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Match Results</span>
            <button className="btn btn-gold" onClick={runMatcher} disabled={loading || approved.length === 0 || !campaign}>
              {loading ? <><div className="loading-dots"><span /><span /><span /></div> Matching...</> : '⊗ Run Matcher'}
            </button>
          </div>
          {approved.length === 0 ? <div className="empty-state"><div className="empty-icon">⊗</div><div className="empty-title">No approved creators</div><div className="empty-sub">Score and approve creators first</div></div>
            : sorted.length === 0 && !loading ? <div className="empty-state"><div className="empty-icon">⊗</div><div className="empty-title">Run the matcher</div><div className="empty-sub">{approved.length} approved creator{approved.length !== 1 ? 's' : ''} ready</div></div>
              : <>
                  {/* Budget Planner */}
                  {sorted.length > 0 && campaign && (() => {
                    const topCreators = sorted.filter(([,r]) => r.score >= 0.7)
                    const topCount = topCreators.length
                    const totalCampaignBudget = campaign.budget || 0  // total campaign budget
                    const perCreatorBudget = topCount > 0 && totalCampaignBudget > 0 ? totalCampaignBudget / topCount : 0
                    const giftingCost = 55 * topCount // avg Mint & Lily product cost per creator
                    const totalSpend = campaign.type === 'paid' ? totalCampaignBudget : giftingCost
                    const estReach = topCreators.reduce((sum, [id]) => {
                      const c = creators.find(x => x.id === id)
                      return sum + (c ? c.followers * (c.engagement_rate / 100) : 0)
                    }, 0)
                    const estImpressions = topCreators.reduce((sum, [id]) => {
                      const c = creators.find(x => x.id === id)
                      return sum + (c ? c.followers : 0)
                    }, 0)
                    const cpm = estImpressions > 0 && totalSpend > 0 ? (totalSpend / estImpressions * 1000) : 0
                    return (
                      <div style={{ margin: '0 0 0 0', padding: '16px 20px', background: 'linear-gradient(135deg, var(--gold-pale), #fdfbf7)', borderBottom: '1px solid var(--gold-light)' }}>
                        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a6520', marginBottom: 10, fontWeight: 600 }}>Campaign Budget Planner — {topCount} Top Match{topCount !== 1 ? 'es' : ''}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 8 }}>
                          {[
                            { l: 'Total Budget', v: totalSpend > 0 ? `$${totalSpend.toLocaleString()}` : campaign.type !== 'paid' ? `$${giftingCost} gifting` : '—' },
                            { l: 'Per Creator', v: campaign.type === 'paid' && perCreatorBudget > 0 ? `$${perCreatorBudget.toFixed(0)}` : campaign.type !== 'paid' ? '$55 gifting' : '—' },
                            { l: 'Est. Impressions', v: estImpressions > 1000 ? `${(estImpressions / 1000).toFixed(0)}K` : estImpressions.toString() },
                            { l: 'CPM', v: cpm > 0 ? `$${cpm.toFixed(2)}` : '—' },
                          ].map(item => (
                            <div key={item.l} style={{ textAlign: 'center' }}>
                              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>{item.v}</div>
                              <div style={{ fontSize: 10, color: '#8a6520', marginTop: 3, letterSpacing: '0.04em' }}>{item.l}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink-muted)' }}>
                          <span>Est. Engagements: <strong style={{ color: 'var(--ink)' }}>{estReach > 1000 ? `${(estReach / 1000).toFixed(1)}K` : Math.round(estReach).toString()}</strong></span>
                          {campaign.type === 'gifting' && <span>Gifting est. at $55/creator avg product value</span>}
                        </div>
                      </div>
                    )
                  })()}
                  {sorted.map(([id, result]) => {
                    const creator = creators.find(c => c.id === id); if (!creator) return null
                    const s = result.score; const isTop = s >= 0.7
                    return (
                      <div key={id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start', background: isTop ? 'linear-gradient(90deg,rgba(201,168,76,0.04),transparent)' : 'transparent' }}>
                        <div className={`score-circle ${getCls(s)}`}><span className="score-num">{Math.round(s * 100)}</span><span className="score-denom">/100</span></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500, fontSize: 14 }}>{creator.name}</span>
                            {isTop && <span className="badge badge-gold">Top Match</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 6 }}>@{creator.handle} · {creator.city} · {creator.followers.toLocaleString()} followers · {creator.engagement_rate}% eng.</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{result.reason}</div>
                        </div>
                      </div>
                    )
                  })}
                </>}
        </div>
      </div>
    </div>
  )
}

// ── OUTREACH CENTER ─────────────────────────────────────────
type OType = 'gifting' | 'paid' | 'followup' | 'brief'
function OutreachCenter({ creators, campaigns, onUpdate }: { creators: Creator[]; campaigns: Campaign[]; onUpdate: () => void }) {
  const [selId, setSelId] = useState('')
  const [selCamp, setSelCamp] = useState(campaigns[0]?.id || '')
  const [type, setType] = useState<OType>('gifting')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const creator = creators.find(c => c.id === selId)
  const campaign = campaigns.find(c => c.id === selCamp)
  const eligible = creators.filter(c => c.approved || c.status === 'contacted' || c.status === 'active')

  const generate = async () => {
    if (!creator) return
    setLoading(true); setEmail(null)
    const res = await fetch('/api/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creator, campaign, type }) })
    const data = await res.json()
    if (data.subject) { setEmail(data); await onUpdate() }
    setLoading(false)
  }

  const copy = () => { if (!email) return; navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div>
      <div className="page-header"><div className="page-eyebrow">Step 4</div><h1 className="page-title">Outreach Center</h1><p className="page-sub">Claude writes personalized emails in Mint & Lily brand voice.</p></div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Select Creator</span></div>
            {eligible.length === 0 ? <div className="empty-state"><div className="empty-icon">◉</div><div className="empty-title">No approved creators</div></div> : eligible.map(c => (
              <div key={c.id} onClick={() => { setSelId(c.id); setEmail(null) }} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selId === c.id ? 'var(--gold-pale)' : 'transparent', transition: 'background 0.1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>@{c.handle} · {c.city}</div></div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Email Type</span></div>
            <div className="card-body">
              {([{ id: 'gifting', label: 'Gifting Outreach', desc: 'First touch — product only' }, { id: 'paid', label: 'Paid Collaboration', desc: 'Fee-based offer' }, { id: 'followup', label: 'Follow-Up', desc: '5-day nudge' }, { id: 'brief', label: 'Campaign Brief', desc: 'Onboarding after agreement' }] as { id: OType; label: string; desc: string }[]).map(item => (
                <div key={item.id} onClick={() => { setType(item.id); setEmail(null) }} style={{ padding: '10px 12px', border: `1px solid ${type === item.id ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: 8, background: type === item.id ? 'var(--gold-pale)' : 'white', transition: 'all 0.1s' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Campaign</span></div>
            <div className="card-body">
              <select className="select" value={selCamp} onChange={e => setSelCamp(e.target.value)}>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Generated Email</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {email && <button className="btn btn-outline" onClick={copy}>{copied ? '✓ Copied' : '⎘ Copy'}</button>}
                <button className="btn btn-gold" onClick={generate} disabled={loading || !creator}>
                  {loading ? <><div className="loading-dots"><span /><span /><span /></div> Writing...</> : '◉ Generate Email'}
                </button>
              </div>
            </div>
            <div className="card-body">
              {!creator ? <div className="empty-state"><div className="empty-icon">◉</div><div className="empty-title">Select a creator first</div></div>
                : !email && !loading ? (
                  <div className="empty-state">
                    <div className="empty-icon">◉</div>
                    <div className="empty-title">Ready to generate</div>
                    <div className="empty-sub">{type} outreach for {creator.name}</div>
                    <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={generate}>Generate</button>
                  </div>
                ) : loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 20px', justifyContent: 'center', color: 'var(--ink-muted)' }}>
                    <div className="loading-dots"><span /><span /><span /></div>
                    <span style={{ fontSize: 13 }}>Writing in brand voice...</span>
                  </div>
                ) : email ? (
                  <div>
                    <div style={{ marginBottom: 16 }}><label className="label">Subject</label><div style={{ padding: '9px 12px', background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500 }}>{email.subject}</div></div>
                    <div><label className="label">Body</label><textarea className="textarea" style={{ minHeight: 320, fontSize: 13, lineHeight: 1.7 }} value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })} /></div>
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-muted)' }}>↑ Edit before sending. Creator status auto-updated to "contacted".</div>
                  </div>
                ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MANAGE CAMPAIGNS ───────────────────────────────────────
function ManageCampaigns({ campaigns, onUpdate }: { campaigns: Campaign[]; onUpdate: () => void }) {
  const empty = { name: '', type: 'gifting', occasion: '', city: '', budget: '', deliverables: '', deadline: '', status: 'active' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.deliverables || !form.deadline) return
    setSaving(true)
    const { error } = await supabase.from('campaigns').insert({
      name: form.name, type: form.type, occasion: form.occasion,
      city: form.city || null, budget: form.budget ? parseFloat(form.budget) : null,
      deliverables: form.deliverables, deadline: form.deadline, status: form.status
    })
    if (error) console.error('Campaign insert error:', error)
    await onUpdate()
    setForm(empty)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await supabase.from('campaigns').delete().eq('id', id)
    await onUpdate()
    setDeleting(null)
  }

  const toggleStatus = async (camp: Campaign) => {
    await supabase.from('campaigns').update({ status: camp.status === 'active' ? 'draft' : 'active' }).eq('id', camp.id)
    await onUpdate()
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Settings</div>
        <h1 className="page-title">Manage Campaigns</h1>
        <p className="page-sub">Add product launches, gifting campaigns, and paid opportunities.</p>
      </div>
      <div className="split-layout" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">New Campaign</span></div>
          <div className="card-body">
            <div className="form-group"><label className="label">Campaign Name</label><input className="input" placeholder="Birthstone Line Launch" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="label">Type</label>
                <select className="select" value={form.type} onChange={e => f('type', e.target.value)}>
                  <option value="gifting">Gifting</option>
                  <option value="paid">Paid</option>
                  <option value="affiliate">Affiliate</option>
                  <option value="product_launch">Product Launch</option>
                </select>
              </div>
              <div className="form-group"><label className="label">Occasion / Theme</label><input className="input" placeholder="Birthstone Collection Launch" value={form.occasion} onChange={e => f('occasion', e.target.value)} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">City <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-muted)' }}>(optional — leave blank for national)</span></label>
                <input className="input" placeholder="Leave blank for product launch" value={form.city} onChange={e => f('city', e.target.value)} />
              </div>
              <div className="form-group"><label className="label">Total Campaign Budget ($)</label><input className="input" type="number" placeholder="Leave blank for gifting" value={form.budget} onChange={e => f('budget', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="label">Deliverables</label><input className="input" placeholder="1 Instagram Reel + 2 Stories" value={form.deliverables} onChange={e => f('deliverables', e.target.value)} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="label">Launch / Deadline Date</label><input className="input" type="date" value={form.deadline} onChange={e => f('deadline', e.target.value)} /></div>
              <div className="form-group"><label className="label">Status</label>
                <select className="select" value={form.status} onChange={e => f('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} onClick={handleAdd} disabled={!form.name || !form.deliverables || !form.deadline || saving}>
              {saving ? <><div className="loading-dots"><span /><span /><span /></div> Saving...</> : '✦ Add Campaign'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">All Campaigns ({campaigns.length})</span></div>
          {campaigns.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✦</div><div className="empty-title">No campaigns yet</div><div className="empty-sub">Add your first campaign on the left</div></div>
          ) : campaigns.map(camp => (
            <div key={camp.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{camp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                    {camp.occasion}{camp.city ? ` · ${camp.city}` : ' · National'} · {camp.deadline}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`badge ${camp.type === 'paid' ? 'badge-gold' : camp.type === 'product_launch' ? 'badge-blue' : 'badge-muted'}`}>{camp.type}</span>
                  <span className={`badge ${camp.status === 'active' ? 'badge-green' : 'badge-muted'}`}>{camp.status}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10 }}>
                {camp.deliverables}{camp.budget ? ` · $${camp.budget}/creator` : ' · Gifting'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => toggleStatus(camp)}>
                  {camp.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: '#c9706a' }} onClick={() => handleDelete(camp.id)} disabled={deleting === camp.id}>
                  {deleting === camp.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── CREATOR ROI PANEL ──────────────────────────────────────
function CreatorROIPanel({ creator, onUpdate }: { creator: Creator; onUpdate: () => void }) {
  const [form, setForm] = useState({
    gifting_cost: creator.gifting_cost?.toString() || '',
    cash_paid: creator.cash_paid?.toString() || '',
    promo_uses: creator.promo_uses?.toString() || '',
    link_clicks: creator.link_clicks?.toString() || '',
    revenue_generated: creator.revenue_generated?.toString() || '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const totalCost = (parseFloat(form.gifting_cost) || 0) + (parseFloat(form.cash_paid) || 0)
  const revenue = parseFloat(form.revenue_generated) || 0
  const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost * 100) : 0
  const cpe = (parseInt(form.link_clicks) || 0) + (parseInt(form.promo_uses) || 0) > 0
    ? totalCost / ((parseInt(form.link_clicks) || 0) + (parseInt(form.promo_uses) || 0))
    : 0

  const save = async () => {
    setSaving(true)
    await supabase.from('creators').update({
      gifting_cost: parseFloat(form.gifting_cost) || 0,
      cash_paid: parseFloat(form.cash_paid) || 0,
      promo_uses: parseInt(form.promo_uses) || 0,
      link_clicks: parseInt(form.link_clicks) || 0,
      revenue_generated: parseFloat(form.revenue_generated) || 0,
    }).eq('id', creator.id)
    await onUpdate()
    setSaving(false)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <span className="card-title">ROI Tracker</span>
        {totalCost > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, color: roi >= 0 ? '#7a9e87' : '#c9706a' }}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(0)}% ROI
            </span>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="label">Gifting Cost ($)</label><input className="input" type="number" placeholder="55" value={form.gifting_cost} onChange={e => f('gifting_cost', e.target.value)} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="label">Cash Paid ($)</label><input className="input" type="number" placeholder="0" value={form.cash_paid} onChange={e => f('cash_paid', e.target.value)} /></div>
        </div>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="label">Promo Code Uses</label><input className="input" type="number" placeholder="0" value={form.promo_uses} onChange={e => f('promo_uses', e.target.value)} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="label">Link Clicks</label><input className="input" type="number" placeholder="0" value={form.link_clicks} onChange={e => f('link_clicks', e.target.value)} /></div>
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}><label className="label">Revenue Generated ($)</label><input className="input" type="number" placeholder="0" value={form.revenue_generated} onChange={e => f('revenue_generated', e.target.value)} /></div>

        {totalCost > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14, padding: '12px', background: 'var(--parchment)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            {[
              { l: 'Total Cost', v: `$${totalCost.toLocaleString()}` },
              { l: 'Cost / Conversion', v: cpe > 0 ? `$${cpe.toFixed(2)}` : '—' },
              { l: 'ROI', v: `${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%`, color: roi >= 0 ? '#7a9e87' : '#c9706a' },
            ].map(item => (
              <div key={item.l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 18, color: (item as any).color || 'var(--ink)', fontWeight: 400 }}>{item.v}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.04em', marginTop: 2 }}>{item.l}</div>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={save} disabled={saving}>
          {saving ? <><div className="loading-dots"><span /><span /><span /></div> Saving...</> : '↳ Save ROI Data'}
        </button>
      </div>
    </div>
  )
}
