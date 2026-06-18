import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { pathToFileURL } from 'node:url'
import { config } from './config.js'
import { migrate } from './db.js'
import { ensureBucket } from './storage.js'
import { seedBrandingFromFile } from './brandSeed.js'
import { brandingRoutes } from './branding.js'
import { notebookRoutes } from './notebooks.js'
import { memberRoutes } from './members.js'
import { pageRoutes } from './pages.js'
import { versionRoutes } from './versions.js'
import { searchRoutes } from './search.js'
import { aiRoutes } from './ai.js'
import { favoriteRoutes } from './favorites.js'
import { exportRoutes } from './exportRoutes.js'
import { eratoRoutes } from './erato.js'
import { capabilityRoutes } from './capabilities.js'
import { settingsRoutes } from './settings.js'

// Baut die Fastify-App, registriert alle Routen, migriert die DB und seedet
// Storage/Branding — OHNE zu lauschen. Für Tests (app.inject) und als Basis
// von start().
export async function buildApp(opts = {}) {
  // bodyLimit großzügig für Erato-JSON-Import (komplette Instanz).
  const app = Fastify({ logger: opts.logger ?? true, bodyLimit: 64 * 1024 * 1024 })

  // Im local mode (Electron) ist der Renderer-Origin nicht fix → reflektieren.
  const origin = config.mode === 'local' ? true : config.webOrigin
  await app.register(cors, { origin, credentials: true })
  await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024 } })

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(brandingRoutes)
  await app.register(notebookRoutes)
  await app.register(memberRoutes)
  await app.register(pageRoutes)
  await app.register(versionRoutes)
  await app.register(searchRoutes)
  await app.register(aiRoutes)
  await app.register(favoriteRoutes)
  await app.register(exportRoutes)
  await app.register(eratoRoutes)
  await app.register(capabilityRoutes)
  await app.register(settingsRoutes)

  await migrate()

  // MinIO/lokalen Storage initialisieren — nicht-fatal: Theming (Tokens) läuft
  // auch ohne Object-Storage; nur Logo-Funktionen brauchen ihn.
  try {
    await ensureBucket()
  } catch (err) {
    app.log.warn({ err: err.message }, 'Storage nicht verfügbar — Logo-Funktionen deaktiviert')
  }

  // Erststart-Branding (White-Label) aus mitgelieferter brand.json seeden.
  if (config.brandConfig) {
    try {
      await seedBrandingFromFile(config.brandConfig, app.log)
    } catch (err) {
      app.log.warn({ err: err.message }, 'Branding-Seed übersprungen')
    }
  }

  return app
}

// Baut die App und startet den Listener. Wird direkt (node src/server.js) und
// in-process von der Electron-App (import { start }) genutzt.
export async function start(opts = {}) {
  const app = await buildApp(opts)
  const port = opts.port ?? config.port
  // local mode bindet bewusst nur an 127.0.0.1 (kein Netzwerkzugriff ohne Auth).
  const host = opts.host ?? (config.mode === 'local' ? '127.0.0.1' : config.host)
  await app.listen({ port, host })
  app.log.info(`erato-api läuft auf http://${host}:${port}`)
  return app
}

// Direkt gestartet (node src/server.js / npm start) → sofort hochfahren.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  start().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
