import { describe, it, expect, beforeAll } from 'vitest'
import JSZip from 'jszip'

const API = process.env.API_URL || 'http://localhost:3001'
const KC = process.env.KC_TOKEN_URL || 'http://localhost:8085/realms/erato/protocol/openid-connect/token'

async function getToken(u, p) {
  const r = await fetch(KC, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'erato-web', grant_type: 'password', username: u, password: p, scope: 'openid' }),
  })
  return (await r.json()).access_token
}
const h = (t) => ({ Authorization: `Bearer ${t}` })                       // GET/DELETE
const j = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }) // POST/PUT

let token, engId
beforeAll(async () => {
  token = await getToken('kai', 'erato')
  const nbs = await (await fetch(`${API}/v1/notebooks`, { headers: h(token) })).json()
  engId = nbs[0].id
}, 20000)

describe('Markdown-Export', () => {
  it('Einzelseite liefert .md mit Titel + Inhalt', async () => {
    const uniq = 'ExportWort' + Date.now()
    const pid = (await (await fetch(`${API}/v1/pages`, { method: 'POST', headers: j(token), body: JSON.stringify({ notebookId: engId, title: 'MD-Export' }) })).json()).id
    await fetch(`${API}/v1/pages/${pid}`, { method: 'PUT', headers: j(token), body: JSON.stringify({ contentMd: `# MD-Export\n\n${uniq}` }) })

    const res = await fetch(`${API}/v1/pages/${pid}/export`, { headers: h(token) })
    expect(res.headers.get('content-type')).toContain('text/markdown')
    const md = await res.text()
    expect(md).toContain('# MD-Export')
    expect(md).toContain(uniq)

    await fetch(`${API}/v1/pages/${pid}`, { method: 'DELETE', headers: h(token) })
  }, 20000)

  it('Notizbuch liefert gültiges ZIP mit .md-Einträgen', async () => {
    const res = await fetch(`${API}/v1/notebooks/${engId}/export`, { headers: h(token) })
    expect(res.headers.get('content-type')).toContain('application/zip')
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()))
    const mdFiles = Object.keys(zip.files).filter((f) => f.endsWith('.md'))
    expect(mdFiles.length).toBeGreaterThan(0)
  }, 20000)
})

describe('Markdown-Import (ZIP)', () => {
  it('rekonstruiert den Baum aus der Ordnerstruktur', async () => {
    const root = 'ImportTest' + Date.now()
    const zip = new JSZip()
    zip.file(`${root}/index.md`, `# ${root}\n\nWurzel`)
    zip.file(`${root}/kind.md`, '# Kind\n\nInhalt')
    const buf = await zip.generateAsync({ type: 'nodebuffer' })

    const fd = new FormData()
    fd.append('file', new Blob([buf]), 'import.zip')
    const imp = await (await fetch(`${API}/v1/import?notebookId=${engId}`, { method: 'POST', headers: h(token), body: fd })).json()
    expect(imp.created).toBe(2)

    const tree = await (await fetch(`${API}/v1/notebooks/${engId}/pages`, { headers: h(token) })).json()
    const rootNode = tree.find((p) => p.title === root)
    expect(rootNode).toBeTruthy()
    expect(rootNode.children.some((c) => c.title === 'Kind')).toBe(true)

    await fetch(`${API}/v1/pages/${rootNode.id}`, { method: 'DELETE', headers: h(token) })
  }, 25000)
})

describe('Erato 1:1', () => {
  it('Export erhält Highlights byte-genau', async () => {
    const content = '# HL\n\nText mit <mark data-color="#FFF3BF">Markierung</mark>.'
    const pid = (await (await fetch(`${API}/v1/pages`, { method: 'POST', headers: j(token), body: JSON.stringify({ notebookId: engId, title: 'EratoHL' }) })).json()).id
    await fetch(`${API}/v1/pages/${pid}`, { method: 'PUT', headers: j(token), body: JSON.stringify({ contentMd: content }) })

    const bundle = await (await fetch(`${API}/v1/notebooks/${engId}/export/erato`, { headers: h(token) })).json()
    const findNode = (nodes) => nodes.reduce((acc, n) => acc || (n.id === pid ? n : findNode(n.children || [])), null)
    const node = findNode(bundle.notebooks[0].pages)
    expect(node.contentMd).toBe(content) // byte-genau, Highlight erhalten

    await fetch(`${API}/v1/pages/${pid}`, { method: 'DELETE', headers: h(token) })
  }, 20000)

  it('Import als Kopie erhält Highlight und mappt interne Links auf neue IDs', async () => {
    const nbTitle = 'EratoImport' + Date.now()
    const bundle = {
      version: 1, type: 'erato-export',
      notebooks: [{
        title: nbTitle, icon: 'Code2',
        pages: [{
          id: 'old-1', title: 'Eltern', position: 0,
          contentMd: '# Eltern\n\n<mark data-color="#D0EBFF">blau</mark> siehe [Kind](#/page/old-2).',
          children: [{ id: 'old-2', title: 'Kind', position: 0, contentMd: '# Kind', children: [] }],
        }],
      }],
    }
    const imp = await (await fetch(`${API}/v1/import/erato`, { method: 'POST', headers: j(token), body: JSON.stringify(bundle) })).json()
    expect(imp.ok).toBe(true)
    expect(imp.pages).toBe(2)

    const nbs = await (await fetch(`${API}/v1/notebooks`, { headers: h(token) })).json()
    const nb = nbs.find((n) => n.title === nbTitle)
    expect(nb).toBeTruthy()
    const tree = await (await fetch(`${API}/v1/notebooks/${nb.id}/pages`, { headers: h(token) })).json()
    const parent = tree.find((p) => p.title === 'Eltern')
    const child = parent.children.find((c) => c.title === 'Kind')

    const page = await (await fetch(`${API}/v1/pages/${parent.id}`, { headers: h(token) })).json()
    expect(page.contentMd).toContain('<mark data-color="#D0EBFF">blau</mark>') // Highlight erhalten
    expect(page.contentMd).toContain(`#/page/${child.id}`)                      // auf neue id gemappt
    expect(page.contentMd).not.toContain('old-2')                              // alte id weg

    // Aufräumen: das beim Import neu angelegte Notizbuch komplett entfernen
    // (Seiten/Members cascaden), damit Tests keine Reste im Account hinterlassen.
    const del = await fetch(`${API}/v1/notebooks/${nb.id}`, { method: 'DELETE', headers: h(token) })
    expect(del.ok).toBe(true)
    const after = await (await fetch(`${API}/v1/notebooks`, { headers: h(token) })).json()
    expect(after.some((n) => n.id === nb.id)).toBe(false)
  }, 25000)
})
