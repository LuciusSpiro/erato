// @erato/design-tokens — öffentliche API.
// Default-Tokens (DTCG) + Resolver + MUI-Mapping. Bundler (Vite) importieren JSON nativ.

import primitives from '../tokens/primitives.json'
import typography from '../tokens/typography.json'
import semanticLight from '../tokens/semantic.light.json'
import semanticDark from '../tokens/semantic.dark.json'
import highlight from '../tokens/highlight.json'
import component from '../tokens/component.json'

import { resolve } from './resolve.js'
import { toMuiTheme } from './toMuiTheme.js'

export { resolve, deepMerge } from './resolve.js'
export { toMuiTheme } from './toMuiTheme.js'
export { toCssVars } from './toCssVars.js'
export { validate } from './validate.js'

const SEMANTIC = { light: semanticLight, dark: semanticDark }

// Aufgelöste Token-Map für einen Mode, optional mit Brand-Override-Layer (DTCG-Teilbaum).
// Layer-Reihenfolge = Override-Reihenfolge:
// primitives ← semantic[mode] ← typography ← highlight ← component ← brand.
export function resolveTokens(mode = 'light', brand = null) {
  return resolve([primitives, SEMANTIC[mode], typography, highlight, component, brand].filter(Boolean))
}

// Komfort: fertige MUI-Theme-Optionen für einen Mode (+ optionaler Brand-Override).
// brandOverride.primary (Hex) überschreibt direkt die Akzentfarbe (White-Label-Kurzweg).
export function muiThemeFor(mode = 'light', { brand = null, primary = null } = {}) {
  const tokens = resolveTokens(mode, brand)
  if (primary) tokens['semantic.primary'] = primary
  return toMuiTheme(tokens, mode)
}
