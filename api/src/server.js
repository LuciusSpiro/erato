import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { config } from './config.js'
import { migrate } from './db.js'
import { ensureBucket } from './storage.js'
import { brandingRoutes } from './branding.js'
import { notebookRoutes } from './notebooks.js'
import { memberRoutes } from './members.js'
import { pageRoutes } from './pages.js'
import { versionRoutes } from './versions.js'
import { searchRoutes } from './search.js'
import { aiRoutes } from './ai.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: config.webOrigin, credentials: true })
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

app.get('/health', async () => ({ status: 'ok' }))

await app.register(brandingRoutes)
await app.register(notebookRoutes)
await app.register(memberRoutes)
await app.register(pageRoutes)
await app.register(versionRoutes)
await app.register(searchRoutes)
await app.register(aiRoutes)

try {
  await migrate()
  // MinIO-Init nicht-fatal: Theming (Tokens aus Postgres) funktioniert auch ohne
  // Object-Storage. Logo-Upload braucht MinIO und wird sonst zur Laufzeit fehlschlagen.
  try {
    await ensureBucket()
  } catch (err) {
    app.log.warn({ err: err.message }, 'MinIO nicht verfügbar — Logo-Funktionen deaktiviert')
  }
  await app.listen({ port: config.port, host: config.host })
  app.log.info(`erato-api läuft auf http://localhost:${config.port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
