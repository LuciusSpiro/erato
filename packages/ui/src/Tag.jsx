import { Chip } from '@mui/material'

// Token-gestyltes Tag/Chip. Farben kommen ausschließlich aus dem Theme (Tokens),
// keine hartkodierten Werte.
export function Tag({ label, color = 'default', ...rest }) {
  const sx =
    color === 'primary'
      ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
      : { bgcolor: 'action.selected', color: 'text.secondary' }
  return <Chip size="small" label={label} sx={{ borderRadius: 1.5, fontWeight: 500, ...sx }} {...rest} />
}
