import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import { NB_ICON_MAP, NB_ICON_NAMES } from '../notebookIcons'

// Modal zum Anlegen eines Notizbuchs (Name + Icon-Auswahl). Ersetzt window.prompt.
export default function NewNotebookDialog({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('NotebookText')
  const [busy, setBusy] = useState(false)

  // Beim Öffnen zurücksetzen.
  useEffect(() => {
    if (open) { setTitle(''); setIcon('NotebookText'); setBusy(false) }
  }, [open])

  const canCreate = title.trim().length > 0 && !busy

  const submit = async () => {
    if (!canCreate) return
    setBusy(true)
    try {
      await onCreate?.(title.trim(), icon)
      onClose?.()
    } catch (err) {
      console.warn('Notizbuch anlegen fehlgeschlagen:', err.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>Neues Notizbuch</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          autoFocus
          label="Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          fullWidth
          variant="outlined"
          size="small"
          sx={{ mt: 1 }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Icon</Typography>
          <ToggleButtonGroup
            value={icon}
            exclusive
            onChange={(e, v) => v && setIcon(v)}
            sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', width: 40, height: 40 } }}
          >
            {NB_ICON_NAMES.map((name) => {
              const Comp = NB_ICON_MAP[name]
              return (
                <ToggleButton key={name} value={name} aria-label={name}>
                  <Comp size={18} />
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Abbrechen</Button>
        <Button onClick={submit} variant="contained" disabled={!canCreate}>Anlegen</Button>
      </DialogActions>
    </Dialog>
  )
}
