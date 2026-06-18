import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip, Button, CircularProgress, Menu, MenuItem, ListItemIcon } from '@mui/material'
import {
  Search, NotebookText, Star, Settings, Sparkles,
  ChevronRight, ChevronDown, Plus, MoreHorizontal,
  Users, FileText, Trash2, FilePlus, GripVertical,
  Download, FolderDown, Upload, DatabaseBackup,
} from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  pointerWithin, DragOverlay,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { NotebookIcon } from '../notebookIcons'

// Flacht den Baum eines Notizbuchs in eine geordnete Liste der Geschwister
// auf jeder Ebene ab (für Positionsberechnung beim Drop).
function siblingsOf(pages, parentId) {
  if (parentId == null) return pages ?? []
  let found = null
  const walk = (list) => {
    for (const p of list ?? []) {
      if (p.id === parentId) { found = p.children ?? []; return }
      walk(p.children)
      if (found) return
    }
  }
  walk(pages)
  return found ?? []
}

// Sucht das Notizbuch, das eine Seite enthält.
function notebookOfPage(notebooks, pageId) {
  const inTree = (list) => (list ?? []).some((p) => p.id === pageId || inTree(p.children))
  return notebooks.find((nb) => inTree(nb.pages))
}

// Liefert true, wenn targetId ein Nachfahre (oder gleich) von pageId ist.
// Verhindert das Verschieben einer Seite in ihren eigenen Teilbaum.
function isDescendant(pages, pageId, targetId) {
  const find = (list) => {
    for (const p of list ?? []) {
      if (p.id === pageId) return p
      const r = find(p.children)
      if (r) return r
    }
    return null
  }
  const node = find(pages)
  if (!node) return false
  const within = (list) => (list ?? []).some((c) => c.id === targetId || within(c.children))
  return pageId === targetId || within(node.children)
}

function PageRow({ page, depth, activeId, onSelect, onAddChild, onDeletePage, dropState, favoriteIds, onToggleFavorite, onExportPage }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = page.children && page.children.length > 0
  const active = page.id === activeId
  const isFav = favoriteIds?.has(page.id)
  const [hover, setHover] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)

  const draggable = useDraggable({ id: `page:${page.id}` })
  // Drop-Zone "auf die Zeile" → wird Unterseite dieser Seite.
  const dropInto = useDroppable({ id: `into:${page.id}` })
  // Drop-Zone "zwischen Zeilen" (unterer Rand) → Geschwister nach dieser Seite.
  const dropAfter = useDroppable({ id: `after:${page.id}` })

  const isInto = dropState?.kind === 'into' && dropState.id === page.id
  const isAfter = dropState?.kind === 'after' && dropState.id === page.id

  return (
    <Box ref={draggable.setNodeRef} sx={{ opacity: draggable.isDragging ? 0.4 : 1 }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          ref={dropInto.setNodeRef}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => onSelect(page.id)}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 32,
            pr: 0.5,
            pl: `${8 + depth * 14}px`,
            borderRadius: 1.5,
            cursor: 'pointer',
            color: active ? 'text.primary' : 'text.secondary',
            fontWeight: active ? 600 : 400,
            bgcolor: active ? 'action.selected' : 'transparent',
            outline: isInto ? '2px solid' : 'none',
            outlineColor: 'primary.main',
            outlineOffset: '-2px',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {active && (
            <Box sx={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, bgcolor: 'primary.main' }} />
          )}
          {/* Drag-Handle: nur hier startet das Ziehen, damit Klick/Toggle frei bleiben. */}
          <Box
            {...draggable.listeners}
            {...draggable.attributes}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'grab', color: 'text.secondary',
              opacity: hover ? 0.6 : 0, transition: 'opacity .1s',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <GripVertical size={13} />
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
            sx={{ width: 18, height: 18, p: 0, visibility: hasChildren ? 'visible' : 'hidden', color: 'text.secondary' }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </IconButton>
          {depth < 2 && <FileText size={15} style={{ flexShrink: 0, opacity: 0.7 }} />}
          <Typography noWrap variant="body2" sx={{ flex: 1, fontWeight: 'inherit' }}>
            {page.title || 'Ohne Titel'}
          </Typography>
          {isFav && !hover && !menuAnchor && (
            <Star size={12} fill="currentColor" style={{ flexShrink: 0, opacity: 0.7, marginRight: 2 }} />
          )}
          {(hover || Boolean(menuAnchor)) && (
            <Box sx={{ display: 'flex' }}>
              <Tooltip title="Unterseite hinzufügen">
                <IconButton
                  size="small"
                  sx={{ width: 22, height: 22 }}
                  onClick={(e) => { e.stopPropagation(); onAddChild?.(page.id) }}
                >
                  <Plus size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Mehr">
                <IconButton size="small" sx={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget) }}>
                  <MoreHorizontal size={14} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
        {/* Geschwister-Drop-Zone am unteren Rand der Zeile. */}
        <Box
          ref={dropAfter.setNodeRef}
          sx={{ position: 'absolute', left: 0, right: 0, bottom: -3, height: 8, zIndex: 1 }}
        />
        {isAfter && (
          <Box sx={{ position: 'absolute', left: `${8 + depth * 14}px`, right: 4, bottom: -1, height: 2, borderRadius: 1, bgcolor: 'primary.main', zIndex: 2 }} />
        )}
      </Box>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => { setMenuAnchor(null); onAddChild?.(page.id) }}>
          <ListItemIcon><FilePlus size={16} /></ListItemIcon>
          Unterseite
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onToggleFavorite?.(page.id) }}>
          <ListItemIcon><Star size={16} fill={isFav ? 'currentColor' : 'none'} /></ListItemIcon>
          {isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onExportPage?.(page.id, false) }}>
          <ListItemIcon><Download size={16} /></ListItemIcon>
          Exportieren (.md)
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onExportPage?.(page.id, true) }}>
          <ListItemIcon><FolderDown size={16} /></ListItemIcon>
          Mit Unterseiten (ZIP)
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onDeletePage?.(page.id) }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Trash2 size={16} color="currentColor" /></ListItemIcon>
          Löschen
        </MenuItem>
      </Menu>
      {hasChildren && open && (
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: `${15 + depth * 14}px`, top: 0, bottom: 0, width: '1px', bgcolor: 'divider' }} />
          {page.children.map((c) => (
            <PageRow key={c.id} page={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} onAddChild={onAddChild} onDeletePage={onDeletePage} dropState={dropState} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onExportPage={onExportPage} />
          ))}
        </Box>
      )}
    </Box>
  )
}

// Eine Zeile in der Favoritenliste.
function FavoriteRow({ fav, activeId, onSelect, onToggleFavorite }) {
  const active = fav.pageId === activeId
  return (
    <Box
      onClick={() => onSelect(fav.pageId)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 36, px: 1, borderRadius: 1.5, cursor: 'pointer',
        bgcolor: active ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <FileText size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap variant="body2" sx={{ color: 'text.primary' }}>{fav.title || 'Ohne Titel'}</Typography>
        {fav.notebookTitle && (
          <Typography noWrap variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}>{fav.notebookTitle}</Typography>
        )}
      </Box>
      <Tooltip title="Aus Favoriten entfernen">
        <IconButton size="small" sx={{ width: 24, height: 24, color: 'primary.main' }} onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(fav.pageId) }}>
          <Star size={14} fill="currentColor" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

// Drop-Zone für die oberste Ebene eines Notizbuchs (Seite wird Top-Level).
function NotebookDropTop({ notebookId, active }) {
  const drop = useDroppable({ id: `nbtop:${notebookId}` })
  return (
    <Box
      ref={drop.setNodeRef}
      sx={{
        height: active ? 22 : 6,
        mx: 0.5,
        my: 0.25,
        borderRadius: 1,
        border: active ? '2px dashed' : 'none',
        borderColor: 'primary.main',
        transition: 'height .1s',
      }}
    />
  )
}

const RAIL = [
  { icon: Search, label: 'Suchen', key: 'search' },
  { icon: NotebookText, label: 'Notizbücher', key: 'notebooks' },
  { icon: Star, label: 'Favoriten', key: 'fav' },
  { icon: Sparkles, label: 'AI-Assistent', key: 'ai' },
]

// notebooks: [{ id, title, icon, pages: [tree] }]
export default function Sidebar({
  notebooks, activeId, onSelect, onOpenSearch, onOpenAi,
  onNewPage, onNewNotebook, onAddChild, onDeletePage, onOpenSettings, showSettings, loading,
  onReload, onMovePage, onOpenMembers, onOpenPreferences,
  favorites = [], favoriteIds = new Set(), onToggleFavorite,
  onExportPage, onExportNotebook, onExportNotebookErato, onImport, onDeleteNotebook,
  aiEnabled = true,
}) {
  const [panel, setPanel] = useState('notebooks') // 'notebooks' | 'favorites'
  // AI-Eintrag nur zeigen, wenn ein LLM (Ollama) verfügbar ist.
  const rail = RAIL.filter((r) => r.key !== 'ai' || aiEnabled)
  const railAction = {
    search: onOpenSearch,
    ai: onOpenAi,
    notebooks: () => setPanel('notebooks'),
    fav: () => setPanel('favorites'),
  }
  const [dragPageId, setDragPageId] = useState(null)
  const [dropState, setDropState] = useState(null) // { kind, id } | { kind:'nbtop', id }
  const [nbMenu, setNbMenu] = useState(null) // { anchor, notebook }
  // Zugeklappte Notizbücher (in localStorage gemerkt).
  const [collapsed, setCollapsed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('erato:nbCollapsed') || '[]')) } catch { return new Set() }
  })
  const toggleCollapsed = (id) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem('erato:nbCollapsed', JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Übersetzt die over-Droppable-Id in einen konkreten Zielzustand.
  const parseOver = (overId) => {
    if (!overId) return null
    const [kind, rawId] = overId.split(':')
    if (kind === 'nbtop') return { kind: 'nbtop', id: rawId }
    if (kind === 'into' || kind === 'after') return { kind, id: rawId }
    return null
  }

  const handleDragStart = (e) => {
    const id = String(e.active.id).replace(/^page:/, '')
    setDragPageId(id)
  }

  const handleDragOver = (e) => {
    setDropState(parseOver(e.over?.id))
  }

  const handleDragCancel = () => {
    setDragPageId(null)
    setDropState(null)
  }

  const handleDragEnd = (e) => {
    const pageId = String(e.active.id).replace(/^page:/, '')
    const target = parseOver(e.over?.id)
    setDragPageId(null)
    setDropState(null)
    if (!target || !pageId || !onMovePage) return

    let parentId = null
    let position = 0

    if (target.kind === 'nbtop') {
      // Oberste Ebene des Notizbuchs → ans Ende.
      const nb = notebooks.find((n) => String(n.id) === target.id)
      parentId = null
      position = (nb?.pages ?? []).length
    } else if (target.kind === 'into') {
      // Auf eine Zeile fallengelassen → Unterseite dieser Seite (ans Ende).
      if (isDescendant(notebookOfPage(notebooks, pageId)?.pages, pageId, target.id)) return
      if (String(target.id) === String(pageId)) return
      parentId = target.id
      const children = siblingsOf(notebookOfPage(notebooks, target.id)?.pages, target.id)
      position = children.length
    } else if (target.kind === 'after') {
      // Zwischen Zeilen → Geschwister direkt nach der Zielzeile.
      if (isDescendant(notebookOfPage(notebooks, pageId)?.pages, pageId, target.id)) return
      const nb = notebookOfPage(notebooks, target.id)
      const findParentAndList = (list, par) => {
        for (const p of list ?? []) {
          if (p.id === target.id) return { par, list }
          const r = findParentAndList(p.children, p.id)
          if (r) return r
        }
        return null
      }
      const ctx = findParentAndList(nb?.pages, null)
      if (!ctx) return
      parentId = ctx.par
      const idx = ctx.list.findIndex((p) => p.id === target.id)
      // Nur Indizes ohne die gezogene Seite zählen (falls gleiches Parent).
      const ordered = ctx.list.filter((p) => p.id !== pageId)
      const targetOrderedIdx = ordered.findIndex((p) => p.id === target.id)
      position = targetOrderedIdx + 1
      if (idx < 0) position = ctx.list.length
    }

    Promise.resolve(onMovePage(pageId, { parentId, position }))
      .then(() => onReload?.())
      .catch(() => {})
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', borderRight: '1px solid', borderColor: 'divider' }}>
      {/* Icon-Rail */}
      <Box sx={{ width: 52, flexShrink: 0, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1.5, gap: 0.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, mb: 1.5 }}>E</Box>
        {rail.map((r) => {
          const active = r.key === panel
          return (
            <Tooltip key={r.key} title={r.label} placement="right">
              <span>
                <IconButton
                  disabled={r.disabled}
                  onClick={railAction[r.key]}
                  sx={{ width: 36, height: 36, color: active ? 'primary.main' : 'text.secondary', bgcolor: active ? 'action.selected' : 'transparent' }}
                >
                  <r.icon size={20} />
                </IconButton>
              </span>
            </Tooltip>
          )
        })}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Einstellungen" placement="right">
          <IconButton onClick={onOpenPreferences} sx={{ width: 36, height: 36, color: 'text.secondary' }}><Settings size={20} /></IconButton>
        </Tooltip>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, mt: 0.5 }}>KK</Box>
      </Box>

      {/* Baum-Sidebar */}
      <Box sx={{ width: 260, flexShrink: 0, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
        {panel === 'notebooks' && (
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Plus size={16} />}
              onClick={() => onNewPage?.()}
              sx={{ justifyContent: 'flex-start', color: 'text.primary', borderColor: 'divider' }}
            >
              Neue Seite
            </Button>
            <Button
              fullWidth
              size="small"
              startIcon={<NotebookText size={15} />}
              onClick={() => onNewNotebook?.()}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
            >
              Notizbuch anlegen
            </Button>
          </Box>
        )}
        {panel === 'favorites' && (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <Star size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 11 }}>Favoriten</Typography>
          </Box>
        )}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 2 }}>
          {panel === 'favorites' && (
            favorites.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">Noch keine Favoriten.</Typography>
                <Typography variant="caption">Über das „…"-Menü einer Seite hinzufügen.</Typography>
              </Box>
            ) : (
              favorites.map((f) => (
                <FavoriteRow key={f.pageId} fav={f} activeId={activeId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
              ))
            )
          )}
          {panel === 'notebooks' && loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {panel === 'notebooks' && !loading && (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {notebooks.map((nb) => {
                const pages = nb.pages ?? []
                const isCollapsed = collapsed.has(nb.id)
                const topActive = dragPageId && dropState?.kind === 'nbtop' && String(dropState.id) === String(nb.id)
                return (
                  <Box key={nb.id} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.5, color: 'text.secondary' }}>
                      <IconButton size="small" sx={{ width: 18, height: 18, p: 0, color: 'text.secondary' }} onClick={() => toggleCollapsed(nb.id)}>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </IconButton>
                      <NotebookIcon icon={nb.icon} size={16} />
                      <Typography
                        variant="caption"
                        onClick={() => toggleCollapsed(nb.id)}
                        sx={{ flex: 1, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 11, cursor: 'pointer', userSelect: 'none' }}
                      >
                        {nb.title}
                      </Typography>
                      <Tooltip title="Seite in diesem Notizbuch">
                        <IconButton size="small" sx={{ width: 20, height: 20 }} onClick={() => onNewPage?.(nb.id)}>
                          <Plus size={13} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Notizbuch-Optionen">
                        <IconButton size="small" sx={{ width: 20, height: 20 }} onClick={(e) => setNbMenu({ anchor: e.currentTarget, notebook: nb })}>
                          <MoreHorizontal size={13} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {!isCollapsed && (
                      <>
                        {dragPageId && <NotebookDropTop notebookId={nb.id} active={topActive} />}
                        {pages.map((p) => (
                          <PageRow key={p.id} page={p} depth={0} activeId={activeId} onSelect={onSelect} onAddChild={onAddChild} onDeletePage={onDeletePage} dropState={dropState} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onExportPage={onExportPage} />
                        ))}
                      </>
                    )}
                  </Box>
                )
              })}
              <DragOverlay dropAnimation={null}>
                {dragPageId ? (
                  <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', boxShadow: 2, display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 230 }}>
                    <FileText size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <Typography noWrap variant="body2">Seite verschieben…</Typography>
                  </Box>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </Box>
      </Box>

      <Menu anchorEl={nbMenu?.anchor} open={!!nbMenu} onClose={() => setNbMenu(null)}>
        <MenuItem onClick={() => { const nb = nbMenu?.notebook; setNbMenu(null); onOpenMembers?.(nb) }}>
          <ListItemIcon><Users size={16} /></ListItemIcon>
          Mitglieder…
        </MenuItem>
        <MenuItem onClick={() => { const nb = nbMenu?.notebook; setNbMenu(null); onExportNotebook?.(nb.id) }}>
          <ListItemIcon><FolderDown size={16} /></ListItemIcon>
          Exportieren → Markdown (ZIP)
        </MenuItem>
        <MenuItem onClick={() => { const nb = nbMenu?.notebook; setNbMenu(null); onExportNotebookErato?.(nb.id) }}>
          <ListItemIcon><DatabaseBackup size={16} /></ListItemIcon>
          Exportieren → Erato (1:1)
        </MenuItem>
        <MenuItem onClick={() => { const nb = nbMenu?.notebook; setNbMenu(null); onImport?.(nb) }}>
          <ListItemIcon><Upload size={16} /></ListItemIcon>
          Importieren…
        </MenuItem>
        <MenuItem onClick={() => { const nb = nbMenu?.notebook; setNbMenu(null); onDeleteNotebook?.(nb) }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Trash2 size={16} color="currentColor" /></ListItemIcon>
          Löschen
        </MenuItem>
      </Menu>
    </Box>
  )
}
