import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import net from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// Im Paket liegen api/ und brand/ als extraResources neben dem asar.
const apiEntry = isDev
  ? join(__dirname, '..', 'api', 'src', 'server.js')
  : join(process.resourcesPath, 'api', 'src', 'server.js')
const brandConfig = isDev
  ? join(__dirname, 'brand', 'brand.json')
  : join(process.resourcesPath, 'brand', 'brand.json')

// Freien lokalen Port finden (kein fixer Port → kein Konflikt mit anderen Apps).
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

// Datei, über die lokale Tools (z.B. der MCP-Server) den aktuellen API-Port
// finden. Liegt im userData-Verzeichnis und wird beim Beenden entfernt.
const portFile = join(app.getPath('userData'), 'erato-local.json')

function writePortFile(port) {
  try {
    writeFileSync(
      portFile,
      JSON.stringify({ apiBase: `http://127.0.0.1:${port}`, port, pid: process.pid }),
    )
  } catch { /* nicht fatal */ }
}

// Startet die Erato-API in-process im local mode (PGlite + lokaler Storage,
// kein Keycloak). Daten liegen im userData-Verzeichnis des OS.
async function startApi(port) {
  process.env.ERATO_MODE = 'local'
  process.env.LOCAL_DATA_DIR = app.getPath('userData')
  process.env.BRAND_CONFIG = brandConfig
  process.env.PORT = String(port)
  process.env.AI_ENABLED = process.env.AI_ENABLED ?? 'auto'
  const { start } = await import(pathToFileURL(apiEntry).href)
  await start({ port, host: '127.0.0.1' })
  writePortFile(port)
}

function createWindow(apiBase) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      // API-Basis an den Renderer durchreichen (preload liest sie aus argv).
      additionalArguments: [`--erato-api=${apiBase}`],
    },
  })

  // Externe Links im Systembrowser öffnen, nicht im App-Fenster.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadFile(join(__dirname, 'dist-web', 'index.html'))
}

app.whenReady().then(async () => {
  const port = await freePort()
  await startApi(port)
  createWindow(`http://127.0.0.1:${port}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(`http://127.0.0.1:${port}`)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Port-Datei beim Beenden entfernen (kein veralteter Port für Tools).
app.on('quit', () => {
  try { rmSync(portFile, { force: true }) } catch { /* ignore */ }
})
