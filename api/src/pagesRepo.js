import { query } from './db.js'

// Flache Seitenzeilen eines Notizbuchs (inkl. content_md) für den Export.
export async function notebookRows(notebookId) {
  const { rows } = await query(
    'SELECT id, parent_id, title, position, content_md FROM pages WHERE notebook_id = $1 ORDER BY position',
    [notebookId],
  )
  return rows
}

// Seite anlegen (Position = max+1 in der Ebene). Liefert die neue id. Für Importe.
export async function createPageRow(notebookId, parentId, title, contentMd, by) {
  const pos = await query(
    `SELECT coalesce(max(position), -1) + 1 AS next FROM pages
     WHERE notebook_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
    [notebookId, parentId ?? null],
  )
  const { rows } = await query(
    `INSERT INTO pages (notebook_id, parent_id, title, position, content_md, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
    [notebookId, parentId ?? null, title || 'Unbenannt', pos.rows[0].next, contentMd ?? '', by],
  )
  return rows[0].id
}
