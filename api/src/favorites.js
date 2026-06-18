import { query } from './db.js'
import { requireAuth } from './auth.js'
import { userKey } from './access.js'

// Favoriten pro Nutzer. Identifikator = userKey (preferred_username/sub).
export async function favoriteRoutes(app) {
  // Favoriten des Nutzers (mit Seitentitel + Notizbuch).
  app.get('/v1/favorites', { preHandler: requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT f.page_id, p.title, p.notebook_id, n.title AS notebook_title
       FROM favorites f
       JOIN pages p ON p.id = f.page_id
       JOIN notebooks n ON n.id = p.notebook_id
       WHERE f.user_sub = $1
       ORDER BY f.created_at DESC`,
      [userKey(req)],
    )
    return rows.map((r) => ({
      pageId: r.page_id, title: r.title, notebookId: r.notebook_id, notebookTitle: r.notebook_title,
    }))
  })

  // Seite als Favorit markieren.
  app.post('/v1/favorites', { preHandler: requireAuth }, async (req, reply) => {
    const pageId = req.body?.pageId
    if (!pageId) return reply.code(400).send({ error: 'pageId required' })
    await query(
      `INSERT INTO favorites (user_sub, page_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userKey(req), pageId],
    )
    return { ok: true }
  })

  // Favorit entfernen.
  app.delete('/v1/favorites/:pageId', { preHandler: requireAuth }, async (req) => {
    await query('DELETE FROM favorites WHERE user_sub = $1 AND page_id = $2', [userKey(req), req.params.pageId])
    return { ok: true }
  })
}
