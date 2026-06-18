import { useState, useEffect, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, Autocomplete, Alert, CircularProgress, Divider,
} from '@mui/material'
import { RefreshCw } from 'lucide-react'

// Admin-Dialog: Ollama-URL + Chat-/Embed-Modell konfigurieren (überstimmt die
// Env-Defaults, sofort wirksam). Modelle werden aus der laufenden Ollama-Instanz
// geladen (frei eingebbar, falls nicht installiert/erreichbar).
export default function AiSettingsDialog({ open, onClose, api, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [ollamaUrl, setOllamaUrl] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [embedModel, setEmbedModel] = useState('')
  const [initialEmbed, setInitialEmbed] = useState('')
  const [defaults, setDefaults] = useState(null)
  const [models, setModels] = useState([])
  const [reachable, setReachable] = useState(null)

  const loadModels = useCallback(async (url) => {
    try {
      const res = await api.getAiModels(url)
      setModels(res.models ?? [])
      setReachable(res.reachable)
    } catch {
      setModels([]); setReachable(false)
    }
  }, [api])

  useEffect(() => {
    if (!open) return
    setError(null); setNotice(null); setLoading(true)
    ;(async () => {
      try {
        const s = await api.getAiSettings()
        setOllamaUrl(s.ollamaUrl || '')
        setChatModel(s.chatModel || '')
        setEmbedModel(s.embedModel || '')
        setInitialEmbed(s.embedModel || '')
        setDefaults(s.defaults || null)
        await loadModels(s.ollamaUrl || '')
      } catch (e) {
        setError(e.message || 'Konnte Einstellungen nicht laden')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, api, loadModels])

  const embedChanged = embedModel.trim() !== initialEmbed.trim()

  const save = async () => {
    setSaving(true); setError(null); setNotice(null)
    try {
      const res = await api.putAiSettings({
        ollamaUrl: ollamaUrl.trim(),
        chatModel: chatModel.trim(),
        embedModel: embedModel.trim(),
      })
      const re = res.reindex
      setNotice(
        re === 'dimension-changed'
          ? 'Gespeichert. Embed-Modell mit anderer Vektorgröße — die Suche wird im Hintergrund neu indexiert.'
          : re === 'model-changed'
            ? 'Gespeichert. Embeddings werden im Hintergrund neu berechnet.'
            : 'Gespeichert.',
      )
      setInitialEmbed(embedModel.trim())
      await onSaved?.()
    } catch (e) {
      setError(
        e.status === 400
          ? 'Embed-Modell ist nicht erreichbar/installiert. Bitte zuerst in Ollama bereitstellen (ollama pull …).'
          : (e.message || 'Speichern fehlgeschlagen'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>AI / Modelle</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                label="Ollama-URL" size="small" fullWidth value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder={defaults?.url}
                helperText={reachable === false ? 'Nicht erreichbar' : reachable ? `${models.length} Modelle gefunden` : ' '}
              />
              <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} />}
                onClick={() => loadModels(ollamaUrl.trim())} sx={{ mb: 2.5, flexShrink: 0 }}>
                Laden
              </Button>
            </Box>

            <Autocomplete
              freeSolo options={models} value={chatModel}
              onInputChange={(e, v) => setChatModel(v)}
              renderInput={(p) => (
                <TextField {...p} size="small" label="Chat-Modell (RAG-Assistent)" placeholder={defaults?.chatModel} />
              )}
            />

            <Autocomplete
              freeSolo options={models} value={embedModel}
              onInputChange={(e, v) => setEmbedModel(v)}
              renderInput={(p) => (
                <TextField {...p} size="small" label="Embed-Modell (semantische Suche)" placeholder={defaults?.embedModel} />
              )}
            />
            {embedChanged && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Ein Wechsel des Embed-Modells berechnet alle Embeddings neu (im Hintergrund).
                Bei abweichender Vektorgröße werden die alten Embeddings verworfen.
              </Alert>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              Modelle müssen in Ollama installiert sein (z.B. <code>ollama pull {defaults?.chatModel || 'llama3.2:3b'}</code>).
              Leeres Feld = Standardwert.
            </Typography>

            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
            {notice && <Alert severity="success" sx={{ py: 0.5 }}>{notice}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Schließen</Button>
        <Button onClick={save} variant="contained" disabled={loading || saving}>
          {saving ? 'Speichern…' : 'Speichern'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
