import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material'
import { Palette, FolderDown, DatabaseBackup, Bot } from 'lucide-react'

// Editor-Einstellungen (pro Browser, in localStorage) + Daten-Export + Branding-Zugang (Admin).
export default function PreferencesDialog({ open, onClose, indentSize, onChangeIndent, isAdmin, onOpenBranding, onOpenAiSettings, onExportAll, onExportAllErato }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>Einstellungen</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Editor</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="body2">Einrückung (Tab) in Code-Blöcken</Typography>
            <Typography variant="caption" color="text.secondary">Anzahl Leerzeichen pro Tab</Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={indentSize}
            onChange={(e, v) => v && onChangeIndent?.(v)}
          >
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2">Daten</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<FolderDown size={15} />} onClick={onExportAll} sx={{ justifyContent: 'flex-start' }}>
            Alles exportieren (Markdown, ZIP)
          </Button>
          <Button size="small" variant="outlined" startIcon={<DatabaseBackup size={15} />} onClick={onExportAllErato} sx={{ justifyContent: 'flex-start' }}>
            Komplett sichern (Erato 1:1)
          </Button>
        </Box>

        {isAdmin && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2">Administration</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="body2">Branding (Theme &amp; Logo)</Typography>
                <Typography variant="caption" color="text.secondary">Akzentfarbe und Logo der Instanz</Typography>
              </Box>
              <Button size="small" variant="outlined" startIcon={<Palette size={15} />} onClick={onOpenBranding}>
                Bearbeiten
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="body2">AI / Modelle</Typography>
                <Typography variant="caption" color="text.secondary">Ollama-URL, Chat- &amp; Embed-Modell</Typography>
              </Box>
              <Button size="small" variant="outlined" startIcon={<Bot size={15} />} onClick={onOpenAiSettings}>
                Bearbeiten
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">Fertig</Button>
      </DialogActions>
    </Dialog>
  )
}
