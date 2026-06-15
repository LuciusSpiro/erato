import { query } from './db.js'
import { requireAuth } from './auth.js'
import { isGlobalAdmin, userKey, requireNotebookRole } from './access.js'

// Aktueller Benutzername aus dem Token (für created_by/updated_by).
function userName(req) {
  return req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
}

// Baut aus einer flachen Liste von Seiten einen verschachtelten Baum.
// Jede Seite: {id, title, parentId, position, children:[...]}, sortiert nach position.
function buildTree(rows) {
  const byId = new Map()
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      title: r.title,
      parentId: r.parent_id,
      position: r.position,
      children: [],
    })
  }
  const roots = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => a.position - b.position)
    for (const n of nodes) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

export async function notebookRoutes(app) {
  // Liste der Notizbücher: globale Admins sehen ALLE, sonst nur die, in denen
  // der User Mitglied ist (notebook_members).
  app.get('/v1/notebooks', { preHandler: requireAuth }, async (req) => {
    let rows
    if (isGlobalAdmin(req)) {
      ;({ rows } = await query(
        'SELECT id, title, icon FROM notebooks ORDER BY created_at',
      ))
    } else {
      ;({ rows } = await query(
        `SELECT n.id, n.title, n.icon
         FROM notebooks n
         JOIN notebook_members m ON m.notebook_id = n.id
         WHERE m.user_sub = $1
         ORDER BY n.created_at`,
        [userKey(req)],
      ))
    }
    return rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon }))
  })

  // Notizbuch anlegen.
  app.post('/v1/notebooks', { preHandler: requireAuth }, async (req, reply) => {
    const title = req.body?.title
    if (!title || typeof title !== 'string') {
      return reply.code(400).send({ error: 'title required' })
    }
    const icon = req.body?.icon ?? null
    const { rows } = await query(
      `INSERT INTO notebooks (title, icon, created_by)
       VALUES ($1, $2, $3) RETURNING id, title, icon`,
      [title, icon, userName(req)],
    )
    const r = rows[0]
    // Ersteller automatisch als owner eintragen (user_sub = userKey).
    await query(
      `INSERT INTO notebook_members (notebook_id, user_sub, user_name, role)
       VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (notebook_id, user_sub) DO NOTHING`,
      [r.id, userKey(req), req.user?.preferred_username ?? userKey(req)],
    )
    return { id: r.id, title: r.title, icon: r.icon }
  })

  // Seitenbaum eines Notizbuchs. Erfordert mind. viewer (oder globaler Admin).
  app.get('/v1/notebooks/:id/pages', { preHandler: requireAuth }, async (req, reply) => {
    if (await requireNotebookRole(req.params.id, req, reply, 'viewer')) return
    const { rows } = await query(
      `SELECT id, title, parent_id, position
       FROM pages WHERE notebook_id = $1
       ORDER BY position`,
      [req.params.id],
    )
    return buildTree(rows)
  })
}
