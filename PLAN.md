# Erato — Self-hosted Wissens-/Notiz-System mit AI-Anbindung

## Context

Greenfield-Projekt. Ziel ist ein selbstgehostetes Confluence-/OneNote-Äquivalent für ein
**kleines Team**: Notizbücher mit beliebig tiefen Unterkapiteln, Rich-Content (Bilder, farbige
Markierungen, Tabellen, Code, alles aus Markdown), Web-App **und** responsiver Mobile-View,
Volltext- *und* Inhaltssuche, sowie ein **MCP-Server**, damit AI (Claude & Co.) Doku
lesen/schreiben kann — gestützt auf eine **Knowledge-DB** (Embeddings) für semantische Suche/RAG.

Getroffene Entscheidungen:
- **Nutzerkreis:** kleines Team, Login + geteilte Notizbücher + Rollen
- **Hosting:** self-hosted, ein `docker-compose`
- **Editor:** **beide Modi** — WYSIWYG (TipTap) *und* Markdown-Quelltext, umschaltbar
- **Kollaboration:** Echtzeit später (Architektur offen halten, jetzt nicht bauen)
- **Stack:** React 19 + MUI + react-router, Node-API, PostgreSQL + pgvector, TipTap-Editor
- **Embeddings:** lokal via **Ollama** (`nomic-embed-text`) — Daten bleiben am Server
- **Auth:** **OIDC via Keycloak** (self-hosted)
- **Speicherformat:** **Markdown kanonisch** (siehe unten)

## Leitstern: SEHR EINFACHE BEDIENBARKEIT

Einfachheit ist das wichtigste Erfolgskriterium (bestätigt durch UX-, Design-, Entwickler-
und Projektleiter-Review). Einfachheit entsteht durch **Weglassen**, nicht durch gute Defaults
für viele Optionen. Jedes Feature muss sich verteidigen gegen: *„Bringt das den Nutzer
schneller zu seiner Notiz — oder kostet es einen Klick/eine Entscheidung mehr?"*

**Happy Path, der perfekt sitzen muss:**
`Login → Notizbuch öffnen → neue Seite → tippen/Bild einfügen → Autosave → per Suche in <2s wiederfinden.`

### UX-Prinzipien (gelten für alle Screens)
- **Kein Bearbeiten-Modus.** Klick = sofort editierbar, **Autosave** (debounced 1–2 s + bei Blur).
  Nie ein „Speichern"-Knopf.
- **Slash-Menü (`/`)** für Block-Einfügen (Tabelle, Bild, Code…) statt voller Toolbar; dazu
  **Bubble-Toolbar** nur bei Textauswahl (Bold/Italic/Link/Highlight). Basis: `@tiptap/suggestion`.
- **Eine Primäraktion pro Screen.** „+ Neue Seite" → direkt leere Seite, Cursor im Titel,
  **keine Vorab-Dialoge**.
- **Cmd/Ctrl+K-Suche** als Kommandozentrale (Navigation + Suche in einer Liste).
- **Markdown-Shortcuts inline immer aktiv** (`## ` → H2), auch ohne Quelltext-Modus.
- **Onboarding:** vorbefülltes Demo-Notizbuch statt Tutorial-Tour; leere Seite zeigt
  „Tippe / für Befehle…".
- **Verschachtelung beliebig tief, aber visuell gebändigt:** dezente Einrückung (12–16px/Ebene),
  Breadcrumb-Pfad über dem Titel, ab Ebene 3 nur Text. Collapse-Zustand merken.

### Visuelle Prinzipien (Design-System)
- **Eine** Akzentfarbe (Indigo `#3B5BDB` light / `#748FFC` dark), Rest Graustufen; >90 % neutral.
  Trennung über 1px-Borders + Surface-Töne, **nicht** Schatten.
- Lesetext: **max-width ~700px**, 16px, line-height 1.65; Headings Gewicht 600.
- 8px-Grid, Radius 6–8px, Icons 20px in Secondary-Grau. Light + Dark Mode.
- **Highlight: feste Palette mit 4–6 Pastellfarben** (kein Freitext-Style → sichere, einfache
  Serialisierung).
- **AI dezent:** kein Dauer-Panel, kein Lila/Gradient; einklappbares Right-Drawer + `/ai`-Befehl,
  Antworten mit klickbaren Quellen-Chips.

## Kern-Designentscheidung: Markdown ist das kanonische Format

**Markdown ist die einzige Quelle der Wahrheit** (`pages.content_md`):
- Der WYSIWYG-Editor (TipTap) lädt MD → Rich-View und speichert Rich-View → MD.
- Der Markdown-Modus (Phase 2) zeigt/bearbeitet exakt `content_md`.
- Der MCP/AI-Layer (Phase 2) liest/schreibt direkt Markdown — kein Format-Übersetzer nötig.
- Volltextsuche und Embeddings laufen direkt auf `content_md`.
- **Parser auf beiden Seiten (Frontend-Editor + Backend):** `remark` + `remark-gfm` +
  `rehype-raw` + `rehype-sanitize` — **nicht** `tiptap-markdown` (zu lückenhaft bei
  Highlight/HTML). Definierte **Markdown-Obermenge**: GFM + Whitelist `<span>/<mark>` mit nur
  `background-color`. Serialisierung **nur an Grenzen** (Speichern/Umschalten), nicht pro
  Tastendruck → keine Cursor-Sprünge, kontrollierter, dokumentierter Verlust.
- Farbige Markierungen: `@tiptap/extension-highlight` (`multicolor`) gebunden an die feste
  Palette → als `<span>/<mark>` im MD.
- Optionaler `content_json`-Cache (ProseMirror-Doc) nur zur schnelleren Editor-Ladezeit,
  **nie** Quelle der Wahrheit — immer aus `content_md` regenerierbar.

## Architektur (Monorepo)

```
erato/
  web/        React 19 + MUI + Vite (SPA, responsiv)
  api/        Node + Fastify REST-API
  mcp/        MCP-Server (Node, @modelcontextprotocol/sdk)
  db/         SQL-Migrationen (node-pg-migrate o.ä.)
  docker/     docker-compose + Service-Configs
```

Services im `docker-compose`: `postgres` (pgvector-Image), `keycloak`, `minio` (Bild-Storage,
S3-kompatibel), `ollama` (Embeddings), `api`, `mcp`, `web` (nginx mit gebautem React).

## Datenmodell (PostgreSQL)

- `users` — aus OIDC gespiegelt: `sub`, `email`, `name`
- `notebooks` — `id`, `title`, `icon`, `created_by`, Zeitstempel
- `notebook_members` — `notebook_id`, `user_id`, `role` (`owner`/`editor`/`viewer`)
- `pages` — `id`, `notebook_id`, `parent_id` (Self-Ref → Baum), `title`, `slug`, `position`,
  `content_md` (text, **kanonisch**), `content_json` (jsonb, Cache), Audit-Felder,
  `search_tsv` (generierte tsvector-Spalte, GIN-Index über Titel + Inhalt)
- `page_versions` — `page_id`, `content_md`, `edited_by`, `edited_at` (Historie)
- `attachments` — `page_id`, `filename`, `mime`, `size`, `storage_key` (MinIO)
- `embeddings` — `page_id`, `chunk_index`, `heading_path`, `chunk_text`,
  `embedding vector(768)` (pgvector, HNSW-Index, Cosine)

## Komponenten

**Frontend (`web/`)**
- React 19 + MUI + react-router; OIDC via `react-oidc-context`
- Linke Sidebar: Notizbuch-Baum (dnd-kit für Drag-Reorder/Verschachteln)
- Editor-Page: TipTap mit StarterKit + Image, Table, TaskList, Highlight (multicolor),
  TextStyle+Color, Link, CodeBlockLowlight (Syntax), Placeholder; Toolbar + Floating-Menu
- Markdown-Umschalter: Quelltext-Ansicht (CodeMirror) ⇄ Rich-View über `tiptap-markdown`
- Suche-UI: Ergebnisliste mit Snippet-Highlights
- Responsiv: Sidebar als Drawer auf Mobile, touch-freundliche Editor-Toolbar

**Backend (`api/`)**
- Fastify; OIDC-JWT-Validierung gegen Keycloak-JWKS (Bearer), `sub` → `users`
- Endpunkte: Notebooks CRUD; Pages CRUD + Tree-Move/Reorder + Versionen; Attachments-Upload
  (→ MinIO via S3-Client); Suche (FTS / semantisch / hybrid)
- Embedding-Pipeline: bei Page-Save Inhalt nach Überschriften/Absätzen chunken, je Chunk via
  Ollama embedden, in `embeddings` upserten (asynchron)

**Suche**
- Volltext: Postgres `tsvector` + GIN, Ranking über Titel + `content_md`
- Semantisch: Query via Ollama embedden, pgvector Cosine-ANN (HNSW)
- Hybrid: FTS-Rang + Vektor-Ähnlichkeit per Reciprocal Rank Fusion zusammenführen

**MCP-Server (`mcp/`)**
- `@modelcontextprotocol/sdk`, spricht die `api/` an (Logik-Wiederverwendung), Service-Token
- Tools: `list_notebooks`, `list_pages` (Baum), `read_page`, `search_docs` (hybrid),
  `semantic_search`, `create_page`, `update_page`, `append_to_page`

## Umsetzungs-Meilensteine

**MVP = M1–M4** (täglich nutzbares, einfaches Tool). Alles AI/MCP-/Markdown-Toggle-bezogene
erst, wenn der Schreiben-&-Finden-Loop nachweislich mühelos ist.

1. **M1 — Foundation** — Monorepo-Scaffolding, DB-Schema + Migrationen, `docker-compose`
   (postgres+pgvector, keycloak, minio, ollama), OIDC-Login-Flow End-to-End, leeres
   geschütztes Frontend.
2. **M2 — Notizbücher & Seiten** — Baum-CRUD (beliebig tief), Sidebar-Navigation, Seiten
   anlegen/anzeigen, **Autosave**, responsives Layout.
3. **M3 — Editor-Erlebnis (Herzstück, maximale Politur)** — TipTap mit kuratiertem Funktionssatz
   (Überschriften H1–H3, Listen, Aufgabenliste, Tabellen, Code, feste Highlight-Palette),
   **Slash-Menü + Bubble-Toolbar**, Bild-Upload/Paste nach MinIO (nie Base64). WYSIWYG-only.
4. **M4 — Volltextsuche + Responsive-Feinschliff** — Postgres-`tsvector`, Cmd/Ctrl+K-Overlay.
   **→ Hier ist der MVP fertig und dogfooding-fähig.**
5. **M5 — Knowledge/AI (additiv)** — Ollama-Embedding-Pipeline (async, HNSW), semantische +
   hybride Suche, dezentes AI-Panel (RAG) mit Quellen-Chips.
6. **M6 — Erweiterungen (nach validierter Nachfrage)** — MCP-Server, WYSIWYG⇄Markdown-Toggle,
   Rollen/Rechte je Notizbuch, Versionshistorie-UI.

### Frühe Validierung der Einfachheit
- **Wöchentlicher Hallway-Test:** Kollege bekommt rohe App + 3 Aufgaben, nur zuschauen, nicht
  helfen — jedes Zögern ist ein Bug.
- **Budgets:** neue Seite ≤ 2 Klicks, Suchergebnis ≤ 2 s. Messbar.
- **Dogfooding ab Tag 1:** Team führt eigene Projektdoku in Erato.

## UI-Design & Design-System

- Konkrete UI/UX-Design-Spec (Screens, Tokens, Anti-Patterns): [ui.md](ui.md).
- Lauffähige Mockups (React + MUI): [web/](web/).
- **Design-System-Architektur** (DTCG-Tokens, @erato/ui, Storybook, White-Label):
  [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — token-getriebenes, app-übergreifend teilbares
  Fundament; Aufbau inkrementell, ohne den „schlanker MVP zuerst"-Grundsatz auszuhebeln.
- **Plattform-Durchstich** (eine Instanz pro Kunde, app-agnostisches Branding-Modul,
  Container/DBs): [PLATFORM.md](PLATFORM.md) — wie Theme + Logo persistent und (für eine
  evtl. zweite App) app-übergreifend nutzbar gespeichert werden.

## Verifikation

- `docker-compose up` startet alle Services; Healthchecks grün.
- Login über Keycloak funktioniert; geschützte API-Routen lehnen ohne gültiges Token ab.
- Notizbuch + verschachtelte Seiten anlegen; Bild einfügen (landet in MinIO, URL im MD);
  Tabelle + farbige Markierung erstellen; zwischen Rich- und Markdown-Modus umschalten →
  Inhalt bleibt verlustfrei (Round-Trip).
- Volltextsuche findet Wort; semantische Suche findet sinnverwandten Treffer ohne Wortgleichheit.
- MCP-Client (Claude): `search_docs` liefert Treffer, `create_page`/`append_to_page` legt
  Inhalt an, der danach im Web-UI sichtbar ist.
- Mobile-View (schmales Viewport): Sidebar als Drawer, Editor bedienbar.

## Offene Punkte für später (bewusst nicht im MVP)

- Echtzeit-Kollaboration (Yjs/CRDT + WebSockets) — Architektur hält es offen.
- Export (PDF/MD-Bundle), Kommentare, @-Mentions, Tag-System.
