import { useEffect, useRef, useState } from 'react'
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
import TableToolbar from './TableToolbar'
import { SlashCommand, makeSlashSuggestion } from './slashMenu.jsx'
import PageLinkDialog from '../PageLinkDialog'
import { pageHref, parsePageHref } from '../../lib/pageLink'

// Baut die Extension-Liste. multicolor:true + html:true sorgen dafür, dass farbige
// Highlights als <mark style="background-color:…"> erhalten bleiben (HTML im Markdown).
function buildExtensions({ onRequestPageLink } = {}) {
  return [
    StarterKit.configure({
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
    Markdown.configure({ html: true, tightLists: true, linkify: true, breaks: false, transformPastedText: true }),
    SlashCommand.configure({ suggestion: makeSlashSuggestion({ onRequestPageLink }) }),
  ]
}

// WYSIWYG-Editor. value = Markdown (kanonisch). onChange(markdown) bei echten Edits.
// pages: [{id,title,notebookTitle}] für den „Link zu Seite"-Picker; onOpenPage(id) öffnet Links.
export default function TipTapView({ value, onChange, mode = 'light', editable = true, pages = [], onOpenPage, jump, indentSize = 2 }) {
  const isInternalUpdate = useRef(false)
  const requestRef = useRef(null)
  const pendingJumpRef = useRef(null)
  const editorRef = useRef(null)
  const indentRef = useRef(indentSize)
  indentRef.current = indentSize
  const [pickerOpen, setPickerOpen] = useState(false)

  const editor = useEditor({
    extensions: buildExtensions({ onRequestPageLink: () => requestRef.current?.() }),
    content: value ?? '',
    editable,
    editorProps: {
      // Tab in Code-Blöcken: konfigurierbare Anzahl Leerzeichen einfügen (Shift+Tab: ausrücken).
      handleKeyDown(view, event) {
        if (event.key !== 'Tab') return false
        const ed = editorRef.current
        if (!ed || !ed.isActive('codeBlock')) return false
        event.preventDefault()
        const n = Math.max(1, indentRef.current || 2)
        const { state } = view
        if (event.shiftKey) {
          const from = state.selection.from
          const start = Math.max(0, from - n)
          const before = state.doc.textBetween(start, from)
          let del = 0
          for (let i = before.length - 1; i >= 0 && before[i] === ' ' && del < n; i--) del++
          if (del > 0) view.dispatch(state.tr.delete(from - del, from))
        } else {
          view.dispatch(state.tr.insertText(' '.repeat(n)))
        }
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Nur ECHTE Nutzer-Edits speichern (Editor hat Fokus). Programmatisches
      // Laden (setContent), Mount und Teardown beim Seitenwechsel sind NICHT fokussiert
      // — sonst würde der Inhalt der vorherigen Seite unter der neuen Seiten-ID gespeichert.
      if (!ed.isFocused) return
      isInternalUpdate.current = true
      const md = ed.storage.markdown.getMarkdown()
      onChange?.(md)
    },
  }, [mode])

  // Picker-Öffner für die Slash-Extension bereitstellen (stabile Ref).
  requestRef.current = () => setPickerOpen(true)
  editorRef.current = editor

  const insertPageLink = (p) => {
    setPickerOpen(false)
    if (!editor || !p) return
    editor.chain().focus().insertContent([
      { type: 'text', text: p.title || 'Seite', marks: [{ type: 'link', attrs: { href: pageHref(p.id) } }] },
      { type: 'text', text: ' ' },
    ]).run()
  }

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

  // Zur Fundstelle springen (nach Klick auf ein Suchergebnis): Begriff im Dokument
  // suchen, auswählen und in den sichtbaren Bereich scrollen.
  const tryJump = () => {
    const term = pendingJumpRef.current
    if (!editor || !term) return false
    const q = term.toLowerCase()
    let pos = null
    editor.state.doc.descendants((node, p) => {
      if (pos != null) return false
      if (node.isText && node.text) {
        const i = node.text.toLowerCase().indexOf(q)
        if (i >= 0) { pos = p + i; return false }
      }
      return true
    })
    if (pos == null) return false
    const to = Math.min(pos + term.length, editor.state.doc.content.size)
    editor.chain().setTextSelection({ from: pos, to }).scrollIntoView().focus().run()
    pendingJumpRef.current = null
    return true
  }

  useEffect(() => {
    if (!jump?.term) return
    pendingJumpRef.current = jump.term
    // Mehrere Versuche, da der Seiteninhalt evtl. noch geladen/gesetzt wird.
    let tries = 0
    let timer
    const tick = () => {
      if (tryJump() || tries++ > 25) return
      timer = setTimeout(tick, 100)
    }
    timer = setTimeout(tick, 60)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.nonce, editor])

  // Klick auf einen internen Seiten-Link → in der App navigieren statt Browser-Sprung.
  const handleClick = (e) => {
    const a = e.target.closest?.('a')
    if (!a) return
    const id = parsePageHref(a.getAttribute('href'))
    if (id) { e.preventDefault(); onOpenPage?.(id) }
  }

  return (
    <Box onClick={handleClick}>
      <EditorStyles />
      <BubbleToolbar editor={editor} mode={mode} />
      <TableToolbar editor={editor} />
      <EditorContent editor={editor} />
      <PageLinkDialog
        open={pickerOpen}
        pages={pages}
        onPick={insertPageLink}
        onClose={() => setPickerOpen(false)}
      />
    </Box>
  )
}
