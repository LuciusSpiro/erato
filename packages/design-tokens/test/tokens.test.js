import { describe, it, expect } from 'vitest'
import { resolveTokens, muiThemeFor, toCssVars, validate } from '../src/index.js'
import primitives from '../tokens/primitives.json'
import semanticLight from '../tokens/semantic.light.json'
import typography from '../tokens/typography.json'
import highlight from '../tokens/highlight.json'
import component from '../tokens/component.json'

describe('resolveTokens (DTCG-Auflösung)', () => {
  it('löst die Akzentfarbe je Mode auf', () => {
    expect(resolveTokens('light')['semantic.primary']).toBe('#3B5BDB')
    expect(resolveTokens('dark')['semantic.primary']).toBe('#748FFC')
  })
  it('mappt Hintergrund/Surface je Mode', () => {
    expect(resolveTokens('light')['semantic.bg']).toBe('#FFFFFF')
    expect(resolveTokens('light')['semantic.surface']).toBe('#F8F9FA')
  })
})

describe('muiThemeFor', () => {
  it('übernimmt den Brand-Primary-Override (White-Label)', () => {
    const theme = muiThemeFor('light', { primary: '#0CA678' })
    expect(theme.palette.primary.main).toBe('#0CA678')
    expect(theme.palette.mode).toBe('light')
  })
  it('nutzt die Default-Akzentfarbe ohne Override', () => {
    expect(muiThemeFor('dark').palette.primary.main).toBe('#748FFC')
  })
})

describe('toCssVars', () => {
  it('erzeugt CSS-Variablen aus den Tokens', () => {
    const css = toCssVars(resolveTokens('light'))
    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--erato-semantic-primary: #3B5BDB;')
  })
})

describe('validate', () => {
  it('akzeptiert gültige Token-Layer', () => {
    expect(validate([primitives, semanticLight, typography, highlight, component])).toEqual({ ok: true, errors: [] })
  })
  it('meldet einen kaputten Alias', () => {
    const broken = [{ semantic: { primary: { $type: 'color', $value: '{color.gibtsnicht}' } } }]
    expect(validate(broken).ok).toBe(false)
  })
})
