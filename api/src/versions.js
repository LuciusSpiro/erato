import { query } from './db.js'
import { requireAuth } from './auth.js'
import { reindexPageAsync } from './embeddings.js'

function userName(req) {
  return req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
}

// Debounce-Fenster: max. ~1 Version alle 2 Minuten pro Seite.
const DEBOUNCE_MS = 2 * 60 * 1000

// Sichert den BISHERIGEN Stand einer Seite als Version, BEVOR sie überschrieben wird.
// Aufruf vor dem UPDATE in PUT /v1/pages/:id.
//
// Regeln:
//  - Nur sichern, wenn sich title oder content_md tatsächlich ändert.
//  - Debounce: neue Version nur, wenn die jüngste Version dieser Seite älter als
//    DEBOUNCE_MS ist ODER noch keine existiert.
//
// `current` = aktuelle DB-Zeile { title, content_md, updated_by } VOR dem Update.
// `next`    = die eingehenden Werte { title, contentMd } (undefined = unverändert).
export async function snapshotBeforeUpdate(pageId, current, next) {
  const nextTitle = next.title ?? current.title
  const nextContent = next.contentMd ?? current.content_md
  const changed = nextTitle !== current.title || nextContent !== current.content_md
  if (!changed) return

  const { rows } = await query(
    `SELECT edited_at FROM page_versions
     WHERE page_id = $1
     ORDER BY edited_at DESC
     LIMIT 1`,
    [pageId],
  )
  const last = rows[0]
  if (last) {
    const ageMs = Date.now() - new Date(last.edited_at).getTime()
    if (ageMs < DEBOUNCE_MS) return
  }

  await query(
    `INSERT INTO page_versions (page_id, title, content_md, edited_by)
     VALUES ($1, $2, $3, $4)`,
    [pageId, current.title, current.content_md, current.updated_by],
  )
}

export async function versionRoutes(app) {
  // Versionsliste (neueste zuerst).
  app.get('/v1/pages/:id/versions', { preHandler: requireAuth }, async (req, reply) => {
    const page = await query('SELECT id FROM pages WHERE id = $1', [req.params.id])
    if (!page.rows[0]) return reply.code(404).send({ error: 'not found' })

    const { rows } = await query(
      `SELECT id, title, edited_by, edited_at
       FROM page_versions
       WHERE page_id = $1
       ORDER BY edited_at DESC
       LIMIT 50`,
      [req.params.id],
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      editedBy: r.edited_by,
      editedAt: r.edited_at,
    }))
  })

  // Einzelne Version mit Inhalt.
  app.get('/v1/pages/:id/versions/:versionId', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query(
      `SELECT id, title, content_md, edited_at
       FROM page_versions
       WHERE id = $1 AND page_id = $2`,
      [req.params.versionId, req.params.id],
    )
    const r = rows[0]
    if (!r) return reply.code(404).send({ error: 'not found' })
    return {
      id: r.id,
      title: r.title,
      contentMd: r.content_md,
      editedAt: r.edited_at,
    }
  })

  // Seite auf eine frühere Version zurücksetzen. Sichert vorher den aktuellen
  // Stand als Version (damit nichts verloren geht), aktualisiert die Seite und
  // stößt reindex an.
  app.post(
    '/v1/pages/:id/versions/:versionId/restore',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ver = await query(
        `SELECT title, content_md FROM page_versions
         WHERE id = $1 AND page_id = $2`,
        [req.params.versionId, req.params.id],
      )
      const v = ver.rows[0]
      if (!v) return reply.code(404).send({ error: 'not found' })

      const cur = await query(
        'SELECT title, content_md, updated_by FROM pages WHERE id = $1',
        [req.params.id],
      )
      const c = cur.rows[0]
      if (!c) return reply.code(404).send({ error: 'not found' })

      const by = userName(req)

      // Aktuellen Stand sichern, falls er sich vom Restore-Ziel unterscheidet.
      if (c.title !== v.title || c.content_md !== v.content_md) {
        await query(
          `INSERT INTO page_versions (page_id, title, content_md, edited_by)
           VALUES ($1, $2, $3, $4)`,
          [req.params.id, c.title, c.content_md, c.updated_by],
        )
      }

      const { rows } = await query(
        `UPDATE pages SET
           title = $2,
           content_md = $3,
           updated_by = $4,
           updated_at = now()
         WHERE id = $1
         RETURNING updated_at`,
        [req.params.id, v.title, v.content_md, by],
      )
      reindexPageAsync(req.params.id, req.log)
      return { ok: true, updatedAt: rows[0].updated_at }
    },
  )
}
