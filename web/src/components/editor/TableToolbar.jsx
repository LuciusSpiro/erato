import { BubbleMenu } from '@tiptap/react'
import { Paper, Button, Divider, IconButton, Tooltip } from '@mui/material'
import { Trash2 } from 'lucide-react'

// Funktionsleiste für Tabellen: erscheint, wenn der Cursor in einer Tabelle steht.
// Spalten/Zeilen hinzufügen/entfernen, Kopfzeile umschalten, Tabelle löschen.
export default function TableToolbar({ editor }) {
  if (!editor) return null
  const c = () => editor.chain().focus()
  const btn = { textTransform: 'none', minWidth: 'auto', px: 1, color: 'text.secondary' }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableToolbar"
      tippyOptions={{ duration: 100, placement: 'bottom' }}
      shouldShow={({ editor: ed }) => ed.isActive('table')}
    >
      <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, p: 0.5, border: '1px solid', borderColor: 'divider' }}>
        <Button size="small" sx={btn} onClick={() => c().addColumnAfter().run()}>Spalte +</Button>
        <Button size="small" sx={btn} onClick={() => c().deleteColumn().run()}>Spalte −</Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Button size="small" sx={btn} onClick={() => c().addRowAfter().run()}>Zeile +</Button>
        <Button size="small" sx={btn} onClick={() => c().deleteRow().run()}>Zeile −</Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Button size="small" sx={btn} onClick={() => c().toggleHeaderRow().run()}>Kopfzeile</Button>
        <Tooltip title="Tabelle löschen">
          <IconButton size="small" color="error" onClick={() => c().deleteTable().run()}><Trash2 size={15} /></IconButton>
        </Tooltip>
      </Paper>
    </BubbleMenu>
  )
}
