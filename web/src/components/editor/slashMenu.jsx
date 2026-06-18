import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { ReactRenderer } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Suggestion } from '@tiptap/suggestion'
import { Paper, MenuList, MenuItem, ListItemIcon, ListItemText, Typography } from '@mui/material'
import {
  Heading1, Heading2, Heading3, List, ListChecks, Table as TableIcon,
  Code, Quote, Link2,
} from 'lucide-react'

// Befehle des Slash-Menüs. `command(editor, range)` führt die Einfüge-Aktion aus.
// `keywords` dienen dem Filtern nach dem `/`.
const SLASH_ITEMS = [
  {
    title: 'Überschrift 1', keywords: ['h1', 'titel', 'heading'], icon: Heading1,
    command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Überschrift 2', keywords: ['h2', 'heading'], icon: Heading2,
    command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Überschrift 3', keywords: ['h3', 'heading'], icon: Heading3,
    command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Liste', keywords: ['liste', 'bullet', 'ul', 'aufzählung'], icon: List,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Aufgabenliste', keywords: ['aufgabe', 'task', 'todo', 'checkbox'], icon: ListChecks,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Tabelle', keywords: ['tabelle', 'table'], icon: TableIcon,
    command: (editor, range) => editor.chain().focus().deleteRange(range)
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Code-Block', keywords: ['code', 'block', 'pre'], icon: Code,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Zitat', keywords: ['zitat', 'quote', 'blockquote'], icon: Quote,
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
]

// Popup-Komponente für die Befehlsliste. Tastatur (↑/↓/Enter) wird über ref weitergereicht.
const SlashList = forwardRef(function SlashList({ items, command, maxHeight = 320 }, ref) {
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [items])

  const pick = (idx) => { const it = items[idx]; if (it) command(it) }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length); return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length); return true
      }
      if (event.key === 'Enter') { pick(selected); return true }
      return false
    },
  }))

  if (!items.length) return null
  return (
    <Paper elevation={2} sx={{ py: 0.5, minWidth: 220, maxHeight, overflowY: 'auto', border: '1px solid', borderColor: 'divider' }}>
      <MenuList dense disablePadding>
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <MenuItem key={it.title} selected={i === selected} onClick={() => pick(i)} sx={{ py: 0.75 }}>
              <ListItemIcon sx={{ minWidth: 30, color: 'text.secondary' }}><Icon size={17} /></ListItemIcon>
              <ListItemText primary={<Typography variant="body2">{it.title}</Typography>} />
            </MenuItem>
          )
        })}
      </MenuList>
    </Paper>
  )
})

// Eigene Slash-Extension auf Basis von @tiptap/suggestion.
// Positioniert das Popup ohne Fremd-Lib (tippy) per fixed-Position aus getReferenceClientRect.
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => props.command(editor, range),
      },
    }
  },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })]
  },
})

// Baut die suggestion-Konfiguration (items/render) für die Extension.
// Reines DOM-Positioning, damit keine zusätzliche Popup-Lib nötig ist.
// onRequestPageLink(): öffnet den Seiten-Picker (für „Link zu Seite").
export function makeSlashSuggestion({ onRequestPageLink } = {}) {
  const items = [...SLASH_ITEMS]
  if (onRequestPageLink) {
    items.push({
      title: 'Link zu Seite', keywords: ['link', 'seite', 'page', 'verweis', 'verlinken'], icon: Link2,
      command: (editor, range) => {
        // Slash-Text entfernen, dann den Picker öffnen; das Einfügen erledigt der Dialog.
        editor.chain().focus().deleteRange(range).run()
        onRequestPageLink()
      },
    })
  }
  return {
    items: ({ query }) => {
      const q = query.toLowerCase()
      return items.filter((it) =>
        it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.includes(q)),
      )
    },
    render: () => {
      let component
      let el
      let currentProps

      // Positioniert das Popup viewport-bewusst: verankert am „/", klappt bei
      // wenig Platz nach oben, begrenzt die Höhe auf den sichtbaren Bereich
      // (Rest ist intern scrollbar). Wird auch beim Scrollen aufgerufen.
      const place = () => {
        if (!el || !currentProps?.clientRect) return
        const rect = currentProps.clientRect()
        if (!rect) return
        const margin = 8
        const spaceBelow = window.innerHeight - rect.bottom - margin
        const spaceAbove = rect.top - margin
        const below = spaceBelow >= 200 || spaceBelow >= spaceAbove
        const maxHeight = Math.max(140, Math.min(360, below ? spaceBelow : spaceAbove))
        el.style.position = 'fixed'
        el.style.zIndex = 1500
        el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 268))}px`
        if (below) {
          el.style.top = `${rect.bottom + 6}px`
          el.style.bottom = ''
        } else {
          el.style.bottom = `${window.innerHeight - rect.top + 6}px`
          el.style.top = ''
        }
        component.updateProps({ ...currentProps, maxHeight })
      }

      return {
        onStart: (props) => {
          currentProps = props
          component = new ReactRenderer(SlashList, { props: { ...props, maxHeight: 320 }, editor: props.editor })
          el = document.createElement('div')
          el.appendChild(component.element)
          document.body.appendChild(el)
          place()
          // Beim Scrollen (auch im Editor-Container, daher capture) + Resize nachführen.
          window.addEventListener('scroll', place, true)
          window.addEventListener('resize', place)
        },
        onUpdate: (props) => {
          currentProps = props
          component.updateProps(props)
          place()
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') return true
          return component.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          window.removeEventListener('scroll', place, true)
          window.removeEventListener('resize', place)
          el?.remove()
          component?.destroy()
        },
      }
    },
  }
}
