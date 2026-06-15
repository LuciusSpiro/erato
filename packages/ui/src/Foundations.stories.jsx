import { Box, Typography, Stack } from '@mui/material'

// Foundation-Story: zeigt die semantischen Farben + Typografie aus den Tokens.
// Über den Theme-Switcher (Toolbar) lassen sich Light/Dark + Brand live vergleichen.
export default { title: 'Foundations/Übersicht' }

const Swatch = ({ name, sx }) => (
  <Stack alignItems="center" spacing={0.5}>
    <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', ...sx }} />
    <Typography variant="caption" color="text.secondary">{name}</Typography>
  </Stack>
)

export const Colors = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <Swatch name="primary" sx={{ bgcolor: 'primary.main' }} />
      <Swatch name="bg" sx={{ bgcolor: 'background.default' }} />
      <Swatch name="surface" sx={{ bgcolor: 'background.paper' }} />
      <Swatch name="success" sx={{ bgcolor: 'success.main' }} />
      <Swatch name="warning" sx={{ bgcolor: 'warning.main' }} />
      <Swatch name="error" sx={{ bgcolor: 'error.main' }} />
    </Stack>
  ),
}

export const Typography_ = {
  name: 'Typografie',
  render: () => (
    <Stack spacing={1} sx={{ width: 480 }}>
      <Typography variant="h1">Überschrift 1</Typography>
      <Typography variant="h2">Überschrift 2</Typography>
      <Typography variant="h3">Überschrift 3</Typography>
      <Typography variant="body1">
        Fließtext: ruhige Leseschrift, line-height 1.65, max. ~700px für gute Lesbarkeit.
      </Typography>
      <Typography variant="body2" color="text.secondary">Sekundärtext (body2).</Typography>
    </Stack>
  ),
}
