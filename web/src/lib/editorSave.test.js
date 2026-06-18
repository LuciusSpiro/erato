import { describe, it, expect } from 'vitest'
import { evaluateContentChange } from './editorSave'

describe('evaluateContentChange — Autosave-Datenverlust-Schutz', () => {
  it('blockt das Überschreiben von nicht-leerem Inhalt mit leer', () => {
    expect(evaluateContentChange('# Inhalt', '')).toEqual({ apply: false, save: false })
    expect(evaluateContentChange('# Inhalt', '   \n  ')).toEqual({ apply: false, save: false })
  })
  it('speichert echte Änderungen', () => {
    expect(evaluateContentChange('alt', 'neu')).toEqual({ apply: true, save: true })
  })
  it('wendet an, speichert aber nicht bei unverändertem Inhalt (Echo)', () => {
    expect(evaluateContentChange('gleich', 'gleich')).toEqual({ apply: true, save: false })
  })
  it('erlaubt das Leeren einer bereits leeren Seite', () => {
    expect(evaluateContentChange('', '')).toEqual({ apply: true, save: false })
    expect(evaluateContentChange('  ', '')).toEqual({ apply: true, save: true })
  })
})
