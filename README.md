# Erato

Self-hosted Wissens-/Notiz-System (Confluence/OneNote-artig) mit AI-Anbindung.
Notizbücher mit verschachtelten Seiten, Rich-Editor (TipTap, Markdown kanonisch),
Volltext- + semantische Suche, RAG-AI-Panel, MCP-Server, White-Label-Theming.

## Architektur (Monorepo)

```
erato/
  web/            React 19 + MUI + Vite (SPA)                 → :5173 (dev)
  api/            Node + Fastify (Notizen, Suche, AI, Branding) → :3001
  desktop/        Electron-Wrapper (lokale Einzelplatz-App, PGlite)
  mcp/            MCP-Server (AI-Tools über die API)
  packages/
    design-tokens/  @erato/design-tokens (DTCG → MUI-Theme)
    ui/             @erato/ui (token-gestylte Komponenten + Storybook) → :6006
  docker/         Init-SQL, Keycloak-Realm, Caddyfile
  docker-compose.yml          Basis-Dienste (Postgres+pgvector, Keycloak, MinIO, Ollama, erato-api)
  docker-compose.prod.yml     Prod-Override (Caddy, erato-web-Container, erato-mcp)
```

Weitere Docs: [mcp/README.md](mcp/README.md) (Agent-Doku-Workflow) · [desktop/brand/README.md](desktop/brand/README.md) (White-Label) · [web/src/components/editor/README.md](web/src/components/editor/README.md) (Editor)

## Schnellstart (Dev)

Voraussetzungen: Docker Desktop, Node 22.

```bash
cp .env.example .env          # Dev-Defaults reichen
npm install                   # Workspaces (web, packages/*)
docker compose up -d          # Postgres, Keycloak, MinIO, Ollama, erato-api
# Embedding- + Chat-Modell für die AI ziehen (einmalig):
docker exec -d erato-ollama ollama pull nomic-embed-text
docker exec -d erato-ollama ollama pull llama3.2:3b
npm run dev --workspace web   # Web auf http://localhost:5173
```

Optional Storybook: `npm run storybook --workspace @erato/ui` → http://localhost:6006

### Ports / Test-Logins
| Dienst | URL |
|---|---|
| Web (dev) | http://localhost:5173 |
| API | http://localhost:3001 |
| Keycloak | http://localhost:8085 (Realm `erato`) |
| MinIO-Konsole | http://localhost:9001 |
| Storybook | http://localhost:6006 |

Test-Nutzer: `kai` / `erato` (Admin) · `member` / `member` · `docs-bot` / `docs-bot` (für den MCP-Server, siehe [mcp/README.md](mcp/README.md)).

## Produktion

```bash
# Echte Secrets in .env setzen! Dann:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# → Caddy auf http://localhost:8088 (serviert SPA + proxyt /v1 → API)
```

- **TLS:** In `docker/caddy/Caddyfile` `:8088` durch deine Domain ersetzen → Caddy holt
  automatisch Let's-Encrypt-Zertifikate; im Compose `80:80` und `443:443` mappen.
- **Single-Origin:** erato-web (nginx) liefert die SPA und proxyt `/v1` an erato-api (kein CORS).
- **MCP-Server:** `docker compose ... --profile tools run --rm erato-mcp` bzw. vom AI-Client
  per stdio (`node mcp/src/server.js`) starten. Siehe [mcp/README.md](mcp/README.md).

## Betriebsmodi

Erato läuft in zwei Modi – gesteuert über `ERATO_MODE`:

| | **Web / Team** (`web`, Default) | **Lokal / Einzelplatz** (`local`) |
|---|---|---|
| Auslieferung | Docker-Stack, Browser | Electron-App (installierbar) |
| Datenbank | PostgreSQL + pgvector | **PGlite** (eingebettetes Postgres, in-process) |
| Auth | Keycloak (OIDC) | fester lokaler Admin, **kein Login** (nur `127.0.0.1`) |
| Object-Storage | MinIO | lokales Dateisystem (`userData/branding`) |
| AI | Ollama | Ollama optional – wird automatisch ausgeblendet, wenn nicht verfügbar |

`ERATO_MODE=local` schaltet `AUTH_MODE`, `DB_MODE` und `STORAGE_MODE` passend um
(einzeln überschreibbar). Die Datenschicht ist identisch – derselbe Code, andere Adapter.

### AI-Verfügbarkeit & Modell-Konfiguration
`GET /v1/capabilities` probt Ollama (`AI_ENABLED=auto|true|false`). Sind kein Dienst/
keine Modelle erreichbar, blendet das Frontend alle AI-Funktionen (Assistent, semantische
Suche) aus, statt Fehler zu zeigen.

**Ollama-URL und Modelle** lassen sich in der App ändern (Einstellungen → AI / Modelle, Admin):
`OLLAMA_URL`, Chat- und Embed-Modell. Die Werte liegen in der DB (`app_settings`) und
**überstimmen** die Env-Defaults (`OLLAMA_URL`, `EMBED_MODEL`, `CHAT_MODEL`) sofort, ohne
Neustart. Das Dropdown zeigt die in Ollama installierten Modelle (`GET /v1/ai/models`).
Ein Wechsel des Embed-Modells löst einen Hintergrund-Re-Index aus; bei abweichender
Vektordimension wird die Embedding-Spalte automatisch umgestellt.

## Lokale App (Electron)

Einzelplatz-Variante ohne Docker/Keycloak – Daten liegen im `userData`-Verzeichnis des OS.

```bash
cd desktop
npm install
npm start            # Dev: baut das Web-Bundle (local mode) und startet Electron
npm run dist:win     # Installierbares Setup (Windows, NSIS) → desktop/release/
```

- **White-Label:** `desktop/brand/brand.json` (App-Name, Akzentfarbe, optional Logo) +
  optionale Icons (`brand/icon.ico|icns|png`) bestimmen Installer-Optik und das beim
  Erststart geseedete Theme. Alles bleibt **in der App** änderbar (Einstellungen → Branding);
  der Seed überschreibt keine Nutzer-Anpassungen. Siehe [desktop/brand/README.md](desktop/brand/README.md).
- **Windows-Voraussetzung für `dist`:** electron-builder entpackt `winCodeSign` mit Symlinks
  → einmalig **Entwicklermodus** aktivieren (Einstellungen → Datenschutz und Sicherheit →
  Für Entwickler → Entwicklermodus), sonst bricht der Build mit
  *„Cannot create symbolic link"* ab. Alternativ in CI (mit Symlink-Recht) bauen.

## Doku mit Agents pflegen (MCP)

Der [MCP-Server](mcp/README.md) lässt AI-Agents (z.B. Claude Code) die Erato-Doku
lesen **und** schreiben – ideal, um während der Entwicklung die Projekt-Doku aktuell
zu halten („halte die Doku in Erato aktuell").

- **Zwei Ziele** (`ERATO_TARGET`): `web` (Team-Instanz, Keycloak, Account `docs-bot`)
  oder `local` (laufende Desktop-App, kein Login – Port-Discovery über die Datei
  `erato-local.json`; Edits erscheinen live in der App).
- **Wichtigste Tools:** `research_topic` („gib mir alles zu X" – Hybrid-Suche + Volltext
  der Treffer, projekt-eingegrenzt), `upsert_page` (idempotent anlegen/aktualisieren per
  Titel-Pfad – keine Duplikate), dazu `search_docs`, `read_page`, `create_notebook`,
  `delete_page`.
- **Scoping:** `ERATO_NOTEBOOK` bindet einen Agent an ein Projekt-Notizbuch.

**Agent selbst einrichten:** Zeige einen Agent einfach auf [AGENT_INIT.md](AGENT_INIT.md)
(„lies `…/erato/AGENT_INIT.md` und richte dich danach ein") — er legt dann `.mcp.json`
und den `CLAUDE.md`-Abschnitt im aktuellen Projekt selbst an.

Fertige `.mcp.json`-Beispiele (web/local) und der Copy-paste-Block für die `CLAUDE.md`
eines Projekts stehen auch in [mcp/README.md](mcp/README.md).

## Qualität

- Tests: `npm run test:unit` (ohne Docker – inkl. In-Process-Test des local mode mit PGlite) ·
  `npm run test:api` (gegen den laufenden Stack) · `npm test` (alles).
- Token-Contract (keine hartkodierten Farben): `npm run lint --workspace @erato/ui`
- a11y-Addon in Storybook; visuelle/Interaktions-Tests: `npm run test-storybook --workspace @erato/ui`
- CI: `.github/workflows/ci.yml` (Lint, Web-Build, Storybook-Build, Docker-Images).

## Sicherheit / Hinweise

- `.env` ist gitignored — niemals echte Secrets committen.
- Suche/AI filtern (noch) nicht nach Notizbuch-Mitgliedschaft (im Code dokumentiert).
- Standard-Embedding `nomic-embed-text` (768-dim), Chat-Modell `llama3.2:3b` (lokal via Ollama).
