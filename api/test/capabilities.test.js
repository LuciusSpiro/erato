import { describe, it, expect } from 'vitest'
import { hasModel, evaluateAi } from '../src/capabilities.js'

describe('hasModel', () => {
  it('matcht exakt und über den Basis-Namen (ollama hängt :latest an)', () => {
    expect(hasModel(['nomic-embed-text:latest'], 'nomic-embed-text')).toBe(true)
    expect(hasModel(['llama3.2:3b'], 'llama3.2:3b')).toBe(true)
    expect(hasModel(['llama3.2:1b'], 'llama3.2:3b')).toBe(true) // gleicher Basis-Name
    expect(hasModel(['mistral:latest'], 'llama3.2:3b')).toBe(false)
    expect(hasModel(null, 'x')).toBe(false)
    expect(hasModel(['x'], '')).toBe(false)
  })
})

describe('evaluateAi', () => {
  const models = { embedModel: 'nomic-embed-text', chatModel: 'llama3.2:3b' }

  it('flag=false → komplett deaktiviert', () => {
    expect(evaluateAi({ flag: 'false', tags: ['llama3.2:3b'], ...models }))
      .toEqual({ enabled: false, chat: false, embeddings: false, reason: 'disabled' })
  })

  it('Ollama nicht erreichbar (tags=null) → deaktiviert', () => {
    expect(evaluateAi({ flag: 'auto', tags: null, ...models }).enabled).toBe(false)
    expect(evaluateAi({ flag: 'auto', tags: null, ...models }).reason).toBe('unreachable')
  })

  it('flag=true erzwingt Verfügbarkeit auch ohne Probe', () => {
    const r = evaluateAi({ flag: 'true', tags: null, ...models })
    expect(r).toEqual({ enabled: true, chat: true, embeddings: true, reason: 'forced' })
  })

  it('auto + beide Modelle vorhanden → voll aktiv', () => {
    const r = evaluateAi({ flag: 'auto', tags: ['nomic-embed-text:latest', 'llama3.2:3b'], ...models })
    expect(r).toEqual({ enabled: true, chat: true, embeddings: true, reason: 'ok' })
  })

  it('auto + nur Embed-Modell → aktiv, aber chat=false', () => {
    const r = evaluateAi({ flag: 'auto', tags: ['nomic-embed-text:latest'], ...models })
    expect(r).toMatchObject({ enabled: true, chat: false, embeddings: true })
  })

  it('auto + erreichbar, aber kein passendes Modell → deaktiviert', () => {
    const r = evaluateAi({ flag: 'auto', tags: ['mistral:latest'], ...models })
    expect(r).toEqual({ enabled: false, chat: false, embeddings: false, reason: 'no-models' })
  })
})
