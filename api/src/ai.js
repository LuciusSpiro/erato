import { config } from './config.js'
import { requireAuth } from './auth.js'
import { retrieve } from './search.js'

// Anzahl der Kontext-Treffer, die ins Prompt einfließen.
const TOP_K = 5

const SYSTEM_PROMPT = [
  'Du bist ein hilfreicher Assistent für die Wissensdatenbank "Erato".',
  'Antworte ausschließlich auf Deutsch.',
  'Nutze NUR den bereitgestellten Kontext, um die Frage zu beantworten.',
  'Wenn die Antwort nicht im Kontext steht, sage das ehrlich und rate nicht.',
  'Antworte knapp und präzise.',
].join(' ')

// Baut den Kontext-Block aus den Retrieval-Treffern (mit Quellen-Titeln).
function buildContext(hits) {
  return hits
    .map((h, i) => {
      const path = Array.isArray(h.notebookPath) ? h.notebookPath.join(' > ') : ''
      const src = path ? `${path} > ${h.title}` : h.title
      const text = (h.snippet ?? '').replace(/<<|>>/g, '')
      return `[Quelle ${i + 1}: ${src}]\n${text}`
    })
    .join('\n\n')
}

// Ruft Ollama /api/chat auf (global fetch, kein zusätzliches Dep).
// Wirft bei Nichtverfügbarkeit/Fehler eine aussagekräftige Exception.
async function chat(messages) {
  const url = `${config.ollama.url}/api/chat`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), config.ollama.chatTimeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.chatModel,
        messages,
        stream: false,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ollama chat HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('ollama chat: leere/ungültige Antwort')
    }
    return content
  } finally {
    clearTimeout(timer)
  }
}

export async function aiRoutes(app) {
  // RAG-Chat: Frage über hybride Suche kontextualisieren und via Ollama beantworten.
  app.post('/v1/ai/chat', { preHandler: requireAuth }, async (req, reply) => {
    const question = (req.body?.question ?? '').trim()
    // BEKANNTE EINSCHRÄNKUNG: Der RAG-Chat filtert (noch) NICHT nach Notebook-
    // Mitgliedschaft (nur requireAuth). retrieve() kennt keine per-Notebook-
    // Zugriffskontrolle, daher können Antworten Kontext aus Notizbüchern
    // enthalten, in denen der User kein Mitglied ist. Bewusste Scope-Begrenzung;
    // ein notebookId-/Mitgliedschafts-Filter in retrieve() ist noch offen.
    if (!question) return reply.code(400).send({ error: 'question required' })

    // Retrieval: Top-5 relevante Chunks/Seiten über die hybride Suche.
    const hits = await retrieve(question, { limit: TOP_K, logger: req.log })

    const context = hits.length
      ? buildContext(hits)
      : '(kein relevanter Kontext gefunden)'
    const userMsg = `Kontext:\n${context}\n\nFrage: ${question}`

    let answer
    try {
      answer = await chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ])
    } catch (err) {
      req.log.error({ err: err.message }, 'ai chat fehlgeschlagen')
      return reply
        .code(503)
        .send({ error: 'ai unavailable', detail: 'Chat-Modell nicht verfügbar' })
    }

    // sources = abgerufene Treffer, dedupliziert nach pageId (Reihenfolge erhalten).
    const seen = new Set()
    const sources = []
    for (const h of hits) {
      if (seen.has(h.pageId)) continue
      seen.add(h.pageId)
      sources.push({ pageId: h.pageId, title: h.title, notebookPath: h.notebookPath })
    }

    return { answer, sources }
  })
}
