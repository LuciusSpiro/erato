import { config } from './config.js'
import { query } from './db.js'

// Dynamische Ollama-Konfiguration: in der DB (app_settings.key='ai') gespeicherte
// Werte überstimmen die Env-Defaults aus config.js. So lassen sich URL und Modelle
// zur Laufzeit (in den Einstellungen) ändern, ohne Neustart/Env.

export function aiDefaults() {
  return {
    url: config.ollama.url,
    embedModel: config.ollama.embedModel,
    chatModel: config.ollama.chatModel,
  }
}

// Rohzugriff auf die gespeicherten Overrides (für die Settings-Routen).
export async function readAiSettings() {
  try {
    const { rows } = await query("SELECT value FROM app_settings WHERE key = 'ai'")
    return rows[0]?.value ?? {}
  } catch {
    return {}
  }
}

export async function writeAiSettings(value, by) {
  await query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ('ai', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(value), by],
  )
  invalidateAiConfig()
}

let cache = null
let cachedAt = 0
const TTL = 5000

// Effektive Konfiguration (DB über Env). Kurz gecacht, damit nicht jeder
// Embedding-/Chat-Call die DB trifft.
export async function getAiConfig() {
  const now = Date.now()
  if (cache && now - cachedAt < TTL) return cache
  const stored = await readAiSettings()
  const d = aiDefaults()
  cache = {
    url: stored.ollamaUrl || d.url,
    embedModel: stored.embedModel || d.embedModel,
    chatModel: stored.chatModel || d.chatModel,
    embedDim: stored.embedDim ?? 768,
    timeoutMs: config.ollama.timeoutMs,
    chatTimeoutMs: config.ollama.chatTimeoutMs,
  }
  cachedAt = now
  return cache
}

export function invalidateAiConfig() {
  cache = null
  cachedAt = 0
}
