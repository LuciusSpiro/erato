# Erato — UI/UX Design-Spec

> Ergebnis des UX-/Design-/Entwickler-/Projektleiter-Reviews. Leitstern: **sehr einfache
> Bedienbarkeit**. Diese Spec steuert die hier gebauten React+MUI-Mockups.

## Leitprinzip

Einfachheit durch **Weglassen**. Der Happy Path muss reibungslos sein:
`öffnen → tippen → wiederfinden`. Jede Funktion, die eine Entscheidung verlangt, *bevor* der
Nutzer schreiben kann, ist verdächtig.

## Design-System (MUI-Theme)

**Farbe — radikal reduziert (>90 % neutral):**
- Akzent (`primary`): `#3B5BDB` (Light) / `#748FFC` (Dark). Nur für: aktiver Sidebar-Eintrag,
  Links, Primär-Button, Fokus-Ring, Selektion.
- Light: BG `#FFFFFF`, Surface/Sidebar `#F8F9FA`, Border `#E9ECEF`, Text `#1A1D21`, Secondary `#6B7280`.
- Dark: BG `#1A1B1E`, Surface `#202124`, Border `#2C2E33`, Text `#E8EAED`, Secondary `#9AA0A6`.
- Semantik (rot/grün/gelb) nur für echte Status, nie dekorativ. Nie reines Schwarz/Weiß.

**Typografie:**
- Body 16px, line-height 1.65, weight 400 (Lesetext ggf. 17px).
- Headings weight 600 (nicht 700), dunkler als Body. Modular ~1.25:
  H1 28–30, H2 22–24, H3 18–19, H4 16px.
- Secondary 14px. Code 14px Monospace. App-Chrome System-UI, Editor-Content ruhige Leseschrift (Inter/System).

**Layout-Tokens:**
- 8px-Grid (4px Feinheiten). Radius 6–8px einheitlich. Shadows sparsam (elevation 0/1; Menüs/Popover 2).
- Trennung über **1px-Borders + Surface-Töne**, nicht Schatten.
- Icons 20px, 1.5px-Stroke, Secondary-Grau, eine Icon-Familie (lucide).
- **Content max-width ~700px** zentriert (≈70–75 Zeichen/Zeile) — wichtigster Lesbarkeitshebel.

## Screens

### 1. App-Shell (Desktop, dreigeteilt)
- Schmale **Icon-Rail** links: Suche, Notizbücher, Favoriten, (später AI), Einstellungen, Avatar.
- **Sidebar = nur Baum.** Notizbücher als oberste Ebene mit Icon; Seiten beliebig tief
  verschachtelt, Chevron zum Auf-/Zuklappen. Einrückung 12–16px/Ebene, dezente vertikale
  Guide-Linie, ab Ebene 3 nur Text. Aktiver Eintrag: Akzent-Bar links (2–3px), kein Vollflächen-
  Highlight. Hover-Aktionen: „+ Unterseite", „…"-Menü. Drag-Handle zum Umsortieren/Verschachteln.
- Oben in Sidebar: **„+ Neue Seite"** (Primäraktion).
- **Content-Bereich:** Breadcrumb-Pfad, Titel (H1, inline editierbar), Metazeile „zuletzt
  bearbeitet von …", Inhalt (max-width 700px).
- **Autosave-Indikator** dezent („Gespeichert" / „Speichert…").

### 2. Seiten-Editor
- **Kein Bearbeiten-Modus** — Klick = editierbar.
- **Slash-Menü (`/`)** für Blöcke: Heading, Liste, Aufgabenliste, Tabelle, Bild, Code, Zitat.
- **Bubble-Toolbar** nur bei Selektion: Bold/Italic/Strike/Link/Highlight (feste Palette).
- **FloatingMenu** am Anfang leerer Zeilen (Maus-Alternative zum Slash).
- Markdown-Shortcuts inline aktiv (`## `, `- `, `[] `, ``` ``` ).
- Lesefreundliche Darstellung: Absatz 16px, vor Heading 32px / danach 12px; Tabellen mit
  Header-Trennlinie + dezentem Zebra; Code-Block in Surface-Ton (gedämpftes Highlighting);
  Bilder volle Content-Breite, 8px-Radius, Caption 13px secondary.
- Highlight-Palette: 4–6 Pastellfarben, niedrige Sättigung.

### 3. Suche (Cmd/Ctrl+K-Overlay)
- Großes Suchfeld. Ergebnisliste: Notizbuch-Pfad (Breadcrumb) + Titel + Snippet mit
  hervorgehobenen Fundstellen. Tastatur-Navigation (Pfeile + Enter öffnet).
- MVP: Volltext. Später: semantische Treffer dezent als „ähnlich" in **derselben** Liste.

### 4. Mobile-View (~390px)
- Sidebar als Hamburger-Drawer (links). Vollbild-Lesemodus, gute Typografie.
- Editier-Modus: **sticky Bottom-Toolbar** mit 5 häufigsten Aktionen (touch, Tap-Targets ≥44px).
  Markdown-Quelltext-Modus auf Mobile ausgeblendet.
- Untere Tab-Bar: Suche, Notizbücher, (AI), Profil.

### 5. AI-Panel (Phase 2, hier nur als dezenter Platzhalter)
- Einklappbares Right-Drawer, standardmäßig zu; unauffälliger Sparkle-Button. Kein
  Lila/Gradient/Auto-Popup. Antworten mit klickbaren Quellen-Chips. Zusätzlich `/ai`-Befehl.

## Anti-Patterns (vermeiden)
- Mehrere Akzentfarben / Regenbogen-Icons → eine Akzentfarbe.
- Schatten-Inflation → Borders + Surface-Töne.
- Volle Bildschirmbreite für Text → max-width 700px erzwingen.
- Dauer-Toolbar mit 20+ Icons → Slash + Bubble (progressive disclosure).
- Modus-Verwirrung Anzeigen/Bearbeiten → immer editierbar + Autosave.
- Vorab-Dialog beim Anlegen (Notion „Seite/Datenbank?") → direkt leere Seite.
- AI-Aufdringlichkeit → dezent, optional.

## Bewusst NICHT im MVP
Datenbanken/Tabellen-Views, Echtzeit-Kollaboration, Kommentare, Templates-Galerie,
Custom-Themes, Public-Sharing. (Markdown-Toggle, AI/RAG, MCP, Rollen-pro-Notizbuch → Phase 2.)
