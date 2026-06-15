import { Box, Typography } from '@mui/material'

// Leerzustand für leere Seiten/Listen. Ausschließlich token-gestylt, ruhig & zentriert.
// - icon: optionaler React-Node (in dezentem Surface-Kreis dargestellt).
// - title: kurze Überschrift.
// - description: erläuternder Hinweistext (secondary).
// - action: optionaler React-Node (z. B. Button) unter dem Text.
export function EmptyState({ icon = null, title, description, action = null }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        px: 3,
        py: 6,
        maxWidth: 360,
        mx: 'auto',
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            mb: 1,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          {icon}
        </Box>
      )}
      {title && (
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  )
}
