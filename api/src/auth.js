import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from './config.js'

// JWKS von Keycloak (lazy; wird beim ersten geschützten Request geladen).
// jwksUri kann intern (keycloak:8080) abweichen vom issuer (localhost:8085).
const JWKS = createRemoteJWKSet(new URL(config.oidc.jwksUri))

async function verify(token) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: config.oidc.issuer })
  return payload
}

function bearer(req) {
  const h = req.headers.authorization ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

// Fastify preHandler: erfordert einen gültigen Token (eingeloggt).
export async function requireAuth(req, reply) {
  const token = bearer(req)
  if (!token) return reply.code(401).send({ error: 'no token' })
  try {
    req.user = await verify(token)
  } catch (err) {
    req.log.warn({ err: err.message }, 'token verify failed')
    return reply.code(401).send({ error: 'invalid token' })
  }
}

// Fastify preHandler: erfordert die Admin-Rolle (darf Branding ändern).
export async function requireAdmin(req, reply) {
  await requireAuth(req, reply)
  if (reply.sent) return
  const roles = req.user?.realm_access?.roles ?? []
  if (!roles.includes(config.oidc.adminRole)) {
    return reply.code(403).send({ error: 'admin role required' })
  }
}
