// Datenschicht für erato-api.
// Basis-URL aus VITE_API_URL, sonst lokaler Default.
// Alle Notiz-Routen brauchen einen Bearer-Token (aus react-oidc-context).
// Token kommt vom Aufrufer; kein globaler State. Der Hook useApi() unten
// kapselt useAuth() und liefert alle Funktionen mit gebundenem Token.

import { useMemo } from 'react'
import { useAuth } from './authShim'

// API-Basis: im local mode injiziert Electron den Port über window.__ERATO__;
// sonst VITE_API_URL bzw. lokaler Dev-Default.
export const API_BASE =
  (typeof window !== 'undefined' && window.__ERATO__?.apiBase) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001'

// Interner fetch-Wrapper: setzt Bearer-Header (falls Token vorhanden),
// JSON-Content-Type bei Body, und wirft bei Nicht-OK-Antworten.
async function request(path, { token, method = 'GET', body, headers, raw } = {}) {
  const finalHeaders = { ...(headers ?? {}) }
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let payload = body
  // Bei FormData den Content-Type NICHT setzen (Browser setzt boundary selbst).
  if (body != null && !raw && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers: finalHeaders, body: payload })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} bei ${method} ${path}`)
    err.status = res.status
    throw err
  }
  // 204 / leere Antworten abfangen.
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ---- Capabilities (öffentlich; steuert u.a. Sichtbarkeit der AI-Features) ----
export const getCapabilities = () => request('/v1/capabilities', {})

// ---- AI-Einstellungen (Admin): Ollama-URL + Modelle ----
export const getAiSettings = (token) => request('/v1/settings/ai', { token })
export const putAiSettings = (token, body) =>
  request('/v1/settings/ai', { token, method: 'PUT', body })
export const getAiModels = (token, url) =>
  request(`/v1/ai/models${url ? `?url=${encodeURIComponent(url)}` : ''}`, { token })

// ---- Notizbücher ----
export const getNotebooks = (token) =>
  request('/v1/notebooks', { token })

export const createNotebook = (token, { title, icon } = {}) =>
  request('/v1/notebooks', { token, method: 'POST', body: { title, icon } })

export const deleteNotebook = (token, id) =>
  request(`/v1/notebooks/${id}`, { token, method: 'DELETE' })

// ---- Seitenbaum eines Notizbuchs ----
export const getPageTree = (token, notebookId) =>
  request(`/v1/notebooks/${notebookId}/pages`, { token })

// ---- Seiten ----
export const getPage = (token, pageId) =>
  request(`/v1/pages/${pageId}`, { token })

export const createPage = (token, { notebookId, parentId, title } = {}) =>
  request('/v1/pages', { token, method: 'POST', body: { notebookId, parentId, title } })

export const updatePage = (token, pageId, { title, contentMd } = {}) => {
  const body = {}
  if (title !== undefined) body.title = title
  if (contentMd !== undefined) body.contentMd = contentMd
  return request(`/v1/pages/${pageId}`, { token, method: 'PUT', body })
}

export const deletePage = (token, pageId) =>
  request(`/v1/pages/${pageId}`, { token, method: 'DELETE' })

export const movePage = (token, pageId, { parentId, position }) =>
  request(`/v1/pages/${pageId}/move`, { token, method: 'POST', body: { parentId, position } })

// ---- Mitglieder / Rollen pro Notizbuch ----
// GET /v1/notebooks/:id/members → [{ userSub, userName, role }]
export const getMembers = (token, notebookId) =>
  request(`/v1/notebooks/${notebookId}/members`, { token })

// PUT /v1/notebooks/:id/members body { userName, role } → { ok }
// role: 'owner' | 'editor' | 'viewer'
export const putMember = (token, notebookId, { userName, role }) =>
  request(`/v1/notebooks/${notebookId}/members`, { token, method: 'PUT', body: { userName, role } })

// DELETE /v1/notebooks/:id/members/:userSub → { ok }
export const deleteMember = (token, notebookId, userSub) =>
  request(`/v1/notebooks/${notebookId}/members/${userSub}`, { token, method: 'DELETE' })

// ---- Versionshistorie ----
// GET /v1/pages/:id/versions → [{ id, title, editedBy, editedAt }] (neueste zuerst)
export const getVersions = (token, pageId) =>
  request(`/v1/pages/${pageId}/versions`, { token })

// GET /v1/pages/:id/versions/:versionId → { id, title, contentMd, editedAt }
export const getVersion = (token, pageId, versionId) =>
  request(`/v1/pages/${pageId}/versions/${versionId}`, { token })

// POST /v1/pages/:id/versions/:versionId/restore → { ok, updatedAt }
export const restoreVersion = (token, pageId, versionId) =>
  request(`/v1/pages/${pageId}/versions/${versionId}/restore`, { token, method: 'POST' })

// Interner Helfer: GET als Blob (für Datei-Downloads) + Dateiname aus Content-Disposition.
async function requestBlob(path, token) {
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${path}`)
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const m = /filename="?([^"]+)"?/.exec(cd)
  return { blob, filename: m ? m[1] : null }
}

// ---- Export (liefern { blob, filename }) ----
export const exportPage = (token, pageId, withSubpages) =>
  requestBlob(`/v1/pages/${pageId}/export${withSubpages ? '?subpages=1' : ''}`, token)
export const exportNotebook = (token, nbId) => requestBlob(`/v1/notebooks/${nbId}/export`, token)
export const exportAll = (token) => requestBlob('/v1/export', token)
export const exportNotebookErato = (token, nbId) => requestBlob(`/v1/notebooks/${nbId}/export/erato`, token)
export const exportAllErato = (token) => requestBlob('/v1/export/erato', token)

// ---- Import ----
export const importFile = (token, notebookId, parentId, file) => {
  const fd = new FormData(); fd.append('file', file)
  const qs = new URLSearchParams({ notebookId }); if (parentId) qs.set('parentId', parentId)
  return request(`/v1/import?${qs.toString()}`, { token, method: 'POST', body: fd })
}
export const importErato = (token, file) => {
  const fd = new FormData(); fd.append('file', file)
  return request('/v1/import/erato', { token, method: 'POST', body: fd })
}

// ---- Favoriten ----
export const getFavorites = (token) => request('/v1/favorites', { token })
export const addFavorite = (token, pageId) => request('/v1/favorites', { token, method: 'POST', body: { pageId } })
export const removeFavorite = (token, pageId) => request(`/v1/favorites/${pageId}`, { token, method: 'DELETE' })

// ---- Suche ----
export const search = (token, q) =>
  request(`/v1/search?q=${encodeURIComponent(q)}`, { token })

// ---- AI / RAG-Chat ----
// POST /v1/ai/chat → { answer, sources: [{ pageId, title, notebookPath:[...] }] }.
// Backend liefert 503, wenn die AI gerade nicht verfügbar ist (sauber abfangen).
export const aiChat = (token, question, notebookId) =>
  request('/v1/ai/chat', {
    token,
    method: 'POST',
    body: notebookId != null ? { question, notebookId } : { question },
  })

// ---- Branding ----
export const getBranding = (app = 'erato') =>
  request(`/v1/branding?app=${app}`)

export const putBranding = (token, tokens, app = 'erato') =>
  request(`/v1/branding?app=${app}`, { token, method: 'PUT', body: { tokens } })

export const uploadBrandingLogo = (token, file, mode = 'light', app = 'erato') => {
  const form = new FormData()
  form.append('file', file)
  return request(`/v1/branding/logo?app=${app}&mode=${mode}`, {
    token, method: 'POST', body: form,
  })
}

// Hook: kapselt useAuth() und bindet den aktuellen Access-Token an alle Funktionen.
// Komponenten rufen z.B. api.getNotebooks() ohne Token-Handling.
export function useApi() {
  const auth = useAuth()
  const token = auth.user?.access_token ?? null

  return useMemo(() => ({
    token,
    isAuthenticated: !!token,
    getNotebooks: () => getNotebooks(token),
    createNotebook: (data) => createNotebook(token, data),
    deleteNotebook: (id) => deleteNotebook(token, id),
    getPageTree: (notebookId) => getPageTree(token, notebookId),
    getPage: (pageId) => getPage(token, pageId),
    createPage: (data) => createPage(token, data),
    updatePage: (pageId, data) => updatePage(token, pageId, data),
    deletePage: (pageId) => deletePage(token, pageId),
    movePage: (pageId, data) => movePage(token, pageId, data),
    getMembers: (notebookId) => getMembers(token, notebookId),
    putMember: (notebookId, data) => putMember(token, notebookId, data),
    deleteMember: (notebookId, userSub) => deleteMember(token, notebookId, userSub),
    getVersions: (pageId) => getVersions(token, pageId),
    getVersion: (pageId, versionId) => getVersion(token, pageId, versionId),
    restoreVersion: (pageId, versionId) => restoreVersion(token, pageId, versionId),
    search: (q) => search(token, q),
    getFavorites: () => getFavorites(token),
    addFavorite: (pageId) => addFavorite(token, pageId),
    removeFavorite: (pageId) => removeFavorite(token, pageId),
    exportPage: (pageId, withSubpages) => exportPage(token, pageId, withSubpages),
    exportNotebook: (nbId) => exportNotebook(token, nbId),
    exportAll: () => exportAll(token),
    exportNotebookErato: (nbId) => exportNotebookErato(token, nbId),
    exportAllErato: () => exportAllErato(token),
    importFile: (notebookId, parentId, file) => importFile(token, notebookId, parentId, file),
    importErato: (file) => importErato(token, file),
    aiChat: (question, notebookId) => aiChat(token, question, notebookId),
    getAiSettings: () => getAiSettings(token),
    putAiSettings: (body) => putAiSettings(token, body),
    getAiModels: (url) => getAiModels(token, url),
    getBranding: (app) => getBranding(app),
    putBranding: (tokens, app) => putBranding(token, tokens, app),
    uploadBrandingLogo: (file, mode, app) => uploadBrandingLogo(token, file, mode, app),
  }), [token])
}
