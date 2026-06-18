import { describe, it, expect } from 'vitest'
import { pageHref, parsePageHref } from './pageLink'

describe('pageLink', () => {
  it('baut einen internen Seiten-href', () => expect(pageHref('xyz')).toBe('#/page/xyz'))
  it('parst die id aus einem internen href', () => expect(parsePageHref('#/page/xyz')).toBe('xyz'))
  it('liefert null bei fremden/leeren hrefs', () => {
    expect(parsePageHref('https://example.com')).toBe(null)
    expect(parsePageHref('#/other')).toBe(null)
    expect(parsePageHref('')).toBe(null)
    expect(parsePageHref(null)).toBe(null)
  })
})
