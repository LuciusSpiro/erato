import { useState } from 'react'
import { BubbleMenu } from '@tiptap/react'
import {
  Paper, IconButton, Divider, Box, Popover, Tooltip, TextField, Button, Stack,
} from '@mui/material'
import { Bold, Italic, Strikethrough, Link as LinkIcon, Highlighter, X } from 'lucide-react'
import { HIGHLIGHTS } from '../../theme'

// Bubble-Toolbar bei Textauswahl: Bold/Italic/Strike/Link/Highlight.
// Highlight nutzt die feste Palette aus theme.js (HIGHLIGHTS), Farbton je nach mode.
export default function BubbleToolbar({ editor, mode = 'light' }) {
  const [hlAnchor, setHlAnchor] = useState(null)
  const [linkAnchor, setLinkAnchor] = useState(null)
  const [linkUrl, setLinkUrl] = useState('')

  if (!editor) return null

  const openLink = (e) => {
    setLinkUrl(editor.getAttributes('link').href ?? '')
    setLinkAnchor(e.currentTarget)
  }
  const applyLink = () => {
    const url = linkUrl.trim()
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkAnchor(null)
  }
  const setHighlight = (key) => {
    const color = HIGHLIGHTS[key]?.[mode]
    if (color) editor.chain().focus().setHighlight({ color }).run()
    setHlAnchor(null)
  }
  const clearHighlight = () => {
    editor.chain().focus().unsetHighlight().run()
    setHlAnchor(null)
  }

  const btnSx = (active) => ({
    borderRadius: 1,
    color: active ? 'primary.main' : 'text.secondary',
    bgcolor: active ? 'action.selected' : 'transparent',
  })

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="textToolbar"
      tippyOptions={{ duration: 100, placement: 'top' }}
      shouldShow={({ editor: ed, from, to }) => from !== to && !ed.isActive('codeBlock')}
    >
      <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', p: 0.5, gap: 0.25, border: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Fett">
          <IconButton size="small" sx={btnSx(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Kursiv">
          <IconButton size="small" sx={btnSx(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Durchgestrichen">
          <IconButton size="small" sx={btnSx(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={16} />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Tooltip title="Link">
          <IconButton size="small" sx={btnSx(editor.isActive('link'))} onClick={openLink}>
            <LinkIcon size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Highlight">
          <IconButton size="small" sx={btnSx(editor.isActive('highlight'))} onClick={(e) => setHlAnchor(e.currentTarget)}>
            <Highlighter size={16} />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Highlight-Palette */}
      <Popover
        open={!!hlAnchor}
        anchorEl={hlAnchor}
        onClose={() => setHlAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {Object.keys(HIGHLIGHTS).map((key) => (
            <Box
              key={key}
              onClick={() => setHighlight(key)}
              title={key}
              sx={{
                width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                bgcolor: HIGHLIGHTS[key][mode],
                border: '1px solid', borderColor: 'divider',
                '&:hover': { transform: 'scale(1.12)' },
              }}
            />
          ))}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <Tooltip title="Highlight entfernen">
            <IconButton size="small" onClick={clearHighlight}><X size={15} /></IconButton>
          </Tooltip>
        </Box>
      </Popover>

      {/* Link-Eingabe */}
      <Popover
        open={!!linkAnchor}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            autoFocus
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }}
            sx={{ width: 240 }}
          />
          <Button size="small" variant="contained" onClick={applyLink}>OK</Button>
        </Stack>
      </Popover>
    </BubbleMenu>
  )
}
