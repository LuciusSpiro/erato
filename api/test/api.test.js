import { describe, it, expect, beforeAll } from 'vitest'

// Integrationstests gegen den LAUFENDEN Stack (docker compose up).
// Konfigurierbar über API_URL / KC_TOKEN_URL.
const API = process.env.API_URL || 'http://localhost:3001'
const KC = process.env.KC_TOKEN_URL || 'http://localhost:8085/realms/erato/protocol/openid-connect/token'

async function getToken(username, password) {
  const res = await fetch(KC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'erato-web', grant_type: 'password', username, password, scope: 'openid' }),
  })
  if (!res.ok) throw new Error('Token-Fehler ' + res.status)
  return (await res.json()).access_token
}
// auth: nur Bearer (für GET/DELETE — kein Content-Type ohne Body, sonst 400 bei Fastify).
const h = (t) => ({ Authorization: `Bearer ${t}` })
// json: Bearer + Content-Type (für POST/PUT mit Body).
const j = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

let admin, member
beforeAll(async () => {
  admin = await getToken('kai', 'erato')
  member = await getToken('member', 'member')
}, 20000)

describe('Health & Auth', () => {
  it('health → 200', async () => {
    expect((await fetch(`${API}/health`)).status).toBe(200)
  })
  it('Branding schreiben ohne Token → 401', async () => {
    const r = await fetch(`${API}/v1/branding?app=erato`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: {} }),
    })
    expect(r.status).toBe(401)
  })
})

describe('Seiten-Lebenszyklus (Admin)', () => {
  it('anlegen → speichern → lesen → suchen → Version → löschen', async () => {
    const uniq = 'Zauberwort' + Date.now()
    const nbs = await (await fetch(`${API}/v1/notebooks`, { headers: h(admin) })).json()
    expect(nbs.length).toBeGreaterThan(0)
    const nbId = nbs[0].id

    let r = await fetch(`${API}/v1/pages`, { method: 'POST', headers: j(admin), body: JSON.stringify({ notebookId: nbId, title: 'API-Test' }) })
    expect(r.status).toBe(200)
    const pageId = (await r.json()).id

    r = await fetch(`${API}/v1/pages/${pageId}`, { method: 'PUT', headers: j(admin), body: JSON.stringify({ contentMd: `# Test\n\nEnthält ${uniq}.` }) })
    expect(r.status).toBe(200)

    const page = await (await fetch(`${API}/v1/pages/${pageId}`, { headers: h(admin) })).json()
    expect(page.contentMd).toContain(uniq)

    const hits = await (await fetch(`${API}/v1/search?q=${uniq}`, { headers: h(admin) })).json()
    expect(hits.some((x) => x.pageId === pageId)).toBe(true)

    // Zweite Änderung → Versions-Snapshot des vorherigen Standes
    await fetch(`${API}/v1/pages/${pageId}`, { method: 'PUT', headers: j(admin), body: JSON.stringify({ contentMd: '# Test v2' }) })
    const versions = await (await fetch(`${API}/v1/pages/${pageId}/versions`, { headers: h(admin) })).json()
    expect(versions.length).toBeGreaterThanOrEqual(1)

    expect((await fetch(`${API}/v1/pages/${pageId}`, { method: 'DELETE', headers: h(admin) })).status).toBe(200)
  }, 25000)
})

describe('Favoriten', () => {
  it('markieren → listen → entfernen', async () => {
    const nbs = await (await fetch(`${API}/v1/notebooks`, { headers: h(admin) })).json()
    const tree = await (await fetch(`${API}/v1/notebooks/${nbs[0].id}/pages`, { headers: h(admin) })).json()
    const p = tree[0]
    expect(p).toBeTruthy()

    await fetch(`${API}/v1/favorites`, { method: 'POST', headers: j(admin), body: JSON.stringify({ pageId: p.id }) })
    let favs = await (await fetch(`${API}/v1/favorites`, { headers: h(admin) })).json()
    expect(favs.some((f) => f.pageId === p.id)).toBe(true)

    await fetch(`${API}/v1/favorites/${p.id}`, { method: 'DELETE', headers: h(admin) })
    favs = await (await fetch(`${API}/v1/favorites`, { headers: h(admin) })).json()
    expect(favs.some((f) => f.pageId === p.id)).toBe(false)
  }, 20000)
})

describe('Notizbuch löschen', () => {
  it('anlegen → löschen → weg (404 bei erneutem Löschen)', async () => {
    const title = 'DeleteNbTest' + Date.now()
    const created = await (await fetch(`${API}/v1/notebooks`, { method: 'POST', headers: j(admin), body: JSON.stringify({ title }) })).json()
    expect(created.id).toBeTruthy()

    // Seite anlegen, um den Cascade-Pfad mitzunehmen.
    await fetch(`${API}/v1/pages`, { method: 'POST', headers: j(admin), body: JSON.stringify({ notebookId: created.id, title: 'temp' }) })

    expect((await fetch(`${API}/v1/notebooks/${created.id}`, { method: 'DELETE', headers: h(admin) })).status).toBe(200)

    const after = await (await fetch(`${API}/v1/notebooks`, { headers: h(admin) })).json()
    expect(after.some((n) => n.id === created.id)).toBe(false)

    expect((await fetch(`${API}/v1/notebooks/${created.id}`, { method: 'DELETE', headers: h(admin) })).status).toBe(404)
  }, 25000)

  it('Nicht-Mitglied darf nicht löschen → 403', async () => {
    const title = 'DeleteNbForbidden' + Date.now()
    const created = await (await fetch(`${API}/v1/notebooks`, { method: 'POST', headers: j(admin), body: JSON.stringify({ title }) })).json()
    expect((await fetch(`${API}/v1/notebooks/${created.id}`, { method: 'DELETE', headers: h(member) })).status).toBe(403)
    // Aufräumen.
    await fetch(`${API}/v1/notebooks/${created.id}`, { method: 'DELETE', headers: h(admin) })
  }, 25000)
})

describe('Rollen pro Notizbuch', () => {
  it('Member (kein Mitglied, kein Admin) darf nicht schreiben → 403', async () => {
    const nbs = await (await fetch(`${API}/v1/notebooks`, { headers: h(admin) })).json()
    const r = await fetch(`${API}/v1/pages`, { method: 'POST', headers: j(member), body: JSON.stringify({ notebookId: nbs[0].id, title: 'verboten' }) })
    expect(r.status).toBe(403)
  })
})
