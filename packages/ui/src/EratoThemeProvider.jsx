import { useMemo } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import { muiThemeFor } from '@erato/design-tokens'

// Zentraler Theme-Provider: baut das MUI-Theme aus den Design-Tokens.
// mode: 'light' | 'dark'; brand: optionaler DTCG-Override; primary: Akzentfarbe-Kurzweg.
export function EratoThemeProvider({ mode = 'light', brand = null, primary = null, children }) {
  const theme = useMemo(
    () => createTheme(muiThemeFor(mode, { brand, primary })),
    [mode, brand, primary],
  )
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
