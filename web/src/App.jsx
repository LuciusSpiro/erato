import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, ToggleButtonGroup, ToggleButton,
  IconButton, Tooltip, Button,
} from '@mui/material'
import { Sun, Moon, Search as SearchIcon, LogIn, LogOut, Settings } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { EratoThemeProvider, Tag } from '@erato/ui'
import { rolesFromUser } from './auth'
import { notebooks as mockNotebooks } from './mockData'
import { fetchBranding, DEFAULT_BRANDING } from './branding'
import { useApi } from './api'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import SearchOverlay from './components/SearchOverlay'
import SettingsDialog from './components/SettingsDialog'
import AiPanel from './components/AiPanel'
import MobileView from './components/MobileView'
import VersionHistory from './components/VersionHistory'
import MembersDialog from './components/MembersDialog'

// Sucht eine Seite (und ihren Pfad) im Baum eines Notizbuchs.
function findPath(pages, id, trail = []) {
  for (const p of pages ?? []) {
    const here = [...trail, p.title]
    if (p.id === id) return here
    const deeper = findPath(p.children, id, here)
    if (deeper) return deeper
  }
  return null
}

// Aktualisiert den Titel einer Seite im Baum (für Autosave-Sync der Sidebar).
function patchTitle(pages, id, title) {
  return (pages ?? []).map((p) =>
    p.id === id
      ? { ...p, title, children: patchTitle(p.children, id, title) }
      : { ...p, children: patchTitle(p.children, id, title) },
  )
}

export default function App() {
  const [mode, setMode] = useState('light')
  const [view, setView] = useState('desktop')
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [membersNb, setMembersNb] = useState(null) // { id, title } | null
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  // Akzentfarbe aus der API (White-Label) bleibt erhalten: EratoThemeProvider akzeptiert primary.
  const brandPrimary = useMemo(() => branding.tokens?.primary?.[mode] ?? null, [branding, mode])
  const auth = useAuth()
  const api = useApi()
  const roles = rolesFromUser(auth.user)
  const isAdmin = roles.includes('admin')

  const [notebooks, setNotebooks] = useState([]) // [{ id, title, icon, pages: tree }]
  const [treeLoading, setTreeLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [page, setPage] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)

  // Branding (Theme + Logo) zur Laufzeit aus der API laden.
  const reloadBranding = useCallback(() => fetchBranding().then(setBranding), [])
  useEffect(() => { reloadBranding() }, [reloadBranding])

  // Notizbücher + Seitenbäume laden. Fällt sanft auf mockData zurück.
  const loadNotebooks = useCallback(async () => {
    setTreeLoading(true)
    try {
      const nbs = await api.getNotebooks()
      const withTrees = await Promise.all(
        (nbs ?? []).map(async (nb) => {
          try {
            const pages = await api.getPageTree(nb.id)
            return { ...nb, pages: pages ?? [] }
          } catch {
            return { ...nb, pages: [] }
          }
        }),
      )
      setNotebooks(withTrees)
      return withTrees
    } catch (err) {
      console.warn('Notizbücher nicht erreichbar, nutze mockData:', err.message)
      setNotebooks(mockNotebooks)
      return mockNotebooks
    } finally {
      setTreeLoading(false)
    }
  }, [api])

  useEffect(() => { loadNotebooks() }, [loadNotebooks])

  // Seite laden, wenn activeId wechselt.
  useEffect(() => {
    if (!activeId) { setPage(null); return }
    let cancelled = false
    setPageLoading(true)
    api.getPage(activeId)
      .then((p) => { if (!cancelled) setPage(p) })
      .catch((err) => {
        console.warn('Seite nicht ladbar:', err.message)
        if (!cancelled) setPage(null)
      })
      .finally(() => { if (!cancelled) setPageLoading(false) })
    return () => { cancelled = true }
  }, [activeId, api])

  // Aktive Seite neu vom Server laden (z.B. nach Wiederherstellen einer Version).
  // Der Editor übernimmt den neuen contentMd, da sein Effekt an page.id hängt
  // und page durch ein frisches Objekt ersetzt wird.
  const reloadPage = useCallback(async () => {
    if (!activeId) return
    setPageLoading(true)
    try {
      const p = await api.getPage(activeId)
      setPage(p)
    } catch (err) {
      console.warn('Seite nicht neu ladbar:', err.message)
    } finally {
      setPageLoading(false)
    }
  }, [api, activeId])

  // Breadcrumb aus Notizbuch-Titel + Seitenpfad.
  const breadcrumb = useMemo(() => {
    const nbId = page?.notebookId
    const nb = notebooks.find((n) => n.id === nbId)
    if (!nb) return page ? [page.title] : []
    const path = findPath(nb.pages, page.id)
    return [nb.title, ...(path ?? [page.title])]
  }, [page, notebooks])

  // Autosave-Ziel (PUT). Editor ruft das debounced.
  const savePage = useCallback((id, patch) => api.updatePage(id, patch), [api])

  // Nach Autosave: Titel im Baum aktualisieren (ohne kompletten Reload).
  const onLocalChange = useCallback((id, patch) => {
    if (patch.title === undefined) return
    setNotebooks((nbs) => nbs.map((nb) => ({ ...nb, pages: patchTitle(nb.pages, id, patch.title) })))
  }, [])

  // Neue Seite anlegen (oben oder pro Notizbuch).
  const handleNewPage = useCallback(async (notebookId) => {
    const targetNb = notebookId ?? notebooks[0]?.id
    if (!targetNb) return
    try {
      const created = await api.createPage({ notebookId: targetNb, title: 'Neue Seite' })
      await loadNotebooks()
      if (created?.id) setActiveId(created.id)
    } catch (err) {
      console.warn('Seite anlegen fehlgeschlagen:', err.message)
    }
  }, [api, notebooks, loadNotebooks])

  // Neues Notizbuch anlegen.
  const handleNewNotebook = useCallback(async () => {
    const title = window.prompt('Name des Notizbuchs:', 'Neues Notizbuch')
    if (!title) return
    try {
      await api.createNotebook({ title })
      await loadNotebooks()
    } catch (err) {
      console.warn('Notizbuch anlegen fehlgeschlagen:', err.message)
    }
  }, [api, loadNotebooks])

  // Seite (inkl. Unterseiten) löschen.
  const handleDeletePage = useCallback(async (id) => {
    if (!window.confirm('Diese Seite und alle Unterseiten löschen?')) return
    try {
      await api.deletePage(id)
      if (activeId === id) setActiveId(null)
      await loadNotebooks()
    } catch (err) {
      console.warn('Seite löschen fehlgeschlagen:', err.message)
    }
  }, [api, activeId, loadNotebooks])

  // Unterseite anlegen.
  const handleAddChild = useCallback(async (parentId) => {
    const nb = notebooks.find((n) => findPath(n.pages, parentId))
    if (!nb) return
    try {
      const created = await api.createPage({ notebookId: nb.id, parentId, title: 'Neue Seite' })
      await loadNotebooks()
      if (created?.id) setActiveId(created.id)
    } catch (err) {
      console.warn('Unterseite anlegen fehlgeschlagen:', err.message)
    }
  }, [api, notebooks, loadNotebooks])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <EratoThemeProvider mode={mode} primary={brandPrimary}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Dev-Leiste (nur fürs Mockup, nicht Teil des Produkts) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          {branding.logo?.[mode] ? (
            <Box component="img" src={branding.logo[mode]} alt="Logo" sx={{ height: 22 }} />
          ) : (
            <Box sx={{ fontWeight: 700, color: 'primary.main' }}>{branding.tokens?.appName ?? 'Erato'}</Box>
          )}
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Branding via API</Box>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" startIcon={<SearchIcon size={15} />} onClick={() => setSearchOpen(true)} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
            Suche · ⌘K
          </Button>
          {isAdmin && (
            <Button size="small" variant="outlined" startIcon={<Settings size={15} />} onClick={() => setSettingsOpen(true)} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
              Branding
            </Button>
          )}
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(e, v) => v && setView(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.3 } }}>
            <ToggleButton value="desktop">Desktop</ToggleButton>
            <ToggleButton value="mobile">Mobile</ToggleButton>
          </ToggleButtonGroup>
          {auth.isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                {auth.user?.profile?.preferred_username}
                {isAdmin && (
                  <Box component="span" sx={{ ml: 0.75 }}>
                    <Tag label="admin" color="primary" sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }} />
                  </Box>
                )}
              </Box>
              <Button size="small" variant="outlined" startIcon={<LogOut size={15} />} onClick={() => auth.signoutRedirect()} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
                Logout
              </Button>
            </Box>
          ) : (
            <Button size="small" variant="contained" startIcon={<LogIn size={15} />} onClick={() => auth.signinRedirect()}>
              Login
            </Button>
          )}
          <Tooltip title={mode === 'light' ? 'Dark Mode' : 'Light Mode'}>
            <IconButton size="small" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
              {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Inhalt */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {view === 'desktop' ? (
            <Box sx={{ display: 'flex', height: '100%' }}>
              <Sidebar
                notebooks={notebooks}
                activeId={activeId}
                onSelect={setActiveId}
                onOpenSearch={() => setSearchOpen(true)}
                onOpenAi={() => setAiOpen(true)}
                onNewPage={handleNewPage}
                onNewNotebook={handleNewNotebook}
                onAddChild={handleAddChild}
                onDeletePage={handleDeletePage}
                onOpenSettings={() => setSettingsOpen(true)}
                showSettings={isAdmin}
                loading={treeLoading}
                onReload={loadNotebooks}
                onMovePage={(pageId, opts) => api.movePage(pageId, opts)}
                onOpenMembers={(nb) => setMembersNb(nb)}
              />
              <Editor
                page={page}
                breadcrumb={breadcrumb}
                loading={pageLoading}
                onSave={savePage}
                onLocalChange={onLocalChange}
                onOpenHistory={() => setHistoryOpen(true)}
              />
            </Box>
          ) : (
            <Box sx={{ height: '100%', overflowY: 'auto' }}>
              <MobileView
                notebooks={notebooks}
                page={page}
                activeId={activeId}
                onSelect={setActiveId}
                loading={treeLoading || pageLoading}
              />
            </Box>
          )}
        </Box>
      </Box>

      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onOpenPage={setActiveId}
        notebookId={page?.notebookId}
      />
      <VersionHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        pageId={activeId}
        onRestored={reloadPage}
      />
      <MembersDialog
        open={!!membersNb}
        onClose={() => setMembersNb(null)}
        notebook={membersNb}
        api={api}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onOpenPage={setActiveId} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} branding={branding} onSaved={reloadBranding} />
    </EratoThemeProvider>
  )
}
