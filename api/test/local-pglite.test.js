import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'

// Verifiziert den local mode (Electron-Einzelplatz) komplett in-process:
// PGlite als DB, lokaler Datei-Storage, AUTH_MODE=local (kein Token).
// Braucht KEINE externen Dienste (kein Docker/Postgres/Keycloak/MinIO).
const DATA_DIR = join(tmpdir(), `erato-pglite-test-${process.pid}`)

let app
beforeAll(async () => {
  rmSync(DATA_DIR, { recursive: true, force: true })
  process.env.ERATO_MODE = 'local'
  process.env.LOCAL_DATA_DIR = DATA_DIR
  process.env.AI_ENABLED = 'false'
  // Erst nach dem Setzen der Env importieren (config liest beim Laden).
  const { buildApp } = await import('../src/server.js')
  app = await buildApp({ logger: false })
}, 60000)

afterAll(async () => {
  await app?.close()
  rmSync(DATA_DIR, { recursive: true, force: true })
})

describe('local mode (PGlite + lokaler Storage + local-auth)', () => {
  it('health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })

  it('capabilities meldet AI deaktiviert (AI_ENABLED=false)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/capabilities' })
    expect(res.json()).toMatchObject({ mode: 'local', ai: { enabled: false } })
  })

  it('Demo-Seed ist vorhanden, Zugriff OHNE Token (local-auth)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/notebooks' })
    expect(res.statusCode).toBe(200)
    const nbs = res.json()
    expect(nbs.some((n) => n.title === 'Engineering')).toBe(true)
  })

  it('Notizbuch + Seite anlegen, Volltextsuche (tsvector), löschen (cascade)', async () => {
    const uniq = 'Zauberwort' + process.pid
    const nb = (await app.inject({
      method: 'POST', url: '/v1/notebooks',
      headers: { 'content-type': 'application/json' },
      payload: { title: 'LocalNB' },
    })).json()
    expect(nb.id).toBeTruthy()

    const page = (await app.inject({
      method: 'POST', url: '/v1/pages',
      headers: { 'content-type': 'application/json' },
      payload: { notebookId: nb.id, title: 'Seite' },
    })).json()
    await app.inject({
      method: 'PUT', url: `/v1/pages/${page.id}`,
      headers: { 'content-type': 'application/json' },
      payload: { contentMd: `# Seite\n\nEnthält ${uniq}.` },
    })

    const hits = (await app.inject({ method: 'GET', url: `/v1/search?q=${uniq}` })).json()
    expect(hits.some((h) => h.pageId === page.id)).toBe(true)

    const del = await app.inject({ method: 'DELETE', url: `/v1/notebooks/${nb.id}` })
    expect(del.statusCode).toBe(200)
    const after = (await app.inject({ method: 'GET', url: '/v1/notebooks' })).json()
    expect(after.some((n) => n.id === nb.id)).toBe(false)
  })

  it('AI-Settings: lesen, Chat-Modell ändern/persistieren, Modell-Liste', async () => {
    const before = (await app.inject({ method: 'GET', url: '/v1/settings/ai' })).json()
    expect(before).toMatchObject({ embedModel: 'nomic-embed-text', chatModel: 'llama3.2:3b', embedDim: 768 })
    expect(before.defaults.chatModel).toBe('llama3.2:3b')

    // Chat-Modell ist gefahrlos → kein Re-Index, sofort persistiert.
    const put = await app.inject({
      method: 'PUT', url: '/v1/settings/ai',
      headers: { 'content-type': 'application/json' },
      payload: { chatModel: 'llama3.1:8b' },
    })
    expect(put.statusCode).toBe(200)
    expect(put.json()).toMatchObject({ ok: true, reindex: null, settings: { chatModel: 'llama3.1:8b' } })

    const after = (await app.inject({ method: 'GET', url: '/v1/settings/ai' })).json()
    expect(after.chatModel).toBe('llama3.1:8b')
    expect(after.overridden.chatModel).toBe(true)

    // Modell-Liste: liefert immer eine gültige Form (mit/ohne laufendes Ollama).
    const models = (await app.inject({ method: 'GET', url: '/v1/ai/models' })).json()
    expect(typeof models.reachable).toBe('boolean')
    expect(Array.isArray(models.models)).toBe(true)
  })

  it('AI-Settings: Wechsel auf nicht erreichbares Embed-Modell → 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/settings/ai',
      headers: { 'content-type': 'application/json' },
      payload: { embedModel: 'gibt-es-nicht' },
    })
    expect(res.statusCode).toBe(400)
    // Embed-Modell bleibt unverändert.
    const s = (await app.inject({ method: 'GET', url: '/v1/settings/ai' })).json()
    expect(s.embedModel).toBe('nomic-embed-text')
  })

  it('Branding-Logo: Upload + Auslieferung über lokalen Datei-Storage', async () => {
    // 1x1 PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const boundary = '----eratotest'
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const up = await app.inject({
      method: 'POST', url: '/v1/branding/logo?mode=light',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    })
    expect(up.statusCode).toBe(200)

    const got = await app.inject({ method: 'GET', url: '/v1/branding/logo?mode=light' })
    expect(got.statusCode).toBe(200)
    expect(got.headers['content-type']).toContain('image/png')
    expect(got.rawPayload.length).toBe(png.length)
  })
})
