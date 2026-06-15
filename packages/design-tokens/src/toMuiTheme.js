// Wandelt eine aufgelöste Token-Map (siehe resolve.js) in MUI-Theme-Optionen.
// cssVariables: true → Theme als CSS-Variablen, Mode-/Brand-Wechsel ohne Rebuild.

const tg = (t) => ({
  fontFamily: t.fontFamily,
  fontSize: t.fontSize,
  fontWeight: t.fontWeight,
  lineHeight: t.lineHeight,
})

export function toMuiTheme(tokens, mode) {
  return {
    cssVariables: true,
    shape: { borderRadius: parseInt(tokens['radius.md'] ?? '8px', 10) },
    palette: {
      mode,
      primary: { main: tokens['semantic.primary'] },
      background: { default: tokens['semantic.bg'], paper: tokens['semantic.surface'] },
      text: { primary: tokens['semantic.text'], secondary: tokens['semantic.textSecondary'] },
      divider: tokens['semantic.border'],
      success: { main: tokens['semantic.success'] },
      warning: { main: tokens['semantic.warning'] },
      error: { main: tokens['semantic.error'] },
    },
    typography: {
      fontFamily: tokens['type.body']?.fontFamily,
      fontSize: 16,
      h1: tg(tokens['type.h1']),
      h2: tg(tokens['type.h2']),
      h3: tg(tokens['type.h3']),
      h4: { fontSize: '1rem', fontWeight: 600 },
      body1: { fontSize: tokens['type.body']?.fontSize, lineHeight: tokens['type.body']?.lineHeight },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      caption: { fontSize: '0.8125rem' },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  }
}
