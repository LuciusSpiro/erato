import JSZip from 'jszip'
import { query } from './db.js'
import { requireAuth } from './auth.js'
import { requireNotebookRole, isGlobalAdmin, userKey } from './access.js'
import { reindexPageAsync } from './embeddings.js'
import { notebookRows, createPageRow } from './pagesRepo.js'
import {
  slugify, buildTree, findNode, pageMarkdown, zipFromNodes, zipFromNotebooks, titleFromMd,
} from './exportmd.js'

const wantsSubpages = (q) => q?.subpages === '1' || q?.subpages === 'true'

function sendZip(reply, buf, filename) {
  reply.header('Content-Type', 'application/zip')
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  return reply.send(buf)
}

// ZIP-Import: Ordnerstruktur → Seitenbaum (index.md = Seite des Ordners).
async function importZip(zip, notebookId, parentId, by, log) {
  const root = { dirs: new Map(), files: [] }
  for (const [p, f] of Object.entries(zip.files)) {
    if (f.dir || !/\.md$/i.test(p)) continue
    const parts = p.split('/').filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]
      if (!node.dirs.has(seg)) node.dirs.set(seg, { dirs: new Map(), files: [] })
      node = node.dirs.get(seg)
    }
    node.files.push({ name: parts[parts.length - 1], path: p })
  }

  let count = 0
  const createLevel = async (node, parent) => {
    for (const file of node.files) {
      if (file.name.toLowerCase() === 'index.md') continue
      const text = await zip.files[file.path].async('string')
      const id = await createPageRow(notebookId, parent, titleFromMd(text, file.name), text, by)
      reindexPageAsync(id, log); count++
    }
    for (const [dirName, child] of node.dirs) {
      const index = child.files.find((f) => f.name.toLowerCase() === 'index.md')
      const text = index ? await zip.files[index.path].async('string') : ''
      const title = index ? titleFromMd(text, dirName) : dirName
      const id = await createPageRow(notebookId, parent, title, text, by)
      reindexPageAsync(id, log); count++
      await createLevel(child, id)
    }
  }
  await createLevel(root, parentId)
  return count
}

export async function exportRoutes(app) {
  // Einzelseite (.md) oder Teilbaum (?subpages=1 → ZIP).
  app.get('/v1/pages/:id/export', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query('SELECT id, notebook_id, title, content_md FROM pages WHERE id = $1', [req.params.id])
    const p = rows[0]
    if (!p) return reply.code(404).send({ error: 'not found' })
    if (await requireNotebookRole(p.notebook_id, req, reply, 'viewer')) return

    if (wantsSubpages(req.query)) {
      const tree = buildTree(await notebookRows(p.notebook_id))
      const node = findNode(tree, p.id)
      const buf = await zipFromNodes(node ? [node] : [])
      return sendZip(reply, buf, `${slugify(p.title)}.zip`)
    }
    reply.header('Content-Type', 'text/markdown; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${slugify(p.title)}.md"`)
    return reply.send(pageMarkdown({ title: p.title, contentMd: p.content_md }))
  })

  // Notizbuch → ZIP.
  app.get('/v1/notebooks/:id/export', { preHandler: requireAuth }, async (req, reply) => {
    if (await requireNotebookRole(req.params.id, req, reply, 'viewer')) return
    const nb = (await query('SELECT id, title FROM notebooks WHERE id = $1', [req.params.id])).rows[0]
    if (!nb) return reply.code(404).send({ error: 'not found' })
    const buf = await zipFromNodes(buildTree(await notebookRows(nb.id)))
    return sendZip(reply, buf, `${slugify(nb.title)}.zip`)
  })

  // Alles (zugängliche Notizbücher) → ZIP, ein Ordner pro Notizbuch.
  app.get('/v1/export', { preHandler: requireAuth }, async (req, reply) => {
    const nbs = isGlobalAdmin(req)
      ? (await query('SELECT id, title FROM notebooks ORDER BY created_at')).rows
      : (await query(
          `SELECT n.id, n.title FROM notebooks n
           JOIN notebook_members m ON m.notebook_id = n.id WHERE m.user_sub = $1 ORDER BY n.created_at`,
          [userKey(req)],
        )).rows
    const notebooks = []
    for (const nb of nbs) notebooks.push({ title: nb.title, pages: buildTree(await notebookRows(nb.id)) })
    return sendZip(reply, await zipFromNotebooks(notebooks), 'erato-export.zip')
  })

  // Import (.md oder .zip) in ein Ziel-Notizbuch (+ optional Elternseite).
  app.post('/v1/import', { preHandler: requireAuth }, async (req, reply) => {
    const notebookId = req.query.notebookId
    const parentId = req.query.parentId || null
    if (!notebookId) return reply.code(400).send({ error: 'notebookId required' })
    if (await requireNotebookRole(notebookId, req, reply, 'editor')) return
    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file required' })
    const buf = await file.toBuffer()
    const name = file.filename || 'import'
    const by = userKey(req)

    let created = 0
    if (/\.zip$/i.test(name)) {
      created = await importZip(await JSZip.loadAsync(buf), notebookId, parentId, by, req.log)
    } else {
      const text = buf.toString('utf8')
      const id = await createPageRow(notebookId, parentId, titleFromMd(text, name), text, by)
      reindexPageAsync(id, req.log); created = 1
    }
    return { ok: true, created }
  })
}
