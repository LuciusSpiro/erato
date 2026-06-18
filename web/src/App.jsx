import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Box, IconButton, Tooltip, Button, Drawer, useMediaQuery,
  BottomNavigation, BottomNavigationAction,
} from '@mui/material'
import {
  Sun, Moon, Search as SearchIcon, LogIn, LogOut, Menu as MenuIcon,
  NotebookText, Sparkles, User,
} from 'lucide-react'
import { useAuth, LOCAL_MODE } from './authShim'
import { EratoThemeProvider, Tag } from '@erato/ui'
import { rolesFromUser } from './auth'
import { notebooks as mockNotebooks } from './mockData'
import { fetchBranding, DEFAULT_BRANDING } from './branding'
import { useApi, getCapabilities } from './api'
import { findPath, patchTitle, flattenPages } from './lib/tree'
import { saveBlob } from './lib/download'
import ImportDialog from './components/ImportDialog'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import SearchOverlay from './components/SearchOverlay'
import SettingsDialog from './components/SettingsDialog'
import AiPanel from './components/AiPanel'
import VersionHistory from './components/VersionHistory'
import MembersDialog from './components/MembersDialog'
import NewNotebookDialog from './components/NewNotebookDialog'
import ConfirmDialog from './components/ConfirmDialog'
import PreferencesDialog from './components/PreferencesDialog'
import AiSettingsDialog from './components/AiSettingsDialog'

export default function App() {
  const [mode, setMode] = useState('light')
  const isMobile = useMediaQuery('(max-width:900px)')
  const [navOpen, setNavOpen] = useState(false) // mobiler Sidebar-Drawer
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [membersNb, setMembersNb] = useState(null) // { id, title } | null
  const [newNbOpen, setNewNbOpen] = useState(false)
  const [deletePageId, setDeletePageId] = useState(null)
  const [deleteNb, setDeleteNb] = useState(null) // { id, title } | null
  const [jump, setJump] = useState(null) // { term, nonce } — Sprung zur Fundstelle nach Suche
  const jumpN = useRef(0)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importDefaultNb, setImportDefaultNb] = useState(null)
  const [indentSize, setIndentSize] = useState(() => Number(localStorage.getItem('erato:indent')) || 2)
  const changeIndent = useCallback((n) => {
    setIndentSize(n)
    try { localStorage.setItem('erato:indent', String(n)) } catch { /* ignore */ }
  }, [])
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  // Akzentfarbe aus der API (White-Label) bleibt erhalten: EratoThemeProvider akzeptiert primary.
  const brandPrimary = useMemo(() => branding.tokens?.primary?.[mode] ?? null, [branding, mode])
  const auth = useAuth()
  const api = useApi()
  const roles = rolesFromUser(auth.user)
  // Im local mode ist der einzige (lokale) Nutzer Admin → Branding/Theme editierbar.
  const isAdmin = LOCAL_MODE || roles.includes('admin')

  const [notebooks, setNotebooks] = useState([]) // [{ id, title, icon, pages: tree }]
  const [favorites, setFavorites] = useState([]) // [{ pageId, title, notebookTitle }]
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.pageId)), [favorites])
  const [treeLoading, setTreeLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [page, setPage] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)

  // Branding (Theme + Logo) zur Laufzeit aus der API laden.
  const reloadBranding = useCallback(() => fetchBranding().then(setBranding), [])
  useEffect(() => { reloadBranding() }, [reloadBranding])

  // Capabilities (z.B. AI-Verfügbarkeit). AI standardmäßig anzeigen, bis die API
  // explizit meldet, dass kein Ollama/Modell verfügbar ist.
  const [caps, setCaps] = useState(null)
  useEffect(() => { getCapabilities().then(setCaps).catch(() => {}) }, [])
  const aiEnabled = caps?.ai?.enabled !== false

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

  // Favoriten laden (pro Nutzer; bei fehlendem Login einfach leer).
  const loadFavorites = useCallback(async () => {
    try { setFavorites(await api.getFavorites() ?? []) }
    catch { setFavorites([]) }
  }, [api])
  useEffect(() => { loadFavorites() }, [loadFavorites])

  // Seite als Favorit umschalten.
  const toggleFavorite = useCallback(async (pageId) => {
    if (!pageId) return
    try {
      if (favoriteIds.has(pageId)) await api.removeFavorite(pageId)
      else await api.addFavorite(pageId)
      await loadFavorites()
    } catch (err) {
      console.warn('Favorit umschalten fehlgeschlagen:', err.message)
    }
  }, [api, favoriteIds, loadFavorites])

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

  // Flache Liste aller Seiten (für den „Link zu Seite"-Picker im Editor).
  const allPages = useMemo(() => flattenPages(notebooks), [notebooks])

  // Seite auswählen (schließt auf Mobile den Sidebar-Drawer).
  const selectPage = useCallback((id) => {
    setActiveId(id)
    setNavOpen(false)
  }, [])

  // Suchergebnis öffnen: Seite laden UND zur getroffenen Stelle springen.
  const openSearchResult = useCallback((pageId, term) => {
    setActiveId(pageId)
    setNavOpen(false)
    if (term) setJump({ term, nonce: ++jumpN.current })
  }, [])

  // Export-Helfer: Promise<{blob,filename}> → Download auslösen.
  const exportTo = useCallback(async (promise) => {
    try { const { blob, filename } = await promise; saveBlob(filename || 'export', blob) }
    catch (e) { console.warn('Export fehlgeschlagen:', e.message) }
  }, [])

  // Autosave-Ziel (PUT). Editor ruft das debounced.
  const savePage = useCallback((id, patch) => api.updatePage(id, patch), [api])

  // Nach Autosave: Titel im Baum aktualisieren (ohne kompletten Reload).
  const onLocalChange = useCallback((id, patch) => {
    if (patch.title === undefined) return
    setNotebooks((nbs) => nbs.map((nb) => ({ ...nb, pages: patchTitle(nb.pages, id, patch.title) })))
  }, [])

  // Neue Seite anlegen. Ohne explizites Notizbuch: ins AKTUELLE Notizbuch (der offenen
  // Seite), sonst ins erste vorhandene.
  const handleNewPage = useCallback(async (notebookId) => {
    const targetNb = notebookId ?? page?.notebookId ?? notebooks[0]?.id
    if (!targetNb) return
    try {
      const created = await api.createPage({ notebookId: targetNb, title: 'Neue Seite' })
      await loadNotebooks()
      if (created?.id) setActiveId(created.id)
    } catch (err) {
      console.warn('Seite anlegen fehlgeschlagen:', err.message)
    }
  }, [api, page, notebooks, loadNotebooks])

  // Neues Notizbuch: öffnet den Dialog; das eigentliche Anlegen erledigt createNotebook.
  const handleNewNotebook = useCallback(() => setNewNbOpen(true), [])
  const createNotebook = useCallback(async (title, icon) => {
    await api.createNotebook({ title, icon })
    await loadNotebooks()
  }, [api, loadNotebooks])

  // Löschen: öffnet das Bestätigungs-Modal; das eigentliche Löschen erledigt confirmDeletePage.
  const handleDeletePage = useCallback((id) => setDeletePageId(id), [])
  const confirmDeletePage = useCallback(async () => {
    const id = deletePageId
    setDeletePageId(null)
    if (!id) return
    try {
      await api.deletePage(id)
      if (activeId === id) setActiveId(null)
      await loadNotebooks()
    } catch (err) {
      console.warn('Seite löschen fehlgeschlagen:', err.message)
    }
  }, [api, activeId, deletePageId, loadNotebooks])

  // Notizbuch löschen: öffnet das Bestätigungs-Modal; das eigentliche Löschen erledigt confirmDeleteNotebook.
  const handleDeleteNotebook = useCallback((nb) => setDeleteNb(nb), [])
  const confirmDeleteNotebook = useCallback(async () => {
    const nb = deleteNb
    setDeleteNb(null)
    if (!nb) return
    try {
      await api.deleteNotebook(nb.id)
      // Aktive Seite zurücksetzen, falls sie in diesem Notizbuch lag.
      if (activeId && findPath(nb.pages, activeId)) setActiveId(null)
      await loadNotebooks()
      await loadFavorites?.()
    } catch (err) {
      console.warn('Notizbuch löschen fehlgeschlagen:', err.message)
    }
  }, [api, activeId, deleteNb, loadNotebooks, loadFavorites])

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

  const sidebarNode = (
    <Sidebar
      notebooks={notebooks}
      activeId={activeId}
      onSelect={selectPage}
      onOpenSearch={() => setSearchOpen(true)}
      onOpenAi={() => setAiOpen(true)}
      aiEnabled={aiEnabled}
      onNewPage={handleNewPage}
      onNewNotebook={handleNewNotebook}
      onAddChild={handleAddChild}
      onDeletePage={handleDeletePage}
      onOpenPreferences={() => setPrefsOpen(true)}
      loading={treeLoading}
      onReload={loadNotebooks}
      onMovePage={(pageId, opts) => api.movePage(pageId, opts)}
      onOpenMembers={(nb) => setMembersNb(nb)}
      favorites={favorites}
      favoriteIds={favoriteIds}
      onToggleFavorite={toggleFavorite}
      onExportPage={(id, sub) => exportTo(api.exportPage(id, sub))}
      onExportNotebook={(id) => exportTo(api.exportNotebook(id))}
      onExportNotebookErato={(id) => exportTo(api.exportNotebookErato(id))}
      onImport={(nb) => { setImportDefaultNb(nb?.id ?? null); setImportOpen(true) }}
      onDeleteNotebook={handleDeleteNotebook}
    />
  )

  return (
    <EratoThemeProvider mode={mode} primary={brandPrimary}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Kopfzeile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          {isMobile && (
            <IconButton size="small" onClick={() => setNavOpen(true)} sx={{ color: 'text.secondary' }}>
              <MenuIcon size={20} />
            </IconButton>
          )}
          {branding.logo?.[mode] ? (
            <Box component="img" src={branding.logo[mode]} alt="Logo" sx={{ height: 22 }} />
          ) : (
            <Box sx={{ fontWeight: 700, color: 'primary.main' }}>{branding.tokens?.appName ?? 'Erato'}</Box>
          )}
          <Box sx={{ flex: 1 }} />
          {!isMobile && (
            <Button size="small" variant="outlined" startIcon={<SearchIcon size={15} />} onClick={() => setSearchOpen(true)} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
              Suche
            </Button>
          )}
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
              {!LOCAL_MODE && (
                <Button size="small" variant="outlined" startIcon={<LogOut size={15} />} onClick={() => auth.signoutRedirect()} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
                  Logout
                </Button>
              )}
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

        {/* Inhalt (responsiv: Sidebar inline auf Desktop, als Drawer auf Mobile) */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {isMobile ? (
            <Drawer open={navOpen} onClose={() => setNavOpen(false)} slotProps={{ paper: { sx: { border: 0 } } }}>
              {sidebarNode}
            </Drawer>
          ) : (
            sidebarNode
          )}
          <Editor
            page={page}
            breadcrumb={breadcrumb}
            loading={pageLoading}
            onSave={savePage}
            onLocalChange={onLocalChange}
            onOpenHistory={() => setHistoryOpen(true)}
            pages={allPages}
            onOpenPage={selectPage}
            jump={jump}
            indentSize={indentSize}
          />
        </Box>

        {/* Untere Tab-Leiste (nur Mobile) */}
        {isMobile && (
          <BottomNavigation
            showLabels
            sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <BottomNavigationAction label="Suche" icon={<SearchIcon size={20} />} onClick={() => setSearchOpen(true)} />
            <BottomNavigationAction label="Notizen" icon={<NotebookText size={20} />} onClick={() => setNavOpen(true)} />
            {aiEnabled && <BottomNavigationAction label="AI" icon={<Sparkles size={20} />} onClick={() => setAiOpen(true)} />}
            <BottomNavigationAction label="Profil" icon={<User size={20} />} onClick={() => setPrefsOpen(true)} />
          </BottomNavigation>
        )}
      </Box>

      {aiEnabled && (
        <AiPanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onOpenPage={setActiveId}
          notebookId={page?.notebookId}
        />
      )}
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
      <NewNotebookDialog
        open={newNbOpen}
        onClose={() => setNewNbOpen(false)}
        onCreate={createNotebook}
      />
      <ConfirmDialog
        open={!!deletePageId}
        title="Seite löschen"
        message="Diese Seite und alle Unterseiten werden gelöscht. Das kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        danger
        onConfirm={confirmDeletePage}
        onClose={() => setDeletePageId(null)}
      />
      <ConfirmDialog
        open={!!deleteNb}
        title="Notizbuch löschen"
        message={`„${deleteNb?.title ?? ''}" und alle enthaltenen Seiten werden unwiderruflich gelöscht. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        danger
        onConfirm={confirmDeleteNotebook}
        onClose={() => setDeleteNb(null)}
      />
      <PreferencesDialog
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        indentSize={indentSize}
        onChangeIndent={changeIndent}
        isAdmin={isAdmin}
        onOpenBranding={() => { setPrefsOpen(false); setSettingsOpen(true) }}
        onOpenAiSettings={() => { setPrefsOpen(false); setAiSettingsOpen(true) }}
        onExportAll={() => exportTo(api.exportAll())}
        onExportAllErato={() => exportTo(api.exportAllErato())}
      />
      <AiSettingsDialog
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        api={api}
        onSaved={() => getCapabilities().then(setCaps).catch(() => {})}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        notebooks={notebooks}
        defaultNotebookId={importDefaultNb}
        api={api}
        onDone={loadNotebooks}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onOpenPage={openSearchResult} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} branding={branding} onSaved={reloadBranding} />
    </EratoThemeProvider>
  )
}
