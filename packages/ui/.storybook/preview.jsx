import { ThemeProvider, CssBaseline } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import { withThemeFromJSXProvider } from '@storybook/addon-themes'
import { muiThemeFor } from '@erato/design-tokens'

// Vier Themes im Switcher: Default + ein Beispiel-Brand ("Acme"), je Light/Dark.
// Demonstriert White-Label live über die gesamte Komponentenbibliothek.
const themes = {
  Light: createTheme(muiThemeFor('light')),
  Dark: createTheme(muiThemeFor('dark')),
  'Acme Light': createTheme(muiThemeFor('light', { primary: '#0CA678' })),
  'Acme Dark': createTheme(muiThemeFor('dark', { primary: '#38D9A9' })),
}

export const decorators = [
  withThemeFromJSXProvider({
    themes,
    defaultTheme: 'Light',
    Provider: ThemeProvider,
    GlobalStyles: CssBaseline,
  }),
]

export const parameters = {
  layout: 'centered',
  controls: { matchers: { color: /(background|color)$/i } },
}
