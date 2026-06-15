// Datenschicht für erato-api.
// Basis-URL aus VITE_API_URL, sonst lokaler Default.
// Alle Notiz-Routen brauchen einen Bearer-Token (aus react-oidc-context).
// Token kommt vom Aufrufer; kein globaler State. Der Hook useApi() unten
// kapselt useAuth() und liefert alle Funktionen mit gebundenem Token.

import { useMemo } from 'react'
import { useAuth } from 'react-oidc-context'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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

// ---- Notizbücher ----
export const getNotebooks = (token) =>
  request('/v1/notebooks', { token })

export const createNotebook = (token, { title, icon } = {}) =>
  request('/v1/notebooks', { token, method: 'POST', body: { title, icon } })

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
    aiChat: (question, notebookId) => aiChat(token, question, notebookId),
    getBranding: (app) => getBranding(app),
    putBranding: (tokens, app) => putBranding(token, tokens, app),
    uploadBrandingLogo: (file, mode, app) => uploadBrandingLogo(token, file, mode, app),
  }), [token])
}
