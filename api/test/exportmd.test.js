import { describe, it, expect } from 'vitest'
import {
  slugify, buildTree, buildPathMap, pageMarkdown, rewriteLinks, remapLinks, titleFromMd, toEratoNodes,
} from '../src/exportmd.js'

describe('slugify', () => {
  it('macht lesbare, sichere Slugs', () => {
    expect(slugify('Über Café!')).toBe('uber-cafe')
    expect(slugify('Web Components: Build')).toBe('web-components-build')
    expect(slugify('Maße & Größe ß')).toBe('masse-grosse-ss')
    expect(slugify('')).toBe('seite')
  })
})

describe('buildTree', () => {
  it('baut sortierten Baum aus flachen Zeilen', () => {
    const rows = [
      { id: 'b', parent_id: 'a', title: 'B', position: 0, content_md: 'b' },
      { id: 'a', parent_id: null, title: 'A', position: 0, content_md: 'a' },
      { id: 'c', parent_id: null, title: 'C', position: 1, content_md: 'c' },
    ]
    const tree = buildTree(rows)
    expect(tree.map((n) => n.id)).toEqual(['a', 'c'])
    expect(tree[0].children[0].id).toBe('b')
  })
})

describe('buildPathMap', () => {
  it('Eltern → Ordner/index.md, Blatt → slug.md', () => {
    const nodes = buildTree([
      { id: 'a', parent_id: null, title: 'Alpha', position: 0, content_md: '' },
      { id: 'b', parent_id: 'a', title: 'Beta', position: 0, content_md: '' },
      { id: 'c', parent_id: null, title: 'Gamma', position: 1, content_md: '' },
    ])
    const map = buildPathMap(nodes)
    expect(map.get('a')).toBe('alpha/index.md')
    expect(map.get('b')).toBe('alpha/beta.md')
    expect(map.get('c')).toBe('gamma.md')
  })
  it('dedupliziert gleichnamige Geschwister', () => {
    const nodes = buildTree([
      { id: 'x', parent_id: null, title: 'Seite', position: 0, content_md: '' },
      { id: 'y', parent_id: null, title: 'Seite', position: 1, content_md: '' },
    ])
    const map = buildPathMap(nodes)
    expect(new Set([map.get('x'), map.get('y')])).toEqual(new Set(['seite.md', 'seite-2.md']))
  })
})

describe('pageMarkdown', () => {
  it('stellt H1 voran, wenn keine vorhanden', () => {
    expect(pageMarkdown({ title: 'T', contentMd: 'Text' })).toBe('# T\n\nText')
  })
  it('lässt vorhandene H1 unverändert', () => {
    expect(pageMarkdown({ title: 'T', contentMd: '# Eigen\n\nText' })).toBe('# Eigen\n\nText')
  })
})

describe('rewriteLinks (Markdown-Export)', () => {
  it('schreibt interne Links auf relative .md-Pfade um', () => {
    const map = new Map([['p1', 'alpha/index.md'], ['p2', 'gamma.md']])
    const md = 'siehe [Gamma](#/page/p2) und [extern](#/page/unknown)'
    const out = rewriteLinks(md, 'alpha/index.md', map)
    expect(out).toContain('[Gamma](../gamma.md)')
    expect(out).toContain('[extern](#/page/unknown)') // unbekannt → unverändert
  })
})

describe('remapLinks (Erato-Import)', () => {
  it('ersetzt alte durch neue IDs', () => {
    const idMap = new Map([['old1', 'new1']])
    expect(remapLinks('[x](#/page/old1) [y](#/page/keep)', idMap))
      .toBe('[x](#/page/new1) [y](#/page/keep)')
  })
})

describe('titleFromMd', () => {
  it('nimmt erste H1, sonst Dateiname', () => {
    expect(titleFromMd('# Titel\n\nx', 'a.md')).toBe('Titel')
    expect(titleFromMd('kein header', 'Dateiname.md')).toBe('Dateiname')
  })
})

describe('toEratoNodes', () => {
  it('reduziert auf Inhalts-/Strukturfelder, behält id', () => {
    const nodes = buildTree([{ id: 'a', parent_id: null, title: 'A', position: 0, content_md: 'x' }])
    expect(toEratoNodes(nodes)).toEqual([{ id: 'a', title: 'A', position: 0, contentMd: 'x', children: [] }])
  })
})
