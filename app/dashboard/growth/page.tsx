'use client'

import { useState, useEffect } from 'react'

export default function BusinessGrowthPage() {
  const [industry, setIndustry] = useState('AI Agency')
  const [niche, setNiche] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'cycle' | 'history'>('cycle')

  const loadStatus = async () => {
    const res = await fetch('/api/business/status')
    if (res.ok) setStatus(await res.json())
  }

  useEffect(() => { if (tab === 'history') loadStatus() }, [tab])

  const handleRun = async () => {
    setRunning(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/business/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, niche: niche || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
    } catch (e: any) { setError(e.message) }
    setRunning(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Business Growth</h1>
          <p className="text-sm text-slate-500 mt-1">Discover opportunities. Design offers. Build businesses.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {(['cycle', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'cycle' ? 'Run Cycle' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'cycle' && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Industry</label>
            <input value={industry} onChange={e => setIndustry(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3" placeholder="e.g. AI Agency, Real Estate, SaaS" />
            <label className="text-sm font-medium text-slate-700 mb-2 block">Niche (optional)</label>
            <input value={niche} onChange={e => setNiche(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" placeholder="e.g. AI Automation for Real Estate" />
            <button onClick={handleRun} disabled={running || !industry.trim()}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {running ? 'Running...' : 'Run Business Growth Cycle'}
            </button>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6"><p className="text-sm text-red-700">{error}</p></div>}

          {result && (
            <div className="space-y-4">
              <div className={`rounded-lg border p-4 ${result.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className="text-sm font-semibold text-slate-900 mb-3">Growth Cycle Results</p>
                <div className="grid grid-cols-4 gap-3 text-center mb-3">
                  <div><p className="text-[10px] text-slate-500">Trends</p><p className="text-sm font-bold">{result.market?.trends?.length || 0}</p></div>
                  <div><p className="text-[10px] text-slate-500">Competitors</p><p className="text-sm font-bold">{result.competitors?.competitors?.length || 0}</p></div>
                  <div><p className="text-[10px] text-slate-500">Opportunities</p><p className="text-sm font-bold">{result.opportunities?.length || 0}</p></div>
                  <div><p className="text-[10px] text-slate-500">Offers</p><p className="text-sm font-bold">{result.offers?.length || 0}</p></div>
                </div>
                {result.errors?.length > 0 && <div className="text-xs text-red-600 border-t border-amber-200 pt-2">{result.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>}
              </div>

              {result.summary && <div className="bg-white rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-700">{result.summary}</p></div>}

              {/* Opportunities */}
              {result.opportunities?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Opportunities ({result.opportunities.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.opportunities.map((o: any, i: number) => (
                      <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">{o.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Fit: {o.marketFit}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{o.description}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Revenue: {o.revenue} | Timeframe: {o.timeframe} | Effort: {o.effort}%</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Offers */}
              {result.offers?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Offers ({result.offers.length})</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.offers.map((o: any, i: number) => (
                      <div key={i} className="py-3 border-b border-slate-50 last:border-0">
                        <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                        <p className="text-xs text-emerald-600 italic">"{o.tagline}"</p>
                        <p className="text-xs text-slate-500 mt-1">{o.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-mono text-purple-600">{o.pricing}</span>
                          <span className="text-[10px] text-slate-400">Target: {o.targetAudience}</span>
                        </div>
                        {o.deliverables?.length > 0 && (
                          <div className="mt-1"><p className="text-[10px] text-slate-400">Deliverables: {o.deliverables.join(', ')}</p></div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Competitors */}
              {result.competitors?.competitors?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Competitor Analysis</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    {result.competitors.competitors.map((c: any, i: number) => (
                      <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                        <p className="text-sm font-medium text-slate-900">{c.name} <span className="text-[10px] text-slate-400">({c.marketShare})</span></p>
                        <p className="text-[10px] text-slate-500">Strengths: {c.strengths?.join(', ')}</p>
                        <p className="text-[10px] text-red-600">Weaknesses: {c.weaknesses?.join(', ')}</p>
                      </div>
                    ))}
                    {result.competitors.gaps?.length > 0 && (
                      <div className="mt-2"><p className="text-[10px] text-emerald-700 uppercase font-semibold">Market Gaps</p>{result.competitors.gaps.map((g: string, i: number) => <p key={i} className="text-xs text-slate-700">→ {g}</p>)}</div>
                    )}
                  </div>
                </details>
              )}

              {/* Market Trends */}
              {result.market?.trends?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Market Intelligence</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">Market Size: {result.market.marketSize} | Growth: {result.market.growthRate}</p>
                    {result.market.trends.map((t: any, i: number) => (
                      <div key={i} className="py-1 border-b border-slate-50 last:border-0">
                        <p className="text-xs text-slate-700"><span className={`text-[9px] px-1 py-0.5 rounded ${t.impact === 'high' ? 'bg-red-100 text-red-700' : t.impact === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{t.impact}</span> {t.trend}: {t.description}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Revenue */}
              {result.revenue?.monthlyProjection?.length > 0 && (
                <details className="bg-white rounded-lg border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Revenue Projection</summary>
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400"><th className="text-left py-1">Month</th><th className="text-right py-1">Leads</th><th className="text-right py-1">Conversions</th><th className="text-right py-1">Revenue</th></tr></thead>
                        <tbody>
                          {result.revenue.monthlyProjection.slice(0, 6).map((m: any, i: number) => (
                            <tr key={i} className="border-t border-slate-50"><td className="py-1 text-slate-700">{m.month}</td><td className="text-right text-slate-700">{m.leads}</td><td className="text-right text-slate-700">{m.conversions}</td><td className="text-right text-slate-700">${(m.revenue || 0).toLocaleString()}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Break-even: {result.revenue.breakEven}</p>
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {status?.logs?.length > 0 ? status.logs.slice(0, 10).map((l: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${l.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span>
                <p className="text-xs font-medium text-slate-900">{l.action}</p>
              </div>
              <p className="text-xs text-slate-500">{l.message}</p>
              <p className="text-[9px] text-slate-400 mt-1">{new Date(l.created_at).toLocaleString()}</p>
            </div>
          )) : <p className="text-sm text-slate-400 text-center py-8">No business cycles run yet.</p>}

          {status?.offers?.length > 0 && (
            <details className="bg-white rounded-lg border border-slate-200">
              <summary className="px-5 py-3 cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-900">Stored Offers ({status.offers.length})</summary>
              <div className="px-5 pb-4 border-t border-slate-100">
                {status.offers.map((o: any, i: number) => (
                  <p key={i} className="text-xs text-slate-700 py-1">{o.content?.offers?.map((of: any) => of.name).join(', ') || 'See brain'} <span className="text-[9px] text-slate-400">{new Date(o.created_at).toLocaleDateString()}</span></p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
