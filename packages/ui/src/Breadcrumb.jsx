import { Box, Typography } from '@mui/material'

// Pfad-Anzeige mit Chevron-Trennern. Ausschließlich token-gestylt.
// - items: Array aus Strings oder { label, onClick }. Letztes Element gilt als aktuelle Seite.
// - separator: optionaler React-Node als Trenner (Default: schlichtes Chevron-Glyph).
export function Breadcrumb({ items = [], separator = null }) {
  const sep = separator ?? (
    <Box component="span" sx={{ mx: 0.5, opacity: 0.5, fontSize: 13, lineHeight: 1 }}>
      ›
    </Box>
  )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', color: 'text.secondary' }}>
      {items.map((it, i) => {
        const label = typeof it === 'string' ? it : it.label
        const onClick = typeof it === 'string' ? undefined : it.onClick
        const isLast = i === items.length - 1
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="caption"
              onClick={onClick}
              sx={{
                color: isLast ? 'text.primary' : 'inherit',
                cursor: !isLast && onClick ? 'pointer' : 'default',
                '&:hover': !isLast && onClick ? { color: 'text.primary' } : undefined,
              }}
            >
              {label}
            </Typography>
            {!isLast && sep}
          </Box>
        )
      })}
    </Box>
  )
}
