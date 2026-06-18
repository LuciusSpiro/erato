import { config } from './config.js'
import { getAiConfig } from './aiConfig.js'

// Prüft, ob ein konfiguriertes Modell (z.B. 'llama3.2:3b' oder 'nomic-embed-text')
// in der Ollama-Tag-Liste vorhanden ist. Ollama meldet Tags wie
// 'nomic-embed-text:latest' — daher Basis-Name (vor ':') vergleichen.
export function hasModel(tags, model) {
  if (!model || !Array.isArray(tags)) return false
  const base = model.split(':')[0]
  return tags.some((t) => t === model || t.split(':')[0] === base)
}

// Reine Auswertung der AI-Verfügbarkeit (testbar, ohne Netzwerk).
//  flag:  'auto' | 'true' | 'false'  (config.aiEnabled)
//  tags:  Array der Ollama-Modellnamen, oder null wenn Ollama nicht erreichbar war
// Ergebnis: { enabled, chat, embeddings, reason }
export function evaluateAi({ flag, tags, embedModel, chatModel }) {
  if (flag === 'false') {
    return { enabled: false, chat: false, embeddings: false, reason: 'disabled' }
  }
  if (flag === 'true') {
    // Erzwungen an: auch ohne erfolgreiche Probe als verfügbar melden.
    if (tags === null) return { enabled: true, chat: true, embeddings: true, reason: 'forced' }
  }
  if (tags === null) {
    return { enabled: false, chat: false, embeddings: false, reason: 'unreachable' }
  }
  const chat = hasModel(tags, chatModel)
  const embeddings = hasModel(tags, embedModel)
  const enabled = chat || embeddings
  return { enabled, chat, embeddings, reason: enabled ? 'ok' : 'no-models' }
}

// Fragt Ollama (an `url`) nach installierten Modellen. Liefert ein Array von
// Namen oder null, wenn der Dienst nicht erreichbar ist (kurzer Timeout).
export async function listOllamaModels(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(`${url}/api/tags`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.models) ? data.models.map((m) => m.name) : []
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Gecachte AI-Verfügbarkeit (Probe ist relativ teuer / Ollama kann träge sein).
let cache = null
let cachedAt = 0
const CACHE_MS = 30_000

export function invalidateCapabilities() {
  cache = null
  cachedAt = 0
}

export async function getAiCapability() {
  const now = Date.now()
  if (cache && now - cachedAt < CACHE_MS) return cache
  const flag = config.aiEnabled
  const ai = await getAiConfig()
  // Bei 'false' gar nicht erst proben.
  const tags = flag === 'false' ? null : await listOllamaModels(ai.url)
  cache = evaluateAi({
    flag,
    tags,
    embedModel: ai.embedModel,
    chatModel: ai.chatModel,
  })
  cachedAt = now
  return cache
}

export async function capabilityRoutes(app) {
  // Öffentlich: erlaubt dem Frontend, AI-Features auszublenden, wenn kein
  // Ollama/Modell verfügbar ist (statt Buttons, die nur 503 liefern).
  app.get('/v1/capabilities', async () => {
    const ai = await getAiCapability()
    return { mode: config.mode, ai }
  })
}
