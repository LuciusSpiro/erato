import { useState, useEffect, useRef, Fragment } from 'react'
import { Dialog, Box, Typography, Chip, CircularProgress } from '@mui/material'
import { Search, ChevronRight, CornerDownLeft } from 'lucide-react'
import { SearchField, EmptyState } from '@erato/ui'
import { useApi } from '../api'

// Rendert einen Snippet, in dem Treffer mit <<...>> markiert sind.
function Snippet({ text }) {
  if (!text) return null
  const parts = String(text).split(/(<<[^>]*>>)/g)
  return (
    <Typography variant="body2" color="text.secondary" noWrap>
      {parts.map((p, i) => {
        const m = p.match(/^<<(.*)>>$/)
        if (m) {
          return (
            <Box
              key={i}
              component="span"
              sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 600, borderRadius: 0.5, px: 0.3 }}
            >
              {m[1]}
            </Box>
          )
        }
        return <Fragment key={i}>{p}</Fragment>
      })}
    </Typography>
  )
}

const DEBOUNCE_MS = 250

export default function SearchOverlay({ open, onClose, onOpenPage }) {
  const api = useApi()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  // Beim Öffnen Zustand zurücksetzen.
  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setActive(0) }
  }, [open])

  // Debounced Suche.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q)
        setResults(Array.isArray(data) ? data : [])
        setActive(0)
      } catch (err) {
        console.warn('Suche fehlgeschlagen:', err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, api])

  // Getroffenen Begriff aus dem Snippet (<<…>>) ziehen, sonst die Suchanfrage.
  const termFromSnippet = (snip) => {
    const m = /<<([^>]+)>>/.exec(snip || '')
    return (m ? m[1] : '').trim() || query.trim()
  }
  const openResult = (r) => {
    if (r) { onOpenPage?.(r.pageId, termFromSnippet(r.snippet)); onClose?.() }
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); openResult(results[active]) }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider', position: 'fixed', top: 80, m: 0 } } }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <SearchField
          fullWidth
          autoFocus
          icon={<Search size={20} style={{ opacity: 0.6 }} />}
          placeholder="Suchen oder Seite öffnen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          endAdornment={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {loading && <CircularProgress size={16} />}
              <Chip label="esc" size="small" variant="outlined" sx={{ height: 22, fontSize: 11, color: 'text.secondary' }} />
            </Box>
          )}
          sx={{ border: 'none', borderRadius: 0, bgcolor: 'transparent', px: 0, py: 0, '&:focus-within': { borderColor: 'transparent' } }}
        />
      </Box>

      <Box sx={{ maxHeight: 360, overflowY: 'auto', py: 1 }}>
        {!loading && query.trim() && results.length === 0 && (
          <EmptyState
            icon={<Search size={22} />}
            title="Keine Treffer"
            description={`Für „${query}“ wurde nichts gefunden.`}
          />
        )}
        {results.map((r, i) => (
          <Box
            key={r.pageId ?? i}
            onMouseEnter={() => setActive(i)}
            onClick={() => openResult(r)}
            sx={{ px: 2, py: 1.25, mx: 1, borderRadius: 2, cursor: 'pointer', bgcolor: active === i ? 'action.hover' : 'transparent' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 0.25 }}>
              {(r.notebookPath ?? []).map((b, j) => (
                <Box key={j} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">{b}</Typography>
                  {j < r.notebookPath.length - 1 && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{r.title}</Typography>
              {active === i && (
                <Box sx={{ ml: 'auto', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CornerDownLeft size={13} /><Typography variant="caption">öffnen</Typography>
                </Box>
              )}
            </Box>
            <Snippet text={r.snippet} />
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, color: 'text.secondary' }}>
        <Typography variant="caption">↑↓ navigieren</Typography>
        <Typography variant="caption">↵ öffnen</Typography>
        <Typography variant="caption">esc schließen</Typography>
      </Box>
    </Dialog>
  )
}
