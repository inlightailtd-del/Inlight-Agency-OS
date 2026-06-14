'use client'

import { useState, useEffect, useCallback } from 'react'

interface FacebookPage {
  id: string
  name: string
  picture?: { data?: { url?: string } }
  category?: string
  access_token?: string
}

interface Props {
  connection: any | null
  onPageSelected?: () => void
}

export default function FacebookPageSelector({ connection, onPageSelected }: Props) {
  const [pages, setPages] = useState<FacebookPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    connection?.config?.selectedPageId || null
  )
  const [selectedPageName, setSelectedPageName] = useState<string | null>(
    connection?.config?.selectedPageName || null
  )
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<string | null>(null)

  const selectedPageToken =
    connection?.config?.selectedPageToken ||
    connection?.integration_credentials?.credentials?.page_access_token

  const fetchPages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/facebook/pages')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPages(data.pages || [])
      if (data.pages.length === 0) setError('No Facebook pages found. Create a Facebook page first.')
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (pages.length === 0 && !loading && !error) fetchPages()
  }, [fetchPages, pages.length, loading, error])

  const handleSelect = async (page: FacebookPage) => {
    setSelectedPageId(page.id)
    setSelectedPageName(page.name)
    setPublishResult(null)
    try {
      const res = await fetch('/api/integrations/facebook/select-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onPageSelected?.()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handlePublishTest = async () => {
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch('/api/integrations/facebook/publish-test', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPublishResult(`✅ Published! Post ID: ${data.postId}`)
    } catch (e: any) {
      setPublishResult(`❌ ${e.message}`)
    }
    setPublishing(false)
  }

  if (!connection) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Facebook Page Selection
        </h2>
      </div>
      <div className="p-4">
        {selectedPageName && (
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
            Connected to page: <strong>{selectedPageName}</strong>
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading pages...</p>
        ) : pages.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pages.map((page) => {
              const isSelected = selectedPageId === page.id
              return (
                <button
                  key={page.id}
                  onClick={() => handleSelect(page)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    {page.picture?.data?.url ? (
                      <img src={page.picture.data.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        {page.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{page.name}</p>
                    {page.category && (
                      <p className="text-[10px] text-slate-400 truncate">{page.category}</p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-emerald-600 text-lg">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : !error ? (
          <p className="text-sm text-slate-500">
            {selectedPageName
              ? 'Page connected. You can publish a test post below.'
              : 'Click refresh to load your Facebook pages.'}
          </p>
        ) : null}

        {/* Refresh + Test Publish */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={fetchPages}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Pages'}
          </button>
          {selectedPageId && selectedPageToken && (
            <button
              onClick={handlePublishTest}
              disabled={publishing}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {publishing ? 'Publishing...' : 'Publish Test Post'}
            </button>
          )}
        </div>

        {publishResult && (
          <p className="mt-3 text-xs text-slate-600">{publishResult}</p>
        )}
      </div>
    </div>
  )
}
