import { useState, useRef, useEffect } from 'react'
import {
  Drawer, Box, Typography, IconButton, InputBase, Chip, CircularProgress, Tooltip,
} from '@mui/material'
import { Sparkles, X, ArrowUp } from 'lucide-react'
import { useApi } from '../api'

const DRAWER_WIDTH = 380

// Ein einzelner Quellen-Chip. Klick öffnet die zugehörige Seite.
function SourceChip({ source, onOpenPage }) {
  return (
    <Tooltip title={(source.notebookPath ?? []).join(' › ')} placement="top">
      <Chip
        label={source.title}
        size="small"
        variant="outlined"
        onClick={() => source.pageId && onOpenPage?.(source.pageId)}
        sx={{
          maxWidth: 240,
          height: 24,
          fontSize: 12,
          color: 'text.secondary',
          borderColor: 'divider',
          cursor: source.pageId ? 'pointer' : 'default',
          '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', color: 'text.primary' },
        }}
      />
    </Tooltip>
  )
}

// Eine Nachricht im Verlauf (Frage oder Antwort).
function Message({ msg, onOpenPage }) {
  const isUser = msg.role === 'user'
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          maxWidth: '88%',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: isUser ? 'action.selected' : 'background.paper',
        }}
      >
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: msg.error ? 'text.secondary' : 'text.primary' }}
        >
          {msg.content}
        </Typography>
        {msg.sources && msg.sources.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {msg.sources.map((s, i) => (
              <SourceChip key={s.pageId ?? i} source={s} onOpenPage={onOpenPage} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default function AiPanel({ open, onClose, onOpenPage, notebookId }) {
  const api = useApi()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  // Verlauf nach unten scrollen, wenn neue Nachrichten kommen.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: q }])
    setLoading(true)
    try {
      const data = await api.aiChat(q, notebookId)
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data?.answer ?? 'Keine Antwort erhalten.',
        sources: data?.sources ?? [],
      }])
    } catch (err) {
      const msg = err?.status === 503
        ? 'AI derzeit nicht verfügbar. Bitte später erneut versuchen.'
        : 'Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.'
      setMessages((m) => [...m, { role: 'assistant', content: msg, error: true }])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      slotProps={{ paper: { sx: { width: DRAWER_WIDTH, borderLeft: '1px solid', borderColor: 'divider' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
        {/* Kopf */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Sparkles size={18} style={{ opacity: 0.7 }} />
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>AI-Assistent</Typography>
          <Tooltip title="Schließen">
            <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
          </Tooltip>
        </Box>

        {/* Verlauf */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {messages.length === 0 && !loading && (
            <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', px: 2 }}>
              <Sparkles size={28} style={{ opacity: 0.4 }} />
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                Frag deine Notizen. Antworten verweisen auf die passenden Seiten.
              </Typography>
            </Box>
          )}
          {messages.map((m, i) => (
            <Message key={i} msg={m} onOpenPage={onOpenPage} />
          ))}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <CircularProgress size={14} />
              <Typography variant="caption">denkt nach…</Typography>
            </Box>
          )}
          <Box ref={endRef} />
        </Box>

        {/* Eingabe */}
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box
            sx={{
              display: 'flex', alignItems: 'flex-end', gap: 1,
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              px: 1.5, py: 0.75, bgcolor: 'background.default',
              '&:focus-within': { borderColor: 'primary.main' },
            }}
          >
            <InputBase
              multiline
              maxRows={5}
              placeholder="Frage stellen…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              sx={{ flex: 1, fontSize: 14 }}
            />
            <Tooltip title="Senden">
              <span>
                <IconButton
                  size="small"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' } }}
                >
                  <ArrowUp size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Drawer>
  )
}
