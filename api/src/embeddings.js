import { query, pool } from './db.js'
import { getAiConfig } from './aiConfig.js'

// Maximale Chunk-Größe in Zeichen (grobe Heuristik, kein Token-Zähler).
const MAX_CHUNK_CHARS = 1000

// Ruft Ollama-Embeddings ab — mit explizit übergebenem Endpoint/Modell.
// Robust gegen Timeout/Fehler: wirft eine aussagekräftige Exception.
export async function embedWith(url, model, text, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${url}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ollama embeddings HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const vec = data?.embedding
    if (!Array.isArray(vec) || vec.length === 0) {
      throw new Error('ollama embeddings: leeres/ungültiges embedding')
    }
    return vec
  } finally {
    clearTimeout(timer)
  }
}

// Embedding mit der aktuell konfigurierten Ollama-Config (DB über Env).
export async function embed(text) {
  const ai = await getAiConfig()
  return embedWith(ai.url, ai.embedModel, text, ai.timeoutMs)
}

// Wandelt einen Vektor in das pgvector-Textformat '[1,2,3]'.
export function toVectorLiteral(vec) {
  return `[${vec.join(',')}]`
}

// Teilt Markdown in sinnvolle Chunks: gruppiert nach Überschriften (#..######),
// hängt den Heading-Pfad (z.B. "Architektur > Datenbank") an jeden Chunk und
// splittet zu lange Abschnitte an Absatzgrenzen auf ~MAX_CHUNK_CHARS.
export function chunk(markdown) {
  const md = (markdown ?? '').trim()
  if (!md) return []

  const lines = md.split(/\r?\n/)
  // Heading-Stack: pro Ebene der aktuelle Titel.
  const headingStack = []
  // Sektionen sammeln: { headingPath, lines: [] }
  const sections = []
  let current = { headingPath: '', lines: [] }

  const headingPathStr = () => headingStack.filter(Boolean).join(' > ')

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      // Vorherige Sektion abschließen, falls sie Inhalt hat.
      if (current.lines.join('').trim()) sections.push(current)
      const level = m[1].length
      const title = m[2].trim()
      headingStack[level - 1] = title
      headingStack.length = level // tiefere Ebenen verwerfen
      current = { headingPath: headingPathStr(), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.lines.join('').trim()) sections.push(current)

  // Jede Sektion in Absatzblöcke <= MAX_CHUNK_CHARS aufteilen.
  const chunks = []
  let idx = 0
  for (const sec of sections) {
    const text = sec.lines.join('\n').trim()
    if (!text) continue
    for (const piece of splitToSize(text, MAX_CHUNK_CHARS)) {
      const headingPrefix = sec.headingPath ? `${sec.headingPath}\n` : ''
      chunks.push({
        chunkIndex: idx++,
        headingPath: sec.headingPath || null,
        // Heading-Pfad in den embeddeten Text aufnehmen für besseren Kontext.
        chunkText: `${headingPrefix}${piece}`.trim(),
      })
    }
  }
  return chunks
}

// Splittet einen Text an Absatzgrenzen (Leerzeilen) in Stücke <= maxChars.
// Einzelne überlange Absätze werden hart geschnitten.
function splitToSize(text, maxChars) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const out = []
  let buf = ''
  const flush = () => {
    if (buf.trim()) out.push(buf.trim())
    buf = ''
  }
  for (const para of paras) {
    if (para.length > maxChars) {
      flush()
      for (let i = 0; i < para.length; i += maxChars) {
        out.push(para.slice(i, i + maxChars))
      }
      continue
    }
    if ((buf + '\n\n' + para).length > maxChars) flush()
    buf = buf ? `${buf}\n\n${para}` : para
  }
  flush()
  return out
}

// Re-indexiert eine Seite: lädt content_md, chunkt, embeddet je Chunk,
// ersetzt alte Embeddings atomar. Synchron (await) — für fire-and-forget
// Nutzung siehe reindexPageAsync.
export async function reindexPage(pageId) {
  const { rows } = await query(
    'SELECT id, title, content_md FROM pages WHERE id = $1',
    [pageId],
  )
  const page = rows[0]
  if (!page) return { ok: false, reason: 'not found' }

  // Titel als Kontext in den ersten Chunk-Pfad mitnehmen ist nicht nötig —
  // Heading-Pfade kommen aus dem Markdown selbst.
  const chunks = chunk(page.content_md)

  // Embeddings berechnen (sequenziell, Ollama serialisiert ohnehin).
  const embedded = []
  for (const c of chunks) {
    const vec = await embed(c.chunkText)
    embedded.push({ ...c, vec })
  }

  // Alte Embeddings löschen + neue schreiben. Wenn keine Chunks: nur löschen.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM page_embeddings WHERE page_id = $1', [pageId])
    for (const e of embedded) {
      await client.query(
        `INSERT INTO page_embeddings (page_id, chunk_index, heading_path, chunk_text, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [pageId, e.chunkIndex, e.headingPath, e.chunkText, toVectorLiteral(e.vec)],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return { ok: true, chunks: embedded.length }
}

// Fire-and-forget Variante: nie werfen, nur loggen. Für den PUT/POST-Hook,
// damit Speichern schnell bleibt.
export function reindexPageAsync(pageId, logger) {
  reindexPage(pageId).catch((err) => {
    const msg = err?.message ?? String(err)
    if (logger?.warn) logger.warn({ err: msg, pageId }, 'reindexPage fehlgeschlagen')
    else console.warn('reindexPage fehlgeschlagen', pageId, msg)
  })
}

// Re-indexiert alle Seiten im Hintergrund (nach Modell-/Dimensionswechsel).
// Sequenziell, damit Ollama nicht überlastet wird; Fehler werden nur geloggt.
export function reindexAllAsync(logger) {
  ;(async () => {
    const { rows } = await query('SELECT id FROM pages ORDER BY created_at')
    let ok = 0
    for (const r of rows) {
      try {
        await reindexPage(r.id)
        ok++
      } catch (err) {
        logger?.warn?.({ err: err.message, pageId: r.id }, 'reindexAll: Seite fehlgeschlagen')
      }
    }
    logger?.info?.({ pages: rows.length, indexed: ok }, 'reindexAll abgeschlossen')
  })().catch((err) => logger?.warn?.({ err: err.message }, 'reindexAll fehlgeschlagen'))
}

// Stellt die Dimension der Embedding-Spalte auf `dim` um (bei Wechsel des
// Embed-Modells mit abweichender Vektorgröße). Leert die alten Embeddings
// (gehören zum alten Modell) und baut den ANN-Index neu. Danach ist ein
// vollständiger Re-Index nötig (reindexAllAsync).
export async function reconfigureEmbeddingDimension(dim) {
  const n = Number(dim)
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`ungültige Embedding-Dimension: ${dim}`)
  }
  try {
    await query('DROP INDEX IF EXISTS page_embeddings_embedding_hnsw_idx')
  } catch (err) {
    console.warn('HNSW-Index Drop übersprungen:', err.message)
  }
  await query('TRUNCATE page_embeddings')
  await query(`ALTER TABLE page_embeddings ALTER COLUMN embedding TYPE vector(${n})`)
  try {
    await query(
      `CREATE INDEX IF NOT EXISTS page_embeddings_embedding_hnsw_idx
         ON page_embeddings USING hnsw (embedding vector_cosine_ops)`,
    )
  } catch (err) {
    console.warn('HNSW-Index nach Reconfigure nicht verfügbar:', err.message)
  }
}
