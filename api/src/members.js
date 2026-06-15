import { query } from './db.js'
import { requireAuth } from './auth.js'
import { roleFor } from './access.js'

// Guard: nur owner des Notizbuchs oder globaler Admin dürfen Mitglieder verwalten.
// Liefert true, wenn berechtigt; sonst wurde bereits eine 403 gesendet.
async function requireOwnerOrAdmin(notebookId, req, reply) {
  const role = await roleFor(notebookId, req)
  if (role === 'admin' || role === 'owner') return true
  reply.code(403).send({ error: 'forbidden' })
  return false
}

export async function memberRoutes(app) {
  // Mitglieder eines Notizbuchs auflisten (owner oder globaler Admin).
  app.get('/v1/notebooks/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    if (!(await requireOwnerOrAdmin(req.params.id, req, reply))) return
    const { rows } = await query(
      `SELECT user_sub, user_name, role
       FROM notebook_members WHERE notebook_id = $1
       ORDER BY created_at`,
      [req.params.id],
    )
    return rows.map((r) => ({ userSub: r.user_sub, userName: r.user_name, role: r.role }))
  })

  // Mitglied hinzufügen/aktualisieren (owner oder globaler Admin).
  // Pragmatisch ohne User-Directory: user_sub = userName.
  app.put('/v1/notebooks/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    if (!(await requireOwnerOrAdmin(req.params.id, req, reply))) return
    const userName = req.body?.userName
    const role = req.body?.role
    if (!userName || typeof userName !== 'string') {
      return reply.code(400).send({ error: 'userName required' })
    }
    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return reply.code(400).send({ error: 'role must be owner|editor|viewer' })
    }
    // Notizbuch muss existieren (sonst FK-Fehler / verwaiste Mitgliedschaft).
    const nb = await query('SELECT id FROM notebooks WHERE id = $1', [req.params.id])
    if (!nb.rows[0]) return reply.code(404).send({ error: 'not found' })

    await query(
      `INSERT INTO notebook_members (notebook_id, user_sub, user_name, role)
       VALUES ($1, $2, $2, $3)
       ON CONFLICT (notebook_id, user_sub)
       DO UPDATE SET role = EXCLUDED.role, user_name = EXCLUDED.user_name`,
      [req.params.id, userName, role],
    )
    return { ok: true }
  })

  // Mitglied entfernen (owner oder globaler Admin). Der letzte owner darf nicht
  // entfernt werden, damit das Notizbuch nicht ohne Eigentümer dasteht.
  app.delete(
    '/v1/notebooks/:id/members/:userSub',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (!(await requireOwnerOrAdmin(req.params.id, req, reply))) return
      const { id, userSub } = req.params

      const target = await query(
        'SELECT role FROM notebook_members WHERE notebook_id = $1 AND user_sub = $2',
        [id, userSub],
      )
      if (!target.rows[0]) return reply.code(404).send({ error: 'not found' })

      // Letzten owner schützen.
      if (target.rows[0].role === 'owner') {
        const owners = await query(
          `SELECT count(*)::int AS n FROM notebook_members
           WHERE notebook_id = $1 AND role = 'owner'`,
          [id],
        )
        if (owners.rows[0].n <= 1) {
          return reply.code(409).send({ error: 'cannot remove last owner' })
        }
      }

      await query(
        'DELETE FROM notebook_members WHERE notebook_id = $1 AND user_sub = $2',
        [id, userSub],
      )
      return { ok: true }
    },
  )
}
