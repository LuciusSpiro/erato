// Reine Helfer für Export/Import (ohne DB) — testbar.
import path from 'node:path'
import JSZip from 'jszip'

// Dateisystem-sicherer, lesbarer Slug aus einem Titel.
export function slugify(title) {
  const s = (title || 'seite')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // Diakritika entfernen
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'seite'
}

// Baum aus flachen Zeilen {id, parent_id, title, position, content_md}.
export function buildTree(rows) {
  const byId = new Map()
  for (const r of rows) {
    byId.set(r.id, { id: r.id, parentId: r.parent_id, title: r.title, position: r.position, contentMd: r.content_md, children: [] })
  }
  const roots = []
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId).children.push(n)
    else roots.push(n)
  }
  const sortRec = (list) => { list.sort((a, b) => a.position - b.position); list.forEach((n) => sortRec(n.children)) }
  sortRec(roots)
  return roots
}

// Knoten per id im Baum finden.
export function findNode(nodes, id) {
  for (const n of nodes ?? []) {
    if (n.id === id) return n
    const r = findNode(n.children, id)
    if (r) return r
  }
  return null
}

// Map pageId -> relativer Dateipfad. Seite mit Kindern -> "<slug>/index.md",
// Blatt -> "<slug>.md". Geschwister-Kollisionen werden dedupliziert.
export function buildPathMap(nodes, base = '', map = new Map()) {
  const used = new Set()
  for (const n of nodes ?? []) {
    const slug = slugify(n.title)
    let s = slug; let i = 2
    while (used.has(s)) s = `${slug}-${i++}`
    used.add(s)
    if (n.children && n.children.length) {
      const folder = `${base}${s}/`
      map.set(n.id, `${folder}index.md`)
      buildPathMap(n.children, folder, map)
    } else {
      map.set(n.id, `${base}${s}.md`)
    }
  }
  return map
}

// Markdown einer Seite. Titel als H1 voranstellen, falls noch keine H1 am Anfang.
export function pageMarkdown(node) {
  const md = node.contentMd || ''
  if (/^\s*#\s/.test(md)) return md
  return `# ${node.title || 'Unbenannt'}\n\n${md}`
}

// Interne Links (#/page/<id>) -> relativer .md-Pfad, falls Ziel im Bündel.
export function rewriteLinks(md, currentPath, pathMap) {
  return (md || '').replace(/\]\(#\/page\/([0-9A-Za-z-]+)\)/g, (m, id) => {
    const target = pathMap.get(id)
    if (!target) return m
    let rel = path.posix.relative(path.posix.dirname(currentPath), target)
    if (!rel.startsWith('.')) rel = `./${rel}`
    return `](${rel})`
  })
}

// Interne Links auf neue IDs umschreiben (Erato-Import "als Kopie").
export function remapLinks(md, idMap) {
  return (md || '').replace(/#\/page\/([0-9A-Za-z-]+)/g, (m, id) => (idMap.has(id) ? `#/page/${idMap.get(id)}` : m))
}

function writeNodes(zip, nodes, map) {
  for (const n of nodes ?? []) {
    const file = map.get(n.id)
    zip.file(file, rewriteLinks(pageMarkdown(n), file, map))
    if (n.children?.length) writeNodes(zip, n.children, map)
  }
}

// ZIP eines (Teil-)Baums; Bündel-Wurzel = die übergebenen Knoten.
export async function zipFromNodes(nodes) {
  const zip = new JSZip()
  const map = buildPathMap(nodes, '')
  writeNodes(zip, nodes, map)
  return zip.generateAsync({ type: 'nodebuffer' })
}

// ZIP mehrerer Notizbücher: ein Ordner pro Notizbuch (Titel dedupliziert).
// notebooks: [{ title, pages: <Baum> }]. Cross-Notebook-Links werden korrekt aufgelöst.
export async function zipFromNotebooks(notebooks) {
  const zip = new JSZip()
  const map = new Map()
  const used = new Set()
  const bases = (notebooks ?? []).map((nb) => {
    const slug = slugify(nb.title); let s = slug; let i = 2
    while (used.has(s)) s = `${slug}-${i++}`
    used.add(s)
    return { nb, base: `${s}/` }
  })
  for (const { nb, base } of bases) buildPathMap(nb.pages, base, map)
  for (const { nb } of bases) writeNodes(zip, nb.pages, map)
  return zip.generateAsync({ type: 'nodebuffer' })
}

// Titel aus Markdown (erste H1) oder Dateiname.
export function titleFromMd(text, filename) {
  const m = /^\s*#\s+(.+)$/m.exec(text || '')
  if (m) return m[1].trim()
  return (filename || 'Importiert').replace(/\.(md|markdown)$/i, '')
}

// Baum für das native Erato-Format auf reine Inhalts-/Strukturfelder reduzieren.
export function toEratoNodes(nodes) {
  return (nodes ?? []).map((n) => ({
    id: n.id, title: n.title, position: n.position, contentMd: n.contentMd ?? '',
    children: toEratoNodes(n.children),
  }))
}
