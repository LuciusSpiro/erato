import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from 'tiptap-markdown'
import { Box } from '@mui/material'
import EditorStyles from './EditorStyles'
import BubbleToolbar from './BubbleToolbar'
import { SlashCommand, makeSlashSuggestion } from './slashMenu.jsx'

// Baut die Extension-Liste. multicolor:true + html:true sorgen dafür, dass farbige
// Highlights als <mark style="background-color:…"> erhalten bleiben (HTML im Markdown).
function buildExtensions() {
  return [
    StarterKit.configure({
      // codeBlock/blockquote/lists kommen aus StarterKit; Markdown-Inline-Shortcuts inklusive.
      heading: { levels: [1, 2, 3] },
    }),
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    Placeholder.configure({ placeholder: 'Schreibe etwas, oder tippe „/" für Befehle…' }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    // tiptap-markdown: kanonisches Speicherformat. html:true bewahrt <mark>/Tabellen-HTML.
    Markdown.configure({ html: true, tightLists: true, linkify: true, breaks: false, transformPastedText: true }),
    SlashCommand.configure({ suggestion: makeSlashSuggestion() }),
  ]
}

// WYSIWYG-Editor. value = Markdown (kanonisch). onChange(markdown) wird bei Edits gefeuert.
// Reagiert auf externe value-Wechsel (Seitenwechsel) ohne Cursor-Sprünge bei eigenen Edits.
export default function TipTapView({ value, onChange, mode = 'light', editable = true }) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: buildExtensions(),
    content: value ?? '',
    editable,
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true
      const md = ed.storage.markdown.getMarkdown()
      onChange?.(md)
    },
  }, [mode])

  // Externe value-Änderung (Seitenwechsel) in den Editor übernehmen,
  // aber nicht, wenn die Änderung gerade aus dem Editor selbst stammt.
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) { isInternalUpdate.current = false; return }
    const current = editor.storage.markdown.getMarkdown()
    if ((value ?? '') !== current) {
      editor.commands.setContent(value ?? '', false)
    }
  }, [value, editor])

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editable, editor])

  return (
    <Box>
      <EditorStyles />
      <BubbleToolbar editor={editor} mode={mode} />
      <EditorContent editor={editor} />
    </Box>
  )
}
