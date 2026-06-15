import { Box, Typography } from '@mui/material'

const TONES = {
  info: 'primary.main',
  success: 'success.main',
  warning: 'warning.main',
  error: 'error.main',
}

// Token-gestylter Hinweis-Block. Trennung über Border + Surface-Ton (kein Schatten),
// Akzent-Bar links in der jeweiligen semantischen Farbe.
export function Callout({ tone = 'info', title, children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ width: 3, borderRadius: 2, bgcolor: TONES[tone], flexShrink: 0 }} />
      <Box>
        {title && (
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
            {title}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {children}
        </Typography>
      </Box>
    </Box>
  )
}
