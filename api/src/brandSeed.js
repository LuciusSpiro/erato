import { readFile } from 'node:fs/promises'
import { dirname, join, extname } from 'node:path'
import { query } from './db.js'
import { putLogo } from './storage.js'

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// Seedet das instanz-weite Branding (_default) aus einer brand.json (White-Label).
// Erwartetes Format:
//   { "appName": "...", "primary": { "light": "#...", "dark": "#..." },
//     "logo": { "light": "logo-light.png", "dark": "logo-dark.png" } }
// Logo-Pfade sind relativ zur brand.json. Nutzer-Anpassungen (updated_by ist
// weder 'seed' noch 'brand-seed') werden NICHT überschrieben.
export async function seedBrandingFromFile(brandPath, logger) {
  const brand = JSON.parse(await readFile(brandPath, 'utf8'))

  const { rows } = await query(
    "SELECT tokens, updated_by FROM branding.config WHERE app_id = '_default'",
  )
  const current = rows[0]
  const owner = current?.updated_by
  if (owner && owner !== 'seed' && owner !== 'brand-seed') {
    logger?.info?.('Branding bereits vom Nutzer angepasst — Seed übersprungen')
    return
  }

  const tokens = { ...(current?.tokens ?? {}) }
  if (brand.appName) tokens.appName = brand.appName
  if (brand.primary) tokens.primary = brand.primary

  const baseDir = dirname(brandPath)
  let logoKey = null
  let logoDarkKey = null

  if (brand.logo?.light) {
    const ext = extname(brand.logo.light).toLowerCase()
    logoKey = `_default/logo-light${ext}`
    await putLogo(logoKey, await readFile(join(baseDir, brand.logo.light)), MIME[ext] ?? 'image/png')
  }
  if (brand.logo?.dark) {
    const ext = extname(brand.logo.dark).toLowerCase()
    logoDarkKey = `_default/logo-dark${ext}`
    await putLogo(logoDarkKey, await readFile(join(baseDir, brand.logo.dark)), MIME[ext] ?? 'image/png')
  }

  await query(
    `INSERT INTO branding.config (app_id, tokens, logo_key, logo_dark_key, updated_by, updated_at)
     VALUES ('_default', $1, $2, $3, 'brand-seed', now())
     ON CONFLICT (app_id) DO UPDATE SET
       tokens = EXCLUDED.tokens,
       logo_key = COALESCE(EXCLUDED.logo_key, branding.config.logo_key),
       logo_dark_key = COALESCE(EXCLUDED.logo_dark_key, branding.config.logo_dark_key),
       updated_by = 'brand-seed',
       updated_at = now()`,
    [JSON.stringify(tokens), logoKey, logoDarkKey],
  )
  logger?.info?.('Branding aus brand.json geseedet')
}
