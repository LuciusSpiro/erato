# Erato — Gesamt-Roadmap & Parallelisierungsstrategie

> Plan zur Umsetzung des gesamten offenen Scopes, optimiert für parallele Bearbeitung.
> Baut auf [PLAN.md](PLAN.md), [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md), [PLATFORM.md](PLATFORM.md).

## Was schon steht (Stand jetzt)

- P0-Durchstich: Login (Keycloak) → Branding (API/Postgres) → dynamisches Theme + Logo.
- Design-System-Fundament: `@erato/design-tokens` (DTCG→MUI), `@erato/ui` (+ Storybook), Web token-getrieben.
- Infrastruktur: docker-compose (postgres+pgvector, keycloak, minio), `erato-api` containerisiert.

## Offener Scope (Inventar)

| ID | Bereich | Inhalt |
|----|---------|--------|
| M2 | Notizbücher & Seiten | DB-Schema + CRUD + Baum (move/reorder) + Autosave |
| M4 | Suche | Postgres-Volltext (tsvector) + Such-API + Such-UI |
| M3 | Rich-Editor | TipTap (Slash, Bubble, Tabellen, Highlight, Code), Bild-Upload, MD-Speicherung |
| P1 | Theme-Editor | In-App-Admin-UI: Akzentfarbe + Logo, Live-Vorschau, schreibt `/v1/branding` |
| UI+ | @erato/ui ausbauen | Mehr token-gestylte Komponenten aus den Mockups + Stories |
| TOK+ | Tokens erweitern | Highlight-/Component-Tokens, `toCssVars`, Validierung, Terrazzo-Config |
| Q | Qualitäts-Garantien | Lint-Contract (keine Hardcodes), a11y-Addon, visuelle Regression |
| M5 | Knowledge/AI | Ollama-Embeddings (async), pgvector semantisch + hybride Suche, AI-Panel |
| M6 | MCP-Server | Tools read/search/create/update über die API |

## Abhängigkeits-Graph (vereinfacht)

```
M2 (api+db) ──┬─▶ M4 Such-UI ──┐
              ├─▶ M3 Editor     ├─▶ M5 (AI/RAG) ──▶ AI-Panel
              └─▶ Web-Datenfluss┘
TOK+ ─▶ UI+ ─▶ (Web nutzt @erato/ui)        Q hängt an UI+/Web (Lint über Komponenten)
P1 (Theme-Editor) hängt nur an bestehender /v1/branding-API  → sofort parallel machbar
M6 (MCP) hängt an M2-API
```

## Parallelisierungs-Prinzip: Datei-Eigentum statt Git-Worktrees

Da **kein Git** (keine Worktree-Isolation), wird nach **disjunkten Verzeichnissen** partitioniert.
Jeder Agent besitzt genau einen Bereich und fasst keine fremden Dateien an. Cross-Track-Schnitt­
stellen sind über **Verträge** (unten) fixiert; Integration/Verifikation erfolgt zentral danach.

### Wave 1 — 4 Tracks echt parallel (disjunkte Ordner, keine neuen Root-Deps)

| Track | Ordner (Eigentum) | Liefert |
|-------|-------------------|---------|
| **A — Backend** | `api/` | M2 (notebooks/pages/tree CRUD, Migrationen) + M4-Backend (FTS-Such-API) |
| **B — Web-Features** | `web/` | Web auf echte API (Notizbücher/Seiten, Anlegen, Autosave) + Such-UI verdrahten + **Theme-Editor (P1)** |
| **C — UI-Bibliothek** | `packages/ui/` | UI+ (weitere Komponenten + Stories) |
| **D — Tokens** | `packages/design-tokens/` | TOK+ (Highlight-/Component-Tokens, `toCssVars`, `validate`) |

Verifizierbar je Track ohne neue Abhängigkeiten (alle nötigen npm-Pakete sind installiert):
A via Host-Node gegen Postgres (Port 3002), B/C via `vite build`, D via Node-Skript.

### Wave 2 — nach Integration von Wave 1 (teils sequentiell wg. gemeinsamer Dateien)

- **M3 Rich-Editor** (TipTap) in `web/` — großer Brocken, gleicher Ordner wie Track B → danach.
- **Q Qualitäts-Tooling** (eslint/stylelint-Contract, a11y-Addon, Storybook-Test-Runner) — bringt
  neue Dev-Deps → zentral installieren, nicht in paralleler Wave.

### Wave 3 — Wissens-/Integrationsschicht

- **M5 AI/RAG** (api: Embedding-Pipeline + pgvector-Suche; web: AI-Panel) — Ordner api+web,
  parallel zueinander möglich (disjunkt), nach M2.
- **M6 MCP-Server** (`mcp/` neu) — eigener Ordner, parallel zu M5.

## Verträge (Cross-Track-Schnittstellen, in Wave 1 fixiert)

**Notizbücher/Seiten-API (Track A ↔ B):** alle Routen `requireAuth`, JSON.
- `GET /v1/notebooks` → `[{id,title,icon}]`
- `POST /v1/notebooks` `{title,icon?}` → `{id,...}`
- `GET /v1/notebooks/:id/pages` → Baum `[{id,title,parentId,position,children:[...]}]`
- `GET /v1/pages/:id` → `{id,notebookId,parentId,title,contentMd,updatedAt,updatedBy}`
- `POST /v1/pages` `{notebookId,parentId?,title}` → `{id,...}`
- `PUT /v1/pages/:id` `{title?,contentMd?}` → `{ok,updatedAt}` (Autosave-Ziel)
- `POST /v1/pages/:id/move` `{parentId,position}` → `{ok}`
- `DELETE /v1/pages/:id` → `{ok}`
- `GET /v1/search?q=...` → `[{pageId,notebookPath:[...],title,snippet}]`

**Speicherformat:** `contentMd` = Markdown (kanonisch). In Wave 1 reicht ein Textarea/Plaintext-
Bearbeiten; TipTap kommt in Wave 2 und nutzt denselben `contentMd`-Vertrag.

**Auth (Web→API):** Bearer-Token aus `react-oidc-context` (`auth.user.access_token`) an alle
schreibenden Requests; GET teils öffentlich (Branding) bzw. `requireAuth` (Notizen).

## Integration & Verifikation (nach jeder Wave, zentral)

1. Ein konsolidierter `npm install` am Root (nur wenn neue Deps).
2. `erato-api`-Container neu bauen; Dev-Server (web :5173, storybook :6006) neu starten.
3. End-to-End: Login → Notizbuch anlegen → Seite anlegen/bearbeiten (Autosave) → Suche findet sie
   → Theme-Editor ändert Farbe/Logo live. Storybook-Build grün.

## Hinweise für parallele Agenten (Regeln)

- **Nur** Dateien im eigenen Track-Ordner anfassen. Keine `npm install`/Root-Lockfile-Änderungen.
- Bestehende Muster/Stack nutzen (Fastify, pg, React+MUI, @erato/design-tokens).
- Verträge oben strikt einhalten. Eigene Arbeit bauen/prüfen, Ergebnis kurz berichten.
