import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, InputBase, Avatar, CircularProgress, useTheme, Tooltip, IconButton } from '@mui/material'
import { ChevronRight, Check, Loader2, AlertTriangle, Code2, FileText, History } from 'lucide-react'
import { Breadcrumb, EmptyState } from '@erato/ui'
import TipTapView from './editor/TipTapView'

function SaveIndicator({ status }) {
  if (status === 'saving') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
        <Loader2 size={15} className="erato-spin" />
        <Typography variant="caption">Speichert…</Typography>
      </Box>
    )
  }
  if (status === 'error') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
        <AlertTriangle size={15} />
        <Typography variant="caption">Nicht gespeichert</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
      <Check size={15} />
      <Typography variant="caption">Gespeichert</Typography>
    </Box>
  )
}

const AUTOSAVE_MS = 1000

// page: { id, notebookId, parentId, title, contentMd, updatedAt, updatedBy } | null
// onSave(pageId, { title?, contentMd? }) -> Promise<{ ok, updatedAt }>
export default function Editor({ page, breadcrumb, loading, onSave, onLocalChange, onOpenHistory }) {
  const theme = useTheme()
  const mode = theme.palette.mode // light | dark — steuert Highlight-Töne
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('') // Markdown (kanonisch)
  const [status, setStatus] = useState('saved') // 'saved' | 'saving' | 'error'
  const [sourceMode, setSourceMode] = useState(false) // WYSIWYG (false) ⇄ Markdown-Quelltext (true)
  const timerRef = useRef(null)
  const loadedIdRef = useRef(null)

  // Bei Seitenwechsel ODER Neuladen (z.B. nach Wiederherstellen einer Version):
  // lokalen Zustand aus der geladenen Seite befüllen. updatedAt als zusätzliches
  // Signal, damit ein Reload derselben Seite (gleiche id) den Editor aktualisiert.
  useEffect(() => {
    if (page) {
      setTitle(page.title ?? '')
      setContent(page.contentMd ?? '')
      setStatus('saved')
      loadedIdRef.current = page.id
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [page?.id, page?.updatedAt])

  const scheduleSave = useCallback((patch) => {
    if (!page?.id) return
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await onSave?.(page.id, patch)
        setStatus('saved')
        onLocalChange?.(page.id, patch) // z.B. Titel im Baum aktualisieren
      } catch (err) {
        console.warn('Autosave fehlgeschlagen:', err.message)
        setStatus('error')
      }
    }, AUTOSAVE_MS)
  }, [page?.id, onSave, onLocalChange])

  const handleTitle = (v) => {
    setTitle(v)
    scheduleSave({ title: v, contentMd: content })
  }
  const handleContent = useCallback((md) => {
    setContent(md)
    scheduleSave({ title, contentMd: md })
  }, [title, scheduleSave])

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (!page) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon={<FileText size={22} />}
          title="Keine Seite ausgewählt"
          description="Wähle links eine Seite oder lege eine neue an."
        />
      </Box>
    )
  }

  const initials = (page.updatedBy ?? 'CP').slice(0, 2).toUpperCase()

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      {/* Spinner-Keyframe */}
      <style>{'@keyframes erato-spin{to{transform:rotate(360deg)}}.erato-spin{animation:erato-spin 1s linear infinite}'}</style>

      {/* Top-Bar mit Quelltext-Umschalter + Autosave-Indikator */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, px: 3, py: 1, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Versionsverlauf">
          <IconButton size="small" onClick={() => onOpenHistory?.(page.id)} sx={{ color: 'text.secondary' }}>
            <History size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title={sourceMode ? 'WYSIWYG' : 'Markdown-Quelltext'}>
          <IconButton size="small" onClick={() => setSourceMode((s) => !s)} sx={{ color: 'text.secondary' }}>
            {sourceMode ? <FileText size={16} /> : <Code2 size={16} />}
          </IconButton>
        </Tooltip>
        <SaveIndicator status={status} />
      </Box>

      {/* Inhalt, zentriert, ruhige Optik */}
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 4, py: 5 }}>
        {breadcrumb?.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Breadcrumb
              items={breadcrumb}
              separator={<ChevronRight size={13} style={{ margin: '0 2px', opacity: 0.6 }} />}
            />
          </Box>
        )}

        <InputBase
          value={title}
          onChange={(e) => handleTitle(e.target.value)}
          placeholder="Ohne Titel"
          multiline
          sx={{
            mb: 1, width: '100%',
            '& textarea, & input': { p: 0 },
            fontSize: (t) => t.typography.h1.fontSize,
            fontWeight: (t) => t.typography.h1.fontWeight,
            lineHeight: (t) => t.typography.h1.lineHeight,
            color: 'text.primary',
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 4 }}>
          <Avatar sx={{ width: 20, height: 20, fontSize: 11, bgcolor: 'primary.main' }}>{initials}</Avatar>
          <Typography variant="caption">
            zuletzt bearbeitet von {page.updatedBy ?? 'unbekannt'}
            {page.updatedAt ? ` · ${new Date(page.updatedAt).toLocaleString('de-DE')}` : ''}
          </Typography>
        </Box>

        {/* WYSIWYG (TipTap) ⇄ Markdown-Quelltext. Beide schreiben denselben contentMd-Vertrag. */}
        {sourceMode ? (
          <InputBase
            value={content}
            onChange={(e) => handleContent(e.target.value)}
            placeholder="Schreibe in Markdown…"
            multiline
            minRows={18}
            sx={{
              width: '100%',
              alignItems: 'flex-start',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 14.5,
              lineHeight: 1.7,
              color: 'text.primary',
              '& textarea': { p: 0 },
            }}
          />
        ) : (
          <TipTapView
            key={`${page.id}:${page.updatedAt ?? ''}`}
            value={content}
            onChange={handleContent}
            mode={mode}
          />
        )}
        <Box sx={{ height: 120 }} />
      </Box>
    </Box>
  )
}
