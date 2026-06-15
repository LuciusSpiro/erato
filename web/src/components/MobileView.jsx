import { useState } from 'react'
import { Box, Typography, Avatar, IconButton, Drawer, CircularProgress } from '@mui/material'
import {
  Menu, Search, NotebookText, Sparkles, User, ChevronRight, ChevronDown,
  Code2, Lightbulb, Users, FileText,
} from 'lucide-react'

const NB_ICONS = { Code2, Lightbulb, Users }

const TABS = [
  { icon: Search, label: 'Suche' },
  { icon: NotebookText, label: 'Notizen', active: true },
  { icon: Sparkles, label: 'AI' },
  { icon: User, label: 'Profil' },
]

// Eine Seitenzeile im Mobile-Baum (vereinfachte Sidebar-Logik: nur Navigation).
function PageRow({ page, depth, activeId, onSelect }) {
  const hasChildren = page.children && page.children.length > 0
  const [open, setOpen] = useState(depth < 1)
  const active = page.id === activeId
  return (
    <Box>
      <Box
        onClick={() => onSelect(page.id)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 40,
          pr: 1, pl: `${10 + depth * 16}px`, borderRadius: 1.5, cursor: 'pointer',
          color: active ? 'primary.main' : 'text.primary',
          bgcolor: active ? 'action.selected' : 'transparent',
          '&:active': { bgcolor: 'action.hover' },
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          sx={{ width: 24, height: 24, p: 0, visibility: hasChildren ? 'visible' : 'hidden', color: 'text.secondary' }}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </IconButton>
        <FileText size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
        <Typography noWrap variant="body2" sx={{ flex: 1 }}>{page.title || 'Ohne Titel'}</Typography>
      </Box>
      {hasChildren && open && page.children.map((c) => (
        <PageRow key={c.id} page={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
      ))}
    </Box>
  )
}

// Mobile-Ansicht auf echten Daten: Drawer-Baum (Navigation) + Lesemodus.
// notebooks: [{ id, title, icon, pages: [tree] }]
// page: aktive Seite { id, title, contentMd, ... } | null
// onSelect(pageId): Auswahl-Callback
export default function MobileView({ notebooks = [], page, activeId, onSelect, loading }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSelect = (id) => {
    onSelect?.(id)
    setDrawerOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100%', py: 5, bgcolor: 'background.paper' }}>
      {/* Phone-Frame */}
      <Box id="mobile-frame-anchor" sx={{ width: 390, height: 760, bgcolor: 'background.default', borderRadius: 5, border: '8px solid', borderColor: 'grey.900', boxShadow: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Top-Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <IconButton size="small" onClick={() => setDrawerOpen(true)}><Menu size={22} /></IconButton>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', overflow: 'hidden' }}>
            <Typography variant="caption" noWrap>{page?.title ?? 'Notizen'}</Typography>
          </Box>
          <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
            {(page?.updatedBy ?? 'CP').slice(0, 2).toUpperCase()}
          </Avatar>
        </Box>

        {/* Lesemodus der aktiven Seite */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={22} />
            </Box>
          ) : page ? (
            <>
              <Typography variant="h1" sx={{ fontSize: '1.6rem', mb: 1 }}>{page.title || 'Ohne Titel'}</Typography>
              {page.updatedBy && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                  zuletzt bearbeitet von {page.updatedBy}
                  {page.updatedAt ? ` · ${new Date(page.updatedAt).toLocaleDateString('de-DE')}` : ''}
                </Typography>
              )}
              <Box
                component="pre"
                sx={{
                  m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65, color: 'text.primary',
                }}
              >
                {page.contentMd || '(Diese Seite ist leer.)'}
              </Box>
            </>
          ) : (
            <Box sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
              <NotebookText size={28} style={{ opacity: 0.4 }} />
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                Keine Seite ausgewählt. Tippe oben links auf das Menü.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Untere Tab-Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {TABS.map((t, i) => (
            <Box
              key={i}
              onClick={t.label === 'Notizen' ? () => setDrawerOpen(true) : undefined}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, color: t.active ? 'primary.main' : 'text.secondary', cursor: 'pointer' }}
            >
              <t.icon size={22} />
              <Typography variant="caption" sx={{ fontSize: 10 }}>{t.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Notizbuch-Baum als Hamburger-Drawer (innerhalb des Phone-Frames) */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          variant="temporary"
          ModalProps={{ container: () => document.getElementById('mobile-frame-anchor') ?? document.body }}
          slotProps={{ paper: { sx: { width: 300, bgcolor: 'background.paper', position: 'absolute' } } }}
          sx={{ position: 'absolute', '& .MuiBackdrop-root': { position: 'absolute' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <NotebookText size={18} style={{ opacity: 0.7 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Notizbücher</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1.5 }}>
            {notebooks.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', px: 1.5, py: 2 }}>
                Keine Notizbücher.
              </Typography>
            )}
            {notebooks.map((nb) => {
              const NbIcon = NB_ICONS[nb.icon] || NotebookText
              const pages = nb.pages ?? []
              return (
                <Box key={nb.id} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, color: 'text.secondary' }}>
                    <NbIcon size={16} />
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 11 }}>
                      {nb.title}
                    </Typography>
                  </Box>
                  {pages.map((p) => (
                    <PageRow key={p.id} page={p} depth={0} activeId={activeId} onSelect={handleSelect} />
                  ))}
                </Box>
              )
            })}
          </Box>
        </Drawer>
      </Box>
    </Box>
  )
}
