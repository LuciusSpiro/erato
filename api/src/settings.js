import { config } from './config.js'
import { requireAdmin } from './auth.js'
import {
  aiDefaults, getAiConfig, readAiSettings, writeAiSettings,
} from './aiConfig.js'
import { listOllamaModels, invalidateCapabilities } from './capabilities.js'
import { embedWith, reconfigureEmbeddingDimension, reindexAllAsync } from './embeddings.js'

function by(req) {
  return req.user?.preferred_username ?? req.user?.sub ?? 'unknown'
}

// Normalisiert ein Eingabefeld:
//  undefined → unverändert lassen (Rückgabe Symbol KEEP)
//  ''        → Override entfernen (Default nutzen)
//  'wert'    → setzen
const KEEP = Symbol('keep')
function field(v) {
  if (v === undefined) return KEEP
  const s = String(v).trim()
  return s === '' ? null : s
}

export async function settingsRoutes(app) {
  // Aktuelle AI-Konfiguration (effektiv = DB über Env) + Defaults.
  app.get('/v1/settings/ai', { preHandler: requireAdmin }, async () => {
    const eff = await getAiConfig()
    const ov = await readAiSettings()
    return {
      ollamaUrl: eff.url,
      embedModel: eff.embedModel,
      chatModel: eff.chatModel,
      embedDim: eff.embedDim,
      defaults: aiDefaults(),
      overridden: {
        ollamaUrl: !!ov.ollamaUrl,
        embedModel: !!ov.embedModel,
        chatModel: !!ov.chatModel,
      },
    }
  })

  // In Ollama installierte Modelle (für die Auswahl-Dropdowns). Optional ?url=
  // zum Testen einer noch nicht gespeicherten URL.
  app.get('/v1/ai/models', { preHandler: requireAdmin }, async (req) => {
    const url = (req.query?.url ?? '').trim() || (await getAiConfig()).url
    const models = await listOllamaModels(url)
    return { reachable: models !== null, models: models ?? [] }
  })

  // AI-Konfiguration ändern. URL/Chat-Modell sind gefahrlos. Ein Wechsel des
  // Embed-Modells wird geprüft (Modell muss erreichbar sein); bei abweichender
  // Vektordimension wird die Spalte umgestellt und ein Re-Index angestoßen.
  app.put('/v1/settings/ai', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body ?? {}
    const cur = await readAiSettings()
    const next = { ...cur }
    const d = aiDefaults()

    const url = field(body.ollamaUrl)
    if (url !== KEEP) { if (url === null) delete next.ollamaUrl; else next.ollamaUrl = url }

    const chat = field(body.chatModel)
    if (chat !== KEEP) { if (chat === null) delete next.chatModel; else next.chatModel = chat }

    let reindex = null
    const embed = field(body.embedModel)
    if (embed !== KEEP) {
      const newEmbed = embed === null ? d.embedModel : embed
      const curEmbed = cur.embedModel ?? d.embedModel
      if (newEmbed !== curEmbed) {
        // URL, die für die Dimensions-Probe gelten soll (ggf. neu gesetzte).
        const probeUrl = next.ollamaUrl ?? d.url
        let dim
        try {
          dim = (await embedWith(probeUrl, newEmbed, 'dimension probe', config.ollama.timeoutMs)).length
        } catch (err) {
          return reply.code(400).send({
            error: 'embed model unavailable',
            detail: `Embed-Modell „${newEmbed}" ist nicht erreichbar/installiert: ${err.message}`,
          })
        }
        if (embed === null) delete next.embedModel; else next.embedModel = newEmbed
        const oldDim = cur.embedDim ?? 768
        if (dim !== oldDim) {
          await reconfigureEmbeddingDimension(dim)
          next.embedDim = dim
          reindex = 'dimension-changed'
        } else {
          reindex = 'model-changed'
        }
      }
    }

    await writeAiSettings(next, by(req))
    invalidateCapabilities()
    if (reindex) reindexAllAsync(req.log)

    const eff = await getAiConfig()
    return {
      ok: true,
      reindex, // null | 'model-changed' | 'dimension-changed'
      settings: {
        ollamaUrl: eff.url,
        embedModel: eff.embedModel,
        chatModel: eff.chatModel,
        embedDim: eff.embedDim,
      },
    }
  })
}
