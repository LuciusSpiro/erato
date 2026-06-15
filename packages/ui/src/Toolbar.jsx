import { Box, Paper } from '@mui/material'

// Formatierungs-Button für die Editor-Bubble. Ausschließlich token-gestylt.
// - icon: React-Node (z. B. lucide Bold). Größe steuert der Aufrufer.
// - active: aktiver Zustand -> Akzentfarbe.
// - onClick / title (a11y-Label).
export function ToolbarButton({ icon, active = false, onClick, title }) {
  return (
    <Box
      role="button"
      aria-label={title}
      title={title}
      aria-pressed={active}
      onClick={onClick}
      sx={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        cursor: 'pointer',
        color: active ? 'primary.main' : 'text.secondary',
        bgcolor: active ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {icon}
    </Box>
  )
}

// Container für Formatierungs-Buttons (Bubble-Toolbar bei Textauswahl).
// - elevated: dezenter Schatten (für schwebende Bubble); sonst flach mit Border.
// - children: i. d. R. ToolbarButton-Elemente.
export function Toolbar({ children, elevated = false }) {
  return (
    <Paper
      elevation={elevated ? 2 : 0}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5,
        py: 0.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {children}
    </Paper>
  )
}
