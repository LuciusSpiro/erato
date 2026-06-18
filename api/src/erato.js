import { query } from './db.js'
import { requireAuth } from './auth.js'
import { requireNotebookRole, isGlobalAdmin, userKey } from './access.js'
import { reindexPageAsync } from './embeddings.js'
import { notebookRows, createPageRow } from './pagesRepo.js'
import { slugify, buildTree, toEratoNodes, remapLinks } from './exportmd.js'

function sendJson(reply, obj, filename) {
  reply.header('Content-Type', 'application/json; charset=utf-8')
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  return reply.send(JSON.stringify(obj, null, 2))
}

async function eratoNotebook(nb) {
  return { title: nb.title, icon: nb.icon, pages: toEratoNodes(buildTree(await notebookRows(nb.id))) }
}

export async function eratoRoutes(app) {
  // Einzelnes Notizbuch als 1:1-JSON-Bündel.
  app.get('/v1/notebooks/:id/export/erato', { preHandler: requireAuth }, async (req, reply) => {
    if (await requireNotebookRole(req.params.id, req, reply, 'viewer')) return
    const nb = (await query('SELECT id, title, icon FROM notebooks WHERE id = $1', [req.params.id])).rows[0]
    if (!nb) return reply.code(404).send({ error: 'not found' })
    const bundle = { version: 1, type: 'erato-export', notebooks: [await eratoNotebook(nb)] }
    return sendJson(reply, bundle, `${slugify(nb.title)}.erato.json`)
  })

  // Komplette (zugängliche) Instanz als 1:1-JSON-Bündel.
  app.get('/v1/export/erato', { preHandler: requireAuth }, async (req, reply) => {
    const nbs = isGlobalAdmin(req)
      ? (await query('SELECT id, title, icon FROM notebooks ORDER BY created_at')).rows
      : (await query(
          `SELECT n.id, n.title, n.icon FROM notebooks n
           JOIN notebook_members m ON m.notebook_id = n.id WHERE m.user_sub = $1 ORDER BY n.created_at`,
          [userKey(req)],
        )).rows
    const notebooks = []
    for (const nb of nbs) notebooks.push(await eratoNotebook(nb))
    return sendJson(reply, { version: 1, type: 'erato-export', notebooks }, 'erato-export.erato.json')
  })

  // 1:1-Import "als Kopie": neue Notizbücher/Seiten, interne Links auf neue IDs umgeschrieben.
  app.post('/v1/import/erato', { preHandler: requireAuth }, async (req, reply) => {
    let bundle = req.body
    if (req.isMultipart?.()) {
      const f = await req.file()
      if (!f) return reply.code(400).send({ error: 'file required' })
      try { bundle = JSON.parse((await f.toBuffer()).toString('utf8')) } catch { return reply.code(400).send({ error: 'invalid json' }) }
    }
    if (!bundle || !Array.isArray(bundle.notebooks)) return reply.code(400).send({ error: 'invalid bundle' })

    const by = userKey(req)
    const idMap = new Map()       // oldId -> newId (für Link-Remap)
    const newPageIds = []

    for (const nb of bundle.notebooks) {
      const newNb = (await query(
        'INSERT INTO notebooks (title, icon, created_by) VALUES ($1, $2, $3) RETURNING id',
        [nb.title || 'Importiert', nb.icon ?? null, by],
      )).rows[0].id
      await query(
        `INSERT INTO notebook_members (notebook_id, user_sub, user_name, role)
         VALUES ($1, $2, $2, 'owner') ON CONFLICT DO NOTHING`,
        [newNb, by],
      )
      const createNode = async (node, parent) => {
        const newId = await createPageRow(newNb, parent, node.title, node.contentMd, by)
        if (node.id) idMap.set(node.id, newId)
        newPageIds.push(newId)
        for (const c of node.children ?? []) await createNode(c, newId)
      }
      for (const node of nb.pages ?? []) await createNode(node, null)
    }

    // Zweiter Pass: interne Links auf die neuen IDs umschreiben.
    for (const id of newPageIds) {
      const cur = (await query('SELECT content_md FROM pages WHERE id = $1', [id])).rows[0]?.content_md ?? ''
      const remapped = remapLinks(cur, idMap)
      if (remapped !== cur) await query('UPDATE pages SET content_md = $2 WHERE id = $1', [id, remapped])
      reindexPageAsync(id, req.log)
    }

    return { ok: true, notebooks: bundle.notebooks.length, pages: newPageIds.length }
  })
}
