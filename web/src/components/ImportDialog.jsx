import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Select, MenuItem, FormControl, InputLabel, Alert,
} from '@mui/material'
import { Upload } from 'lucide-react'

const isErato = (name) => /\.erato\.json$/i.test(name) || /\.json$/i.test(name)

// Import-Dialog: dispatcht nach Dateityp.
//  .md/.zip  → Markdown-Import in ein Ziel-Notizbuch
//  .json     → Erato-1:1-Restore (legt neue Notizbücher an, kein Ziel nötig)
export default function ImportDialog({ open, onClose, notebooks = [], defaultNotebookId, api, onDone }) {
  const [file, setFile] = useState(null)
  const [notebookId, setNotebookId] = useState(defaultNotebookId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (open) { setFile(null); setBusy(false); setError(null); setResult(null); setNotebookId(defaultNotebookId || notebooks[0]?.id || '') }
  }, [open, defaultNotebookId, notebooks])

  const erato = file && isErato(file.name)
  const canImport = file && !busy && (erato || notebookId)

  const submit = async () => {
    if (!canImport) return
    setBusy(true); setError(null)
    try {
      const res = erato ? await api.importErato(file) : await api.importFile(notebookId, null, file)
      setResult(res)
      await onDone?.()
    } catch (e) {
      setError(e.message || 'Import fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>Importieren</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button component="label" variant="outlined" startIcon={<Upload size={16} />} sx={{ justifyContent: 'flex-start', mt: 1 }}>
          {file ? file.name : 'Datei wählen (.md, .zip, .erato.json)'}
          <input
            type="file"
            hidden
            accept=".md,.markdown,.zip,.json"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(null) }}
          />
        </Button>

        {file && erato && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Erato-1:1-Sicherung erkannt — legt neue Notizbücher an (Inhalt byte-genau, inkl. Highlights).
          </Alert>
        )}

        {file && !erato && (
          <FormControl size="small" fullWidth>
            <InputLabel>Ziel-Notizbuch</InputLabel>
            <Select label="Ziel-Notizbuch" value={notebookId} onChange={(e) => setNotebookId(e.target.value)}>
              {notebooks.map((nb) => (
                <MenuItem key={nb.id} value={nb.id}>{nb.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        {result && (
          <Alert severity="success" sx={{ py: 0.5 }}>
            Import erfolgreich{result.pages != null ? ` — ${result.pages} Seiten` : result.created != null ? ` — ${result.created} Seiten` : ''}.
          </Alert>
        )}
        {!file && (
          <Typography variant="caption" color="text.secondary">
            Markdown (.md/.zip) wird in das gewählte Notizbuch importiert. Eine Erato-Sicherung (.json) stellt komplette Notizbücher wieder her.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{result ? 'Schließen' : 'Abbrechen'}</Button>
        <Button onClick={submit} variant="contained" disabled={!canImport}>Importieren</Button>
      </DialogActions>
    </Dialog>
  )
}
