import { GlobalStyles, useTheme } from '@mui/material'

// Lese-Typografie + Block-Styles für den TipTap-Content (ProseMirror).
// Greift auf das MUI-Theme zu, damit Light/Dark und Akzentfarbe konsistent sind.
export default function EditorStyles() {
  const theme = useTheme()
  const t = theme.palette
  const accent = t.primary.main
  const surface = t.background.paper
  const border = t.divider
  const text = t.text.primary
  const secondary = t.text.secondary

  return (
    <GlobalStyles
      styles={{
        '.ProseMirror': {
          outline: 'none',
          color: text,
          fontSize: 16,
          lineHeight: 1.65,
          fontWeight: 400,
          // ruhige Leseschrift; fällt auf System-UI zurück
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        },
        '.ProseMirror p': { margin: '0 0 0.6em' },
        '.ProseMirror > *:last-child': { marginBottom: 0 },
        '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3': {
          fontWeight: 600, color: text, lineHeight: 1.3, marginTop: '1.6em', marginBottom: '0.4em',
        },
        '.ProseMirror h1': { fontSize: 29 },
        '.ProseMirror h2': { fontSize: 23 },
        '.ProseMirror h3': { fontSize: 18.5 },
        '.ProseMirror a': { color: accent, textDecoration: 'underline', textUnderlineOffset: 2 },
        '.ProseMirror ul, .ProseMirror ol': { paddingLeft: '1.4em', margin: '0 0 0.6em' },
        '.ProseMirror li': { margin: '0.15em 0' },
        '.ProseMirror blockquote': {
          borderLeft: `3px solid ${border}`,
          margin: '0 0 0.8em',
          padding: '0.1em 0 0.1em 1em',
          color: secondary,
        },
        '.ProseMirror code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.88em',
          background: t.action.hover,
          padding: '0.1em 0.35em',
          borderRadius: 4,
        },
        '.ProseMirror pre': {
          background: surface,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: '0.9em 1em',
          margin: '0 0 0.8em',
          overflowX: 'auto',
          fontSize: 14,
        },
        '.ProseMirror pre code': { background: 'none', padding: 0, fontSize: 14, color: text },
        '.ProseMirror mark': { borderRadius: 3, padding: '0 0.1em', boxDecorationBreak: 'clone' },
        // Tabellen: Header-Trennlinie + dezentes Zebra
        '.ProseMirror table': {
          borderCollapse: 'collapse', width: '100%', margin: '0 0 0.8em', fontSize: 15,
          tableLayout: 'fixed',
        },
        '.ProseMirror th, .ProseMirror td': {
          border: `1px solid ${border}`, padding: '0.45em 0.6em', textAlign: 'left',
          verticalAlign: 'top',
        },
        '.ProseMirror th': { background: t.action.hover, fontWeight: 600, borderBottom: `2px solid ${border}` },
        '.ProseMirror tr:nth-of-type(even) td': { background: t.action.hover },
        // Aufgabenliste
        '.ProseMirror ul[data-type="taskList"]': { listStyle: 'none', paddingLeft: 0 },
        '.ProseMirror ul[data-type="taskList"] li': { display: 'flex', alignItems: 'flex-start', gap: '0.5em' },
        '.ProseMirror ul[data-type="taskList"] li > label': { marginTop: '0.15em' },
        '.ProseMirror ul[data-type="taskList"] li > div': { flex: 1 },
        // Placeholder (Extension-Placeholder)
        '.ProseMirror p.is-editor-empty:first-of-type::before': {
          content: 'attr(data-placeholder)',
          color: secondary,
          float: 'left',
          height: 0,
          pointerEvents: 'none',
        },
      }}
    />
  )
}
