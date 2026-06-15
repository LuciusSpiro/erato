import { Box, InputBase } from '@mui/material'

// Kompaktes Suchfeld im ruhigen Stil (MUI InputBase, kein Schatten).
// Trennung über 1px-Border + Surface-Ton, Fokus über Akzent-Border.
// - icon: optionaler React-Node links (z. B. lucide Search). Eigene Größe steuert der Aufrufer.
// - endAdornment: optionaler React-Node rechts (z. B. esc-Chip).
// - value/defaultValue/onChange/placeholder: wie bei einem normalen Input.
// - fullWidth: nimmt die volle Breite ein.
export function SearchField({
  icon = null,
  endAdornment = null,
  placeholder = 'Suchen…',
  value,
  defaultValue,
  onChange,
  fullWidth = false,
  autoFocus = false,
  ...rest
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        width: fullWidth ? '100%' : 'auto',
        px: 1.25,
        py: 0.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        transition: 'border-color 120ms',
        '&:focus-within': { borderColor: 'primary.main' },
      }}
      {...rest}
    >
      {icon && (
        <Box sx={{ display: 'flex', flexShrink: 0, color: 'text.secondary' }}>{icon}</Box>
      )}
      <InputBase
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        autoFocus={autoFocus}
        sx={{ flex: 1, fontSize: 14, color: 'text.primary' }}
      />
      {endAdornment && <Box sx={{ display: 'flex', flexShrink: 0 }}>{endAdornment}</Box>}
    </Box>
  )
}
