import { query } from './db.js'
import { config } from './config.js'
import { putLogo, getObject } from './storage.js'
import { requireAdmin } from './auth.js'

const DEFAULT_APP = '_default'

async function readRow(appId) {
  const { rows } = await query('SELECT * FROM branding.config WHERE app_id = $1', [appId])
  return rows[0] ?? null
}

// Merge: instanz-weit (_default) <- app-spezifisch. App-Werte überschreiben.
function mergeTokens(base, override) {
  return { ...(base ?? {}), ...(override ?? {}) }
}

// Logo-Schlüssel auflösen (app-spezifisch vor instanz-weit).
function resolveLogoKey(defaultRow, appRow, mode) {
  const col = mode === 'dark' ? 'logo_dark_key' : 'logo_key'
  return appRow?.[col] ?? defaultRow?.[col] ?? null
}

// Logo-URLs zeigen auf die API (die streamt aus MinIO), nicht direkt auf MinIO.
function logoFrom(defaultRow, appRow, appId) {
  const q = appId ? `?app=${encodeURIComponent(appId)}` : ''
  const sep = q ? '&' : '?'
  const url = (mode) =>
    resolveLogoKey(defaultRow, appRow, mode)
      ? `${config.apiPublicUrl}/v1/branding/logo${q}${sep}mode=${mode}`
      : null
  return { light: url('light'), dark: url('dark') }
}

export async function brandingRoutes(app) {
  // Öffentlich: Theme + Logo, damit auch die Login-Seite gebrandet ist.
  app.get('/v1/branding', async (req) => {
    const appId = req.query.app ?? null
    const def = await readRow(DEFAULT_APP)
    const appRow = appId ? await readRow(appId) : null
    return {
      app: appId,
      tokens: mergeTokens(def?.tokens, appRow?.tokens),
      logo: logoFrom(def, appRow, appId),
      updatedAt: appRow?.updated_at ?? def?.updated_at ?? null,
    }
  })

  // Öffentlich: Logo streamen (aus MinIO über die API, damit der Browser es laden kann).
  app.get('/v1/branding/logo', async (req, reply) => {
    const appId = req.query.app ?? null
    const mode = req.query.mode === 'dark' ? 'dark' : 'light'
    const def = await readRow(DEFAULT_APP)
    const appRow = appId ? await readRow(appId) : null
    const key = resolveLogoKey(def, appRow, mode)
    if (!key) return reply.code(404).send({ error: 'no logo' })
    try {
      const { stream, contentType } = await getObject(key)
      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=300')
      return reply.send(stream)
    } catch (err) {
      req.log.warn({ err: err.message, key }, 'logo fetch failed')
      return reply.code(404).send({ error: 'logo unavailable' })
    }
  })

  // Geschützt (Admin): Tokens setzen. app=… optionaler App-Override, sonst instanz-weit.
  app.put('/v1/branding', { preHandler: requireAdmin }, async (req, reply) => {
    const appId = req.query.app ?? DEFAULT_APP
    const tokens = req.body?.tokens
    if (!tokens || typeof tokens !== 'object') {
      return reply.code(400).send({ error: 'tokens object required' })
    }
    const by = req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
    await query(
      `INSERT INTO branding.config (app_id, tokens, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (app_id) DO UPDATE SET tokens = EXCLUDED.tokens,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [appId, JSON.stringify(tokens), by],
    )
    return { ok: true, app: appId }
  })

  // Geschützt (Admin): Logo-Upload (multipart). mode=light|dark.
  app.post('/v1/branding/logo', { preHandler: requireAdmin }, async (req, reply) => {
    const appId = req.query.app ?? DEFAULT_APP
    const mode = req.query.mode === 'dark' ? 'dark' : 'light'
    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file required' })

    const buf = await file.toBuffer()
    const ext = (file.filename?.split('.').pop() ?? 'png').toLowerCase()
    const key = `${appId}/logo-${mode}.${ext}`
    await putLogo(key, buf, file.mimetype ?? 'application/octet-stream')

    const col = mode === 'dark' ? 'logo_dark_key' : 'logo_key'
    const by = req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
    await query(
      `INSERT INTO branding.config (app_id, ${col}, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (app_id) DO UPDATE SET ${col} = EXCLUDED.${col},
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [appId, key, by],
    )
    const q = appId !== DEFAULT_APP ? `?app=${encodeURIComponent(appId)}&` : '?'
    return { ok: true, app: appId, mode, url: `${config.apiPublicUrl}/v1/branding/logo${q}mode=${mode}` }
  })
}
