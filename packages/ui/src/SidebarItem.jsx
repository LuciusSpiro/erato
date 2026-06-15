import { Box, Typography } from '@mui/material'

// Baum-Zeile für die Sidebar. Ausschließlich token-gestylt.
// - label: Text der Zeile
// - icon: optionaler React-Node (z. B. lucide-Icon), wird links angezeigt
// - active: aktiver Zustand -> Akzent-Bar links + kräftigerer Text (kein Vollflächen-Highlight)
// - depth: Einrückungstiefe (12px je Ebene), für verschachtelte Bäume
// - onClick: Klick-Handler für die Zeile
// - actions: optionaler React-Node mit Hover-Aktionen (z. B. "+"/"…"), nur bei Hover sichtbar
export function SidebarItem({ label, icon = null, active = false, depth = 0, onClick, actions = null }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        height: 32,
        pr: 0.5,
        pl: `${8 + depth * 14}px`,
        borderRadius: 1.5,
        cursor: 'pointer',
        color: active ? 'text.primary' : 'text.secondary',
        fontWeight: active ? 600 : 400,
        bgcolor: active ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
        '&:hover .sidebar-item-actions': { opacity: 1 },
      }}
    >
      {active && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 6,
            bottom: 6,
            width: 3,
            borderRadius: 2,
            bgcolor: 'primary.main',
          }}
        />
      )}
      {icon && (
        <Box sx={{ display: 'flex', flexShrink: 0, color: 'inherit', opacity: 0.8 }}>{icon}</Box>
      )}
      <Typography noWrap variant="body2" sx={{ flex: 1, fontWeight: 'inherit', color: 'inherit' }}>
        {label}
      </Typography>
      {actions && (
        <Box
          className="sidebar-item-actions"
          sx={{ display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 120ms' }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </Box>
      )}
    </Box>
  )
}
