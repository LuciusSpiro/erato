import { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Button, IconButton, Stack, Alert, CircularProgress,
} from '@mui/material'
import { X, Upload, Palette } from 'lucide-react'
import { useApi } from '../api'

// Kleines Feld: Hex-Texteingabe + nativer Color-Picker, synchron gehalten.
function ColorField({ label, value, onChange }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="input"
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 38, height: 38, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, cursor: 'pointer', bgcolor: 'transparent' }}
        />
        <TextField
          size="small"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3B5BDB"
          sx={{ width: 130 }}
        />
      </Box>
    </Box>
  )
}

function LogoUpload({ label, mode, currentSrc, onPick, picked }) {
  const inputRef = useRef(null)
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: mode === 'dark' ? 'grey.900' : 'background.paper', overflow: 'hidden' }}>
          {picked ? (
            <Box component="img" src={picked} alt="Vorschau" sx={{ maxHeight: 28, maxWidth: 110 }} />
          ) : currentSrc ? (
            <Box component="img" src={currentSrc} alt="Logo" sx={{ maxHeight: 28, maxWidth: 110 }} />
          ) : (
            <Typography variant="caption" color="text.secondary">kein Logo</Typography>
          )}
        </Box>
        <Button size="small" variant="outlined" startIcon={<Upload size={14} />} onClick={() => inputRef.current?.click()} sx={{ borderColor: 'divider', color: 'text.primary' }}>
          Datei…
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f) }}
        />
      </Box>
    </Box>
  )
}

// branding: { tokens:{appName, primary:{light,dark}}, logo:{light,dark} }
// onSaved: Callback, der App-Branding neu lädt (Live-Vorschau).
export default function SettingsDialog({ open, onClose, branding, onSaved }) {
  const api = useApi()
  const [appName, setAppName] = useState('')
  const [light, setLight] = useState('#3B5BDB')
  const [dark, setDark] = useState('#748FFC')
  const [logoLight, setLogoLight] = useState(null) // File
  const [logoDark, setLogoDark] = useState(null)   // File
  const [previewLight, setPreviewLight] = useState(null)
  const [previewDark, setPreviewDark] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setAppName(branding?.tokens?.appName ?? 'Erato')
      setLight(branding?.tokens?.primary?.light ?? '#3B5BDB')
      setDark(branding?.tokens?.primary?.dark ?? '#748FFC')
      setLogoLight(null); setLogoDark(null)
      setPreviewLight(null); setPreviewDark(null)
      setError(null)
    }
  }, [open, branding])

  const pickLogo = (which, file) => {
    const url = URL.createObjectURL(file)
    if (which === 'light') { setLogoLight(file); setPreviewLight(url) }
    else { setLogoDark(file); setPreviewDark(url) }
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      // Erst Logos hochladen (falls gewählt), dann Tokens speichern.
      if (logoLight) await api.uploadBrandingLogo(logoLight, 'light')
      if (logoDark) await api.uploadBrandingLogo(logoDark, 'dark')
      await api.putBranding({ appName, primary: { light, dark } })
      // Live-Vorschau: Branding in App neu laden -> Theme + Logo aktualisieren.
      await onSaved?.()
      onClose?.()
    } catch (err) {
      console.warn('Branding speichern fehlgeschlagen:', err.message)
      setError(`Speichern fehlgeschlagen: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Palette size={18} />
        <Box sx={{ flex: 1 }}>Branding & Theme</Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="App-Name"
            size="small"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            fullWidth
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Akzentfarbe</Typography>
            <Stack direction="row" spacing={3}>
              <ColorField label="Hell (light)" value={light} onChange={setLight} />
              <ColorField label="Dunkel (dark)" value={dark} onChange={setDark} />
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Logo</Typography>
            <Stack spacing={2}>
              <LogoUpload label="Logo hell" mode="light" currentSrc={branding?.logo?.light} picked={previewLight} onPick={(f) => pickLogo('light', f)} />
              <LogoUpload label="Logo dunkel" mode="dark" currentSrc={branding?.logo?.dark} picked={previewDark} onPick={(f) => pickLogo('dark', f)} />
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Abbrechen</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={15} color="inherit" /> : null}
        >
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  )
}
