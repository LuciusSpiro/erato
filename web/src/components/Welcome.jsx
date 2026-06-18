import { useMemo } from 'react'
import { Box, Button, useTheme } from '@mui/material'
import { LogIn } from 'lucide-react'
import TipTapView from './editor/TipTapView'
import { welcomeDoc } from '../welcomeDoc'

// Öffentliche Willkommens-/Produktseite für nicht angemeldete Besucher.
// Rendert die Doku (welcomeDoc) read-only und bietet einen Login-Call-to-Action.
export default function Welcome({ appName = 'Erato', onLogin }) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const md = useMemo(() => welcomeDoc(appName), [appName])

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', px: 4, py: 6 }}>
        {onLogin && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<LogIn size={16} />} onClick={onLogin}>
              Anmelden
            </Button>
          </Box>
        )}
        <TipTapView value={md} editable={false} mode={mode} />
        <Box sx={{ height: 64 }} />
      </Box>
    </Box>
  )
}
