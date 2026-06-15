import { query } from './db.js'
import { requireAuth } from './auth.js'
import { requireNotebookRole } from './access.js'
import { reindexPageAsync } from './embeddings.js'
import { snapshotBeforeUpdate } from './versions.js'

function userName(req) {
  return req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
}

// notebook_id zu einer Seite ermitteln (für die Rollenprüfung). null = nicht gefunden.
async function notebookIdOfPage(pageId) {
  const { rows } = await query('SELECT notebook_id FROM pages WHERE id = $1', [pageId])
  return rows[0]?.notebook_id ?? null
}

export async function pageRoutes(app) {
  // Einzelne Seite mit Inhalt.
  app.get('/v1/pages/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query(
      `SELECT id, notebook_id, parent_id, title, content_md, updated_at, updated_by
       FROM pages WHERE id = $1`,
      [req.params.id],
    )
    const r = rows[0]
    if (!r) return reply.code(404).send({ error: 'not found' })
    // Erfordert mind. viewer (oder globaler Admin) auf dem Notizbuch der Seite.
    if (await requireNotebookRole(r.notebook_id, req, reply, 'viewer')) return
    return {
      id: r.id,
      notebookId: r.notebook_id,
      parentId: r.parent_id,
      title: r.title,
      contentMd: r.content_md,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }
  })

  // Seite anlegen. position = max+1 in der Ebene (gleicher notebook+parent).
  app.post('/v1/pages', { preHandler: requireAuth }, async (req, reply) => {
    const notebookId = req.body?.notebookId
    if (!notebookId) {
      return reply.code(400).send({ error: 'notebookId required' })
    }
    // Erfordert mind. editor (oder globaler Admin) auf dem Ziel-Notizbuch.
    if (await requireNotebookRole(notebookId, req, reply, 'editor')) return
    const parentId = req.body?.parentId ?? null
    const title = req.body?.title ?? 'Unbenannt'
    const by = userName(req)

    // Nächste Position in der Ebene ermitteln (NULL-sicherer parent-Vergleich).
    const pos = await query(
      `SELECT coalesce(max(position), -1) + 1 AS next
       FROM pages
       WHERE notebook_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [notebookId, parentId],
    )
    const position = pos.rows[0].next

    const { rows } = await query(
      `INSERT INTO pages (notebook_id, parent_id, title, position, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, notebook_id, parent_id, title, content_md`,
      [notebookId, parentId, title, position, by],
    )
    const r = rows[0]
    // Embeddings asynchron erzeugen (fire-and-forget), blockiert die Antwort nicht.
    reindexPageAsync(r.id, req.log)
    return {
      id: r.id,
      notebookId: r.notebook_id,
      parentId: r.parent_id,
      title: r.title,
      contentMd: r.content_md,
    }
  })

  // Seite aktualisieren (Autosave-Ziel). title und/oder contentMd.
  app.put('/v1/pages/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { title, contentMd } = req.body ?? {}
    if (title === undefined && contentMd === undefined) {
      return reply.code(400).send({ error: 'title or contentMd required' })
    }
    const by = userName(req)

    // Bisherigen Stand laden, um vor dem Update ggf. eine Version zu sichern
    // (Debounce gegen Autosave-Spam, siehe versions.js).
    const cur = await query(
      'SELECT notebook_id, title, content_md, updated_by FROM pages WHERE id = $1',
      [req.params.id],
    )
    if (!cur.rows[0]) return reply.code(404).send({ error: 'not found' })
    // Erfordert mind. editor (oder globaler Admin) auf dem Notizbuch der Seite.
    if (await requireNotebookRole(cur.rows[0].notebook_id, req, reply, 'editor')) return
    await snapshotBeforeUpdate(req.params.id, cur.rows[0], { title, contentMd })

    const { rows } = await query(
      `UPDATE pages SET
         title = COALESCE($2, title),
         content_md = COALESCE($3, content_md),
         updated_by = $4,
         updated_at = now()
       WHERE id = $1
       RETURNING updated_at`,
      [req.params.id, title ?? null, contentMd ?? null, by],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'not found' })
    // Nach erfolgreichem Speichern Embeddings asynchron aktualisieren.
    reindexPageAsync(req.params.id, req.log)
    return { ok: true, updatedAt: rows[0].updated_at }
  })

  // Seite verschieben (anderer parent und/oder andere position).
  app.post('/v1/pages/:id/move', { preHandler: requireAuth }, async (req, reply) => {
    const { parentId, position } = req.body ?? {}
    if (position === undefined || position === null) {
      return reply.code(400).send({ error: 'position required' })
    }
    // Erfordert mind. editor (oder globaler Admin) auf dem Notizbuch der Seite.
    const nbId = await notebookIdOfPage(req.params.id)
    if (!nbId) return reply.code(404).send({ error: 'not found' })
    if (await requireNotebookRole(nbId, req, reply, 'editor')) return
    const { rows } = await query(
      `UPDATE pages SET parent_id = $2, position = $3
       WHERE id = $1 RETURNING id`,
      [req.params.id, parentId ?? null, position],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })

  // Seite löschen (Kinder folgen via ON DELETE CASCADE).
  app.delete('/v1/pages/:id', { preHandler: requireAuth }, async (req, reply) => {
    // Erfordert mind. editor (oder globaler Admin) auf dem Notizbuch der Seite.
    const nbId = await notebookIdOfPage(req.params.id)
    if (!nbId) return reply.code(404).send({ error: 'not found' })
    if (await requireNotebookRole(nbId, req, reply, 'editor')) return
    const { rows } = await query(
      'DELETE FROM pages WHERE id = $1 RETURNING id',
      [req.params.id],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}
