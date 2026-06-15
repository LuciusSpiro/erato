import { query } from './db.js'
import { config } from './config.js'

// Rangordnung der Notebook-Rollen. 'admin' (globaler Admin) steht über allem.
const RANK = { viewer: 1, editor: 2, owner: 3, admin: 4 }

// true, wenn der User die globale Admin-Realm-Rolle trägt (Bypass für alles).
export function isGlobalAdmin(req) {
  const roles = req.user?.realm_access?.roles ?? []
  return roles.includes(config.oidc.adminRole)
}

// Identifikator des Users für die Mitgliedschaft. preferred_username bevorzugt,
// sub als Fallback. Wird sowohl als user_sub gespeichert als auch zum Matchen genutzt.
export function userKey(req) {
  return req.user?.preferred_username ?? req.user?.sub
}

// Liefert die effektive Rolle des Users für ein Notizbuch:
//   'admin'  -> globaler Admin (Bypass)
//   'owner' | 'editor' | 'viewer' -> Mitgliedsrolle
//   null     -> kein Zugriff
export async function roleFor(notebookId, req) {
  if (isGlobalAdmin(req)) return 'admin'
  const { rows } = await query(
    'SELECT role FROM notebook_members WHERE notebook_id = $1 AND user_sub = $2',
    [notebookId, userKey(req)],
  )
  return rows[0]?.role ?? null
}

// Komfort-Guard: prüft, ob der User mind. minRole auf dem Notizbuch hat.
// Sendet bei unzureichendem Zugriff eine 403 und liefert das reply-Objekt zurück;
// bei ausreichendem Zugriff null (Aufrufer kann normal weitermachen).
export async function requireNotebookRole(notebookId, req, reply, minRole) {
  const role = await roleFor(notebookId, req)
  if (!role || RANK[role] < RANK[minRole]) {
    return reply.code(403).send({ error: 'forbidden' })
  }
  return null
}
