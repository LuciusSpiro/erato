import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'

// Testet den MCP-Erato-Client (local target) end-to-end gegen eine echte,
// lauschende lokale PGlite-API. Kein Docker/Keycloak nötig. Deckt v.a. die
// idempotente upsert-Logik + Scoping (ERATO_NOTEBOOK) ab.
const DATA_DIR = join(tmpdir(), `erato-mcp-test-${process.pid}`)
const PORT = 3071

let app
let client
beforeAll(async () => {
  rmSync(DATA_DIR, { recursive: true, force: true })
  process.env.ERATO_MODE = 'local'
  process.env.LOCAL_DATA_DIR = DATA_DIR
  process.env.AI_ENABLED = 'false'
  const { start } = await import('../src/server.js')
  app = await start({ port: PORT, host: '127.0.0.1', logger: false })

  // MCP-Client im local-Target, API-Basis direkt überschrieben, Default-Notizbuch.
  process.env.ERATO_TARGET = 'local'
  process.env.ERATO_API_URL = `http://127.0.0.1:${PORT}`
  process.env.ERATO_NOTEBOOK = 'Agent Docs'
  client = await import('../../mcp/src/erato-client.js')
}, 60000)

afterAll(async () => {
  await app?.close()
  rmSync(DATA_DIR, { recursive: true, force: true })
})

describe('MCP upsert (local target)', () => {
  it('legt Notizbuch + Pfad an und ist idempotent (kein Duplikat)', async () => {
    const r1 = await client.upsertByPath(undefined, 'Architektur/Datenbank', { markdown: '# Datenbank\n\nv1' })
    expect(r1.created).toBe(true)
    expect(r1.pageId).toBeTruthy()

    // Zweiter Aufruf: gleiche Seite, nur Inhalt aktualisiert.
    const r2 = await client.upsertByPath(undefined, 'Architektur/Datenbank', { markdown: '# Datenbank\n\nv2' })
    expect(r2.pageId).toBe(r1.pageId)
    expect(r2.created).toBe(false)

    // Inhalt wurde aktualisiert.
    const page = await client.getPage(r1.pageId)
    expect(page.contentMd).toContain('v2')

    // Notizbuch „Agent Docs" wurde per Scoping (ERATO_NOTEBOOK) angelegt …
    const nbs = await client.listNotebooks()
    const nb = nbs.find((n) => n.title === 'Agent Docs')
    expect(nb).toBeTruthy()

    // … und es gibt genau EINE „Architektur" mit genau EINER „Datenbank".
    const tree = await client.listPages(nb.id)
    const arch = tree.filter((p) => p.title === 'Architektur')
    expect(arch).toHaveLength(1)
    expect(arch[0].children.filter((c) => c.title === 'Datenbank')).toHaveLength(1)
  })

  it('legt fehlende Zwischenseiten an und teilt sie bei gemeinsamem Pfad', async () => {
    await client.upsertByPath('Agent Docs', 'API/Endpunkte', { markdown: '# Endpunkte' })
    await client.upsertByPath('Agent Docs', 'API/Auth', { markdown: '# Auth' })

    const nbs = await client.listNotebooks()
    const nb = nbs.find((n) => n.title === 'Agent Docs')
    const tree = await client.listPages(nb.id)
    const api = tree.filter((p) => p.title === 'API')
    expect(api).toHaveLength(1) // gemeinsame Elternseite, nicht doppelt
    const childTitles = api[0].children.map((c) => c.title).sort()
    expect(childTitles).toEqual(['Auth', 'Endpunkte'])
  })

  it('research_topic liefert Volltext der Treffer, eingegrenzt aufs Notizbuch', async () => {
    const uniq = 'Zauberbegriff' + process.pid
    // Treffer im Scope-Notizbuch (ERATO_NOTEBOOK='Agent Docs') …
    await client.upsertByPath(undefined, 'Themen/Alpha', { markdown: `# Alpha\n\nEnthält ${uniq} im Detail.` })
    // … und ein gleichlautender Treffer in einem ANDEREN Notizbuch.
    const other = await client.createNotebook('Anderes Projekt')
    await client.upsertByPath(other.id, 'Beta', { markdown: `# Beta\n\nAuch ${uniq} hier.` })

    const r = await client.researchTopic(uniq) // Default-Scope = 'Agent Docs'
    expect(r.scope).toBe('Agent Docs')
    expect(r.results.length).toBeGreaterThanOrEqual(1)
    // Nur Treffer aus dem Scope-Notizbuch, Volltext enthalten.
    expect(r.results.every((x) => x.title !== 'Beta')).toBe(true)
    const alpha = r.results.find((x) => x.title === 'Alpha')
    expect(alpha).toBeTruthy()
    expect(alpha.contentMd).toContain(uniq)

    // '*' erzwingt instanzweite Suche → findet auch 'Beta' im anderen Notizbuch.
    const global = await client.researchTopic(uniq, { notebook: '*', limit: 20 })
    expect(global.scope).toBe(null)
    expect(global.results.some((x) => x.title === 'Beta')).toBe(true)
  })

  it('create_notebook + delete_page funktionieren', async () => {
    const nb = await client.createNotebook('Wegwerf', '🗑️')
    expect(nb.id).toBeTruthy()
    const r = await client.upsertByPath(nb.id, 'Temp', { markdown: '# Temp' })
    await client.deletePage(r.pageId)
    const tree = await client.listPages(nb.id)
    expect(tree.find((p) => p.id === r.pageId)).toBeFalsy()
  })
})
