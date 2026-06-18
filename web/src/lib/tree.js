// Reine Baum-Helfer für Notizbuch-/Seitenbäume (testbar, ohne React).

// Pfad (Titel-Liste) zu einer Seite-id im Baum finden; null wenn nicht vorhanden.
export function findPath(pages, id, trail = []) {
  for (const p of pages ?? []) {
    const here = [...trail, p.title]
    if (p.id === id) return here
    const deeper = findPath(p.children, id, here)
    if (deeper) return deeper
  }
  return null
}

// Titel einer Seite im Baum aktualisieren (immutabel), für Autosave-Sync der Sidebar.
export function patchTitle(pages, id, title) {
  return (pages ?? []).map((p) =>
    p.id === id
      ? { ...p, title, children: patchTitle(p.children, id, title) }
      : { ...p, children: patchTitle(p.children, id, title) },
  )
}

// Alle Seiten flach auflisten (für den „Link zu Seite"-Picker).
// notebooks: [{ id, title, pages: [tree] }] → [{ id, title, notebookTitle }]
export function flattenPages(notebooks) {
  const out = []
  const walk = (list, nbTitle) => (list ?? []).forEach((p) => {
    out.push({ id: p.id, title: p.title, notebookTitle: nbTitle })
    walk(p.children, nbTitle)
  })
  ;(notebooks ?? []).forEach((nb) => walk(nb.pages, nb.title))
  return out
}
