import { config } from './config.js'

// ---------------------------------------------------------------------------
// DB-Adapter: 'pg' (PostgreSQL-Server) ODER 'pglite' (eingebettetes Postgres
// als WASM, in-process — für die lokale Electron-App). Beide Backends bieten
// dieselbe Schnittstelle: query(text, params), exec(sql) für Mehrfach-Statements
// und pool.connect() für Transaktionen (embeddings.js).
// ---------------------------------------------------------------------------

// PGlite liefert { rows, affectedRows }, pg liefert { rows, rowCount }.
// Vereinheitlichen, damit Aufrufer immer rowCount nutzen können.
function normalize(result) {
  if (result && result.rowCount === undefined) {
    result.rowCount =
      result.affectedRows != null && result.affectedRows > 0
        ? result.affectedRows
        : result.rows?.length ?? 0
  }
  return result
}

async function createPgBackend() {
  const pg = (await import('pg')).default
  const pool = new pg.Pool(config.db)
  return {
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    connect: () => pool.connect(),
  }
}

async function createPgliteBackend() {
  const { PGlite } = await import('@electric-sql/pglite')
  const { vector } = await import('@electric-sql/pglite/vector')
  const { join } = await import('node:path')
  const { mkdirSync } = await import('node:fs')
  const dir = join(config.localDataDir, 'pgdata')
  // PGlite legt nur das Leaf-Verzeichnis an (nicht rekursiv) → Eltern sicherstellen.
  mkdirSync(dir, { recursive: true })
  const db = new PGlite(dir, { extensions: { vector } })
  await db.waitReady

  // PGlite hat genau eine Verbindung und serialisiert Queries selbst. Für
  // isolierte Transaktionen (BEGIN/COMMIT in embeddings.js) müssen wir die
  // "Checkouts" über pool.connect() serialisieren, damit sich keine fremden
  // Queries zwischen BEGIN und COMMIT schieben.
  let lock = Promise.resolve()
  const connect = () => {
    let release
    const gate = new Promise((r) => { release = r })
    const prev = lock
    lock = gate
    return prev.then(() => ({
      query: (text, params) =>
        (params === undefined ? db.query(text) : db.query(text, params)).then(normalize),
      release: () => release(),
    }))
  }

  return {
    query: (text, params) =>
      (params === undefined ? db.query(text) : db.query(text, params)).then(normalize),
    exec: (sql) => db.exec(sql),
    connect,
  }
}

let backendPromise = null
function getBackend() {
  if (!backendPromise) {
    backendPromise = config.dbMode === 'pglite' ? createPgliteBackend() : createPgBackend()
  }
  return backendPromise
}

export const query = async (text, params) => (await getBackend()).query(text, params)

// Mehrfach-Statement-DDL (durch ';' getrennt). pg kann das in einer einfachen
// Query, PGlite braucht dafür exec().
export const exec = async (sql) => (await getBackend()).exec(sql)

// Transaktions-Pool (nur connect() wird genutzt). Lazy an das Backend gebunden.
export const pool = {
  connect: async () => (await getBackend()).connect(),
}

// Schema bei Boot sicherstellen (Dev-Migration). Erstellt die Branding-Tabelle
// und legt eine instanz-weite Default-Zeile an, falls noch keine existiert.
export async function migrate() {
  // Mehrfach-Statement-Block → exec() (PGlite-kompatibel).
  await exec(`
    CREATE SCHEMA IF NOT EXISTS branding;
    CREATE TABLE IF NOT EXISTS branding.config (
      app_id        TEXT PRIMARY KEY,           -- '_default' = instanz-weit (gilt für alle Apps)
      tokens        JSONB NOT NULL DEFAULT '{}',
      logo_key      TEXT,
      logo_dark_key TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by    TEXT
    );
  `)

  // Default-Branding seeden (nur wenn leer).
  await query(
    `INSERT INTO branding.config (app_id, tokens, updated_by)
     VALUES ('_default', $1, 'seed')
     ON CONFLICT (app_id) DO NOTHING`,
    [JSON.stringify({ appName: 'Erato', primary: { light: '#3B5BDB', dark: '#748FFC' } })],
  )

  // gen_random_uuid() stammt aus pgcrypto (in PG13+ auch im Core verfügbar).
  // In PGlite ist pgcrypto evtl. nicht gebündelt — dann tolerant ignorieren,
  // da gen_random_uuid() dort bereits im Core existiert.
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
  } catch (err) {
    console.warn('pgcrypto-Extension nicht verfügbar (Core-gen_random_uuid wird genutzt):', err.message)
  }

  // Notizbücher + Seiten (public-Schema). Markdown (content_md) ist kanonisch.
  await query(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title       text NOT NULL,
      icon        text,
      created_by  text,
      created_at  timestamptz DEFAULT now()
    );
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS pages (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      notebook_id uuid REFERENCES notebooks ON DELETE CASCADE,
      parent_id   uuid REFERENCES pages ON DELETE CASCADE,
      title       text NOT NULL DEFAULT 'Unbenannt',
      position    int NOT NULL DEFAULT 0,
      content_md  text NOT NULL DEFAULT '',
      created_by  text,
      updated_by  text,
      created_at  timestamptz DEFAULT now(),
      updated_at  timestamptz DEFAULT now(),
      search_tsv  tsvector GENERATED ALWAYS AS (
        to_tsvector('german', coalesce(title,'') || ' ' || coalesce(content_md,''))
      ) STORED
    );
  `)

  await query(`CREATE INDEX IF NOT EXISTS pages_search_tsv_idx ON pages USING GIN (search_tsv);`)

  // Rollen pro Notizbuch. user_sub = Mitglieds-Identifikator (preferred_username
  // bzw. sub, siehe access.userKey). Notizbücher ohne Mitglieder sind nur für
  // globale Admins zugänglich.
  await query(`
    CREATE TABLE IF NOT EXISTS notebook_members (
      notebook_id uuid REFERENCES notebooks ON DELETE CASCADE,
      user_sub    text,
      user_name   text,
      role        text NOT NULL CHECK (role IN ('owner','editor','viewer')),
      created_at  timestamptz DEFAULT now(),
      PRIMARY KEY (notebook_id, user_sub)
    );
  `)

  // Versionshistorie: Snapshot des bisherigen Stands einer Seite vor jedem Update
  // (mit Debounce gegen Autosave-Spam, siehe pages.js).
  await query(`
    CREATE TABLE IF NOT EXISTS page_versions (
      id          bigserial PRIMARY KEY,
      page_id     uuid REFERENCES pages ON DELETE CASCADE,
      title       text,
      content_md  text,
      edited_by   text,
      edited_at   timestamptz DEFAULT now()
    );
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS page_versions_page_id_edited_at_idx
      ON page_versions (page_id, edited_at DESC);
  `)

  // pgvector-Extension + Embeddings-Tabelle für semantische/hybride Suche.
  // nomic-embed-text liefert 768 Dimensionen. In PGlite kommt die Extension
  // über die Adapter-Konfiguration (extensions: { vector }).
  await query(`CREATE EXTENSION IF NOT EXISTS vector;`)

  await query(`
    CREATE TABLE IF NOT EXISTS page_embeddings (
      id           bigserial PRIMARY KEY,
      page_id      uuid REFERENCES pages ON DELETE CASCADE,
      chunk_index  int NOT NULL,
      heading_path text,
      chunk_text   text NOT NULL,
      embedding    vector(768),
      created_at   timestamptz DEFAULT now()
    );
  `)

  await query(`CREATE INDEX IF NOT EXISTS page_embeddings_page_id_idx ON page_embeddings (page_id);`)

  // HNSW-Index für Cosine-ANN. Idempotent via IF NOT EXISTS. In PGlite ist HNSW
  // evtl. nicht verfügbar — dann tolerant ignorieren (die Cosine-Suche per <=>
  // funktioniert auch ohne Index, nur ohne ANN-Beschleunigung).
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS page_embeddings_embedding_hnsw_idx
        ON page_embeddings USING hnsw (embedding vector_cosine_ops);
    `)
  } catch (err) {
    console.warn('HNSW-Index nicht verfügbar (Cosine-Suche läuft ohne ANN-Index):', err.message)
  }

  // Favoriten pro Nutzer (user_sub = preferred_username/sub, siehe access.userKey).
  await query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_sub   text,
      page_id    uuid REFERENCES pages ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_sub, page_id)
    );
  `)

  // Instanz-weite Einstellungen (key/value), z.B. AI-/Ollama-Konfiguration.
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        text PRIMARY KEY,
      value      jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz DEFAULT now(),
      updated_by text
    );
  `)

  // Demo-Daten nur seeden, wenn noch gar keine Notizbücher existieren.
  await seedDemo()
}

// Idempotentes Seed: legt ein Demo-Notizbuch "Engineering" mit verschachtelten
// Seiten an, falls noch keine Notizbücher vorhanden sind.
async function seedDemo() {
  const { rows } = await query('SELECT count(*)::int AS n FROM notebooks')
  if (rows[0].n > 0) return

  const nb = await query(
    `INSERT INTO notebooks (title, icon, created_by) VALUES ($1, $2, $3) RETURNING id`,
    ['Engineering', '🛠️', 'seed'],
  )
  const notebookId = nb.rows[0].id

  // Top-Level-Seite "Getting Started".
  const root = await query(
    `INSERT INTO pages (notebook_id, parent_id, title, position, content_md, created_by, updated_by)
     VALUES ($1, NULL, $2, 0, $3, 'seed', 'seed') RETURNING id`,
    [
      notebookId,
      'Getting Started',
      '# Getting Started\n\nWillkommen im **Engineering**-Notizbuch. Hier sammeln wir Architektur, Runbooks und Onboarding.',
    ],
  )
  const rootId = root.rows[0].id

  // Kind-Seiten unter "Getting Started".
  await query(
    `INSERT INTO pages (notebook_id, parent_id, title, position, content_md, created_by, updated_by)
     VALUES
       ($1, $2, $3, 0, $4, 'seed', 'seed'),
       ($1, $2, $5, 1, $6, 'seed', 'seed')`,
    [
      notebookId,
      rootId,
      'Architektur',
      '# Architektur\n\nDas System besteht aus Fastify-API, PostgreSQL mit pgvector und MinIO als Object-Storage. Die Volltextsuche nutzt Postgres tsvector.',
      'Runbook: Deployment',
      '# Deployment Runbook\n\n1. Container bauen\n2. Migrationen laufen automatisch beim Boot\n3. Health-Check unter /health prüfen',
    ],
  )

  // Zweite Top-Level-Seite ohne Kinder.
  await query(
    `INSERT INTO pages (notebook_id, parent_id, title, position, content_md, created_by, updated_by)
     VALUES ($1, NULL, $2, 1, $3, 'seed', 'seed')`,
    [
      notebookId,
      'Team',
      '# Team\n\nUnser Engineering-Team arbeitet remote-first mit Fokus auf Wissensmanagement.',
    ],
  )
}
