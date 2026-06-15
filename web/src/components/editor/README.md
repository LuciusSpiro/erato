# TipTap-Editor — Markdown-Round-Trip

Kanonisches Speicherformat ist **Markdown** (`contentMd`). Der Editor (`TipTapView.jsx`)
serialisiert über `tiptap-markdown` (`Markdown.configure({ html: true, … })`) und liest
beim Laden denselben String wieder ein. `html: true` ist entscheidend: alle Marks/Nodes
ohne dediziertes Markdown-Spec fallen auf eine **HTML-Repräsentation** zurück, die
markdown-it beim Neuladen wieder parst.

## Verifizierter Round-Trip (Speichern → Neuladen)

- **Farbige Highlights** — ✅ erhalten.
  - `@tiptap/extension-highlight` ist mit `multicolor: true` konfiguriert und rendert
    `<mark data-color="…" style="background-color: …; color: inherit">`.
  - `tiptap-markdown` hat **kein** eingebautes Highlight-Spec (also kein `==text==`),
    daher greift der generische HTML-Mark-Serializer und schreibt das vollständige
    `<mark …>`-Tag inkl. `style`/`data-color` in den Markdown.
  - Beim Laden liest Highlight die Farbe aus `data-color` bzw. `style.backgroundColor`
    zurück (`parseHTML`). Die Farbpalette (`HIGHLIGHTS` in `theme.js`) ist light/dark-spezifisch;
    gespeichert wird der konkrete Hex-Wert des jeweiligen Modus.
- **Tabellen** — ✅ für reguläre Tabellen (GFM-Pipe-Syntax).
- **Aufgabenlisten** — ✅ (`- [ ]` / `- [x]`).
- **Code-Blöcke** — ✅ inkl. Sprach-Fence (```lang).

## Bekannte Grenzen (bewusst nicht umgebaut — Stabilität)

- **Komplexe Tabellenzellen**: Zellen mit Zeilenumbruch/mehreren Blöcken oder
  row-/colspans kann `tiptap-markdown` nicht als GFM-Pipe-Tabelle ausdrücken und
  fällt auf eine HTML-Tabelle (`<table>…`) im Markdown zurück. Funktioniert dank
  `html: true`, ist aber kein „schönes" Markdown.
- **Highlight-Farbe ist modusgebunden**: Da der Hex-Wert gespeichert wird, behält ein
  im Light-Mode gesetzter Highlight seinen Light-Ton, auch wenn das Dokument später im
  Dark-Mode geöffnet wird. Das ist gewollt (verlustfreier Round-Trip), nicht
  theme-adaptiv. Eine token-basierte Lösung würde einen eigenen Mark mit semantischem
  Farb-Key erfordern — größerer Umbau, hier nicht vorgenommen.
- **Highlight ohne `html: true`**: Würde der HTML-Modus deaktiviert, gingen die
  Highlight-Farben verloren (tiptap-markdown warnt dann auf der Konsole). `html: true`
  daher nicht entfernen.
