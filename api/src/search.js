import { query } from './db.js'
import { requireAuth } from './auth.js'
import { embed, toVectorLiteral, reindexPage } from './embeddings.js'

const TOP_N = 50
// Reciprocal Rank Fusion: kleiner k -> stärkere Gewichtung der Top-Ränge.
const RRF_K = 60

// Volltext-Treffer als Liste { pageId, notebookTitle, title, snippet, rank }.
async function fulltextRows(q, limit = TOP_N) {
  const { rows } = await query(
    `SELECT
       p.id AS page_id,
       p.title AS title,
       n.title AS notebook_title,
       ts_headline(
         'german',
         p.content_md,
         websearch_to_tsquery('german', $1),
         'StartSel=<<,StopSel=>>,MaxFragments=1'
       ) AS snippet,
       ts_rank(p.search_tsv, websearch_to_tsquery('german', $1)) AS rank
     FROM pages p
     JOIN notebooks n ON n.id = p.notebook_id
     WHERE p.search_tsv @@ websearch_to_tsquery('german', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    [q, limit],
  )
  return rows
}

// Semantische Treffer per pgvector Cosine-ANN. Ein Treffer pro Seite
// (bester Chunk), inklusive Distanz/Score.
async function semanticRows(q, limit = TOP_N) {
  const vec = await embed(q)
  const lit = toVectorLiteral(vec)
  const { rows } = await query(
    `SELECT DISTINCT ON (e.page_id)
       e.page_id AS page_id,
       p.title AS title,
       n.title AS notebook_title,
       e.chunk_text AS snippet,
       (e.embedding <=> $1::vector) AS distance
     FROM page_embeddings e
     JOIN pages p ON p.id = e.page_id
     JOIN notebooks n ON n.id = p.notebook_id
     ORDER BY e.page_id, e.embedding <=> $1::vector
     LIMIT $2`,
    [lit, limit],
  )
  // Innerhalb der pro Seite besten Chunks global nach Distanz sortieren.
  rows.sort((a, b) => a.distance - b.distance)
  return rows.slice(0, limit)
}

function mapResult(r) {
  return {
    pageId: r.page_id,
    notebookPath: [r.notebook_title],
    title: r.title,
    snippet: r.snippet,
  }
}

// Wiederverwendbares hybrides Retrieval: Volltext + Semantik via RRF.
// Liefert [{ pageId, notebookPath, title, snippet, score }] sortiert nach Score.
// Wird von /v1/search/hybrid und vom RAG-Chat (ai.js) genutzt.
// Fällt graceful auf reinen Volltext zurück, wenn der Embedding-Dienst weg ist.
export async function retrieve(q, { limit = TOP_N, logger } = {}) {
  const query = (q ?? '').trim()
  if (!query) return []

  const ft = await fulltextRows(query)
  let sem = []
  try {
    sem = await semanticRows(query)
  } catch (err) {
    // Embedding-Dienst weg -> graceful auf reinen Volltext zurückfallen.
    logger?.warn?.({ err: err.message }, 'retrieve: semantischer Teil fehlgeschlagen, nur Volltext')
  }

  // RRF: Score je Seite = sum(1 / (k + rank)) über beide Listen.
  const acc = new Map() // pageId -> { row, score }
  const fuse = (rows) => {
    rows.forEach((r, i) => {
      const id = r.page_id
      const add = 1 / (RRF_K + i + 1)
      const prev = acc.get(id)
      if (prev) {
        prev.score += add
        // Snippet aus dem zuerst gesehenen (Volltext) bevorzugen, sonst behalten.
        if (!prev.row.snippet && r.snippet) prev.row.snippet = r.snippet
      } else {
        acc.set(id, { row: r, score: add })
      }
    })
  }
  fuse(ft)
  fuse(sem)

  return [...acc.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({ ...mapResult(row), score }))
}

export async function searchRoutes(app) {
  // BEKANNTE EINSCHRÄNKUNG: Die Such-Endpunkte filtern (noch) NICHT nach
  // Notebook-Mitgliedschaft. Sie bleiben vorerst auf requireAuth — jeder
  // eingeloggte User kann über die Suche Treffer aus Notizbüchern erhalten,
  // in denen er kein Mitglied ist. Scope-Begrenzung; per-Notebook-Filter in
  // retrieve()/den FTS-Queries ist noch offen (analog ai.js).
  // Volltextsuche über Postgres-FTS (german). Unverändertes Verhalten.
  app.get('/v1/search', { preHandler: requireAuth }, async (req) => {
    const q = (req.query?.q ?? '').trim()
    if (!q) return []
    const rows = await fulltextRows(q)
    return rows.map(mapResult)
  })

  // Semantische Suche: q embedden, Cosine-ANN über page_embeddings.
  app.get('/v1/search/semantic', { preHandler: requireAuth }, async (req, reply) => {
    const q = (req.query?.q ?? '').trim()
    if (!q) return []
    try {
      const rows = await semanticRows(q)
      return rows.map((r) => ({
        ...mapResult(r),
        // Cosine-Similarity-Score (1 = identisch). distance = 1 - similarity.
        score: 1 - Number(r.distance),
      }))
    } catch (err) {
      req.log.error({ err: err.message }, 'semantic search fehlgeschlagen')
      return reply.code(503).send({ error: 'embedding service unavailable' })
    }
  })

  // Hybride Suche: Volltext + Semantik via Reciprocal Rank Fusion (RRF).
  app.get('/v1/search/hybrid', { preHandler: requireAuth }, async (req) => {
    const q = (req.query?.q ?? '').trim()
    if (!q) return []
    return retrieve(q, { limit: TOP_N, logger: req.log })
  })

  // Erstbefüllung/Wartung: alle Seiten neu embedden. Sequenziell, damit Ollama
  // nicht überlastet wird. Liefert Zusammenfassung zurück.
  app.post('/v1/search/reindex', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query('SELECT id FROM pages ORDER BY created_at')
    let ok = 0
    let failed = 0
    let chunks = 0
    const errors = []
    for (const r of rows) {
      try {
        const res = await reindexPage(r.id)
        if (res.ok) {
          ok++
          chunks += res.chunks ?? 0
        } else {
          failed++
        }
      } catch (err) {
        failed++
        errors.push({ pageId: r.id, error: err.message })
        req.log.warn({ err: err.message, pageId: r.id }, 'reindex einer Seite fehlgeschlagen')
      }
    }
    const result = { pages: rows.length, indexed: ok, failed, chunks }
    if (failed > 0) {
      return reply.code(207).send({ ...result, errors: errors.slice(0, 10) })
    }
    return result
  })
}
