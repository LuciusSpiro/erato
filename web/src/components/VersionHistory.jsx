import { useState, useEffect, useCallback } from 'react'
import {
  Drawer, Box, Typography, IconButton, Tooltip, CircularProgress, Button, Avatar, Divider,
} from '@mui/material'
import { History, X, RotateCcw, ArrowLeft } from 'lucide-react'
import { useApi } from '../api'

const DRAWER_WIDTH = 420

// Datum lokalisiert (de-DE). Fällt bei ungültigem Wert sanft zurück.
function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('de-DE')
}

// Eine Version in der Liste. Klick öffnet die Vorschau.
function VersionRow({ version, onSelect }) {
  const initials = (version.editedBy ?? '–').slice(0, 2).toUpperCase()
  return (
    <Box
      onClick={() => onSelect(version)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 1.5, py: 1.25, borderRadius: 1.5, cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: 'primary.main' }}>{initials}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
          {version.title || 'Ohne Titel'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {version.editedBy ?? 'unbekannt'} · {fmtDate(version.editedAt)}
        </Typography>
      </Box>
    </Box>
  )
}

// Versionshistorie als Right-Drawer.
// pageId: aktuelle Seite | null
// onRestored(): Callback nach erfolgreichem Wiederherstellen (App lädt Seite neu)
export default function VersionHistory({ open, onClose, pageId, onRestored }) {
  const api = useApi()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(null) // { id, title, contentMd, editedAt } | null
  const [detailLoading, setDetailLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // Liste laden, sobald das Panel für eine Seite geöffnet wird.
  const loadVersions = useCallback(async () => {
    if (!pageId) return
    setLoading(true)
    setError(false)
    try {
      const list = await api.getVersions(pageId)
      setVersions(Array.isArray(list) ? list : [])
    } catch (err) {
      console.warn('Versionen nicht ladbar:', err.message)
      setError(true)
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [api, pageId])

  useEffect(() => {
    if (open && pageId) {
      setSelected(null)
      loadVersions()
    }
  }, [open, pageId, loadVersions])

  // Vorschau einer Version laden.
  const openVersion = useCallback(async (version) => {
    if (!pageId) return
    setDetailLoading(true)
    setSelected({ ...version, contentMd: null })
    try {
      const full = await api.getVersion(pageId, version.id)
      setSelected({ ...version, ...full })
    } catch (err) {
      console.warn('Version nicht ladbar:', err.message)
      setSelected({ ...version, contentMd: '', loadError: true })
    } finally {
      setDetailLoading(false)
    }
  }, [api, pageId])

  // Ausgewählte Version wiederherstellen.
  const restore = useCallback(async () => {
    if (!pageId || !selected) return
    setRestoring(true)
    try {
      await api.restoreVersion(pageId, selected.id)
      onRestored?.()
      onClose?.()
    } catch (err) {
      console.warn('Wiederherstellen fehlgeschlagen:', err.message)
    } finally {
      setRestoring(false)
    }
  }, [api, pageId, selected, onRestored, onClose])

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      slotProps={{ paper: { sx: { width: DRAWER_WIDTH, borderLeft: '1px solid', borderColor: 'divider' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
        {/* Kopf */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          {selected ? (
            <Tooltip title="Zurück zur Liste">
              <IconButton size="small" onClick={() => setSelected(null)}><ArrowLeft size={18} /></IconButton>
            </Tooltip>
          ) : (
            <History size={18} style={{ opacity: 0.7 }} />
          )}
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
            {selected ? 'Versionsvorschau' : 'Versionsverlauf'}
          </Typography>
          <Tooltip title="Schließen">
            <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
          </Tooltip>
        </Box>

        {/* Inhalt */}
        {!selected ? (
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            )}
            {!loading && error && (
              <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', px: 2, py: 4 }}>
                <Typography variant="body2">Versionsverlauf konnte nicht geladen werden.</Typography>
                <Button size="small" onClick={loadVersions} sx={{ mt: 1.5 }}>Erneut versuchen</Button>
              </Box>
            )}
            {!loading && !error && versions.length === 0 && (
              <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', px: 2, py: 4 }}>
                <History size={28} style={{ opacity: 0.4 }} />
                <Typography variant="body2" sx={{ mt: 1.5 }}>Noch keine früheren Versionen.</Typography>
              </Box>
            )}
            {!loading && !error && versions.map((v, i) => (
              <Box key={v.id ?? i}>
                <VersionRow version={v} onSelect={openVersion} />
                {i < versions.length - 1 && <Divider sx={{ mx: 1.5 }} />}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Meta + Aktion */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {selected.title || 'Ohne Titel'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {selected.editedBy ? `${selected.editedBy} · ` : ''}{fmtDate(selected.editedAt)}
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={restoring ? <CircularProgress size={14} color="inherit" /> : <RotateCcw size={15} />}
                  onClick={restore}
                  disabled={restoring || detailLoading}
                >
                  Wiederherstellen
                </Button>
              </Box>
            </Box>

            {/* Read-only Vorschau (Markdown als Monospace-Text) */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
              {detailLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : selected.loadError ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Inhalt dieser Version konnte nicht geladen werden.
                </Typography>
              ) : (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: 'text.primary',
                  }}
                >
                  {selected.contentMd || '(leer)'}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
