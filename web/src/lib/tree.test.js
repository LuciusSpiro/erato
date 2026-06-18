import { describe, it, expect } from 'vitest'
import { findPath, patchTitle, flattenPages } from './tree'

const notebooks = [{
  id: 'n1', title: 'NB', pages: [
    { id: 'a', title: 'A', children: [{ id: 'b', title: 'B', children: [] }] },
    { id: 'c', title: 'C', children: [] },
  ],
}]
const pages = notebooks[0].pages

describe('findPath', () => {
  it('findet den verschachtelten Pfad', () => expect(findPath(pages, 'b')).toEqual(['A', 'B']))
  it('liefert null bei unbekannter id', () => expect(findPath(pages, 'x')).toBe(null))
})

describe('patchTitle', () => {
  it('ändert nur die Zielseite, lässt andere unberührt', () => {
    const r = patchTitle(pages, 'b', 'B2')
    expect(r[0].children[0].title).toBe('B2')
    expect(r[0].title).toBe('A')
    expect(r[1].title).toBe('C')
  })
})

describe('flattenPages', () => {
  it('listet alle Seiten flach mit Notizbuch-Titel', () => {
    const flat = flattenPages(notebooks)
    expect(flat.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(flat[0].notebookTitle).toBe('NB')
  })
  it('verträgt leere Eingaben', () => expect(flattenPages([])).toEqual([]))
})
