import { createTheme } from '@mui/material/styles'
import { muiThemeFor } from '@erato/design-tokens'

// Theme stammt jetzt aus @erato/design-tokens (DTCG → MUI). theme.js ist nur noch Adapter.
// branding.primary = { light, dark } aus der API überschreibt die Akzentfarbe (White-Label).
export const createAppTheme = (mode, branding = {}) => {
  const primary = branding.primary?.[mode] ?? null
  return createTheme(muiThemeFor(mode, { primary }))
}

// Highlight-Palette (feste Pastelltöne) — bleibt hier, bis sie in die Tokens wandert.
export const HIGHLIGHTS = {
  yellow: { light: '#FFF3BF', dark: '#5C5524' },
  green: { light: '#D3F9D8', dark: '#2B4D33' },
  blue: { light: '#D0EBFF', dark: '#26415C' },
  pink: { light: '#FFDEEB', dark: '#5C2E40' },
  purple: { light: '#E5DBFF', dark: '#3E2E5C' },
}
