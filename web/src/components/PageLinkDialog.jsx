import { useState, useEffect, useMemo } from 'react'
import {
  Dialog, Box, InputBase, List, ListItemButton, ListItemText, Typography, Chip,
} from '@mui/material'
import { Search, FileText } from 'lucide-react'

// Dialog zum Auswählen einer Seite, auf die verlinkt werden soll.
// pages: [{ id, title, notebookTitle }]; onPick(page) fügt den Link ein.
export default function PageLinkDialog({ open, pages = [], onPick, onClose }) {
  const [q, setQ] = useState('')
  useEffect(() => { if (open) setQ('') }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return pages.slice(0, 50)
    return pages.filter((p) =>
      (p.title || '').toLowerCase().includes(s) || (p.notebookTitle || '').toLowerCase().includes(s),
    ).slice(0, 50)
  }, [q, pages])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider', position: 'fixed', top: 90, m: 0 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Search size={20} style={{ opacity: 0.6 }} />
        <InputBase
          autoFocus
          placeholder="Seite zum Verlinken suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, fontSize: 16 }}
        />
      </Box>
      <List dense sx={{ maxHeight: 360, overflowY: 'auto', py: 1 }}>
        {filtered.length === 0 && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Keine Seite gefunden.</Typography>
          </Box>
        )}
        {filtered.map((p) => (
          <ListItemButton key={p.id} onClick={() => onPick?.(p)} sx={{ mx: 1, borderRadius: 1.5 }}>
            <FileText size={16} style={{ opacity: 0.6, marginRight: 10, flexShrink: 0 }} />
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{p.title || 'Ohne Titel'}</Typography>}
            />
            {p.notebookTitle && (
              <Chip label={p.notebookTitle} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, color: 'text.secondary' }} />
            )}
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  )
}
