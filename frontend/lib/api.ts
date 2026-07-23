const BASE = 'http://localhost:8000'

async function req(path: string, options?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, options)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export const api = {
  // Settings
  getSettings: () => req('/settings'),
  saveSettings: (data: object) =>
    req('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  testConnection: () => req('/settings/test', { method: 'POST' }),

  // Bulk upload
  bulkScan: (folderPath: string, skuPrefix?: string, skuStart?: number, forceSku?: boolean) =>
    req('/bulk-upload/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path: folderPath, sku_prefix: skuPrefix, sku_start: skuStart ?? 1, force_sku: forceSku ?? false }),
    }),
  bulkStart: (sessionId: string) =>
    req('/bulk-upload/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }),
  bulkStatus: (sessionId: string) => req(`/bulk-upload/status/${sessionId}`),
  bulkCancel: (sessionId: string) =>
    req(`/bulk-upload/cancel/${sessionId}`, { method: 'POST' }),
  bulkRetry: (sessionId: string) =>
    req(`/bulk-upload/retry/${sessionId}`, { method: 'POST' }),
  bulkIncomplete: () => req('/bulk-upload/incomplete'),
  bulkResume: (sessionId: string) =>
    req(`/bulk-upload/resume/${sessionId}`, { method: 'POST' }),
  bulkRemoveProduct: (sessionId: string, index: number) =>
    req(`/bulk-upload/${sessionId}/product/${index}`, { method: 'DELETE' }),
  bulkBrowseFolder: () => req('/bulk-upload/browse-folder'),
  bulkImageUrl: (sessionId: string, path: string) =>
    `${BASE}/bulk-upload/image?session_id=${sessionId}&path=${encodeURIComponent(path)}`,
}
