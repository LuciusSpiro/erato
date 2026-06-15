# Erato

Self-hosted Wissens-/Notiz-System (Confluence/OneNote-artig) mit AI-Anbindung.
Notizbücher mit verschachtelten Seiten, Rich-Editor (TipTap, Markdown kanonisch),
Volltext- + semantische Suche, RAG-AI-Panel, MCP-Server, White-Label-Theming.

## Architektur (Monorepo)

```
erato/
  web/            React 19 + MUI + Vite (SPA)                 → :5173 (dev)
  api/            Node + Fastify (Notizen, Suche, AI, Branding) → :3001
  mcp/            MCP-Server (AI-Tools über die API)
  packages/
    design-tokens/  @erato/design-tokens (DTCG → MUI-Theme)
    ui/             @erato/ui (token-gestylte Komponenten + Storybook) → :6006
  docker/         Init-SQL, Keycloak-Realm, Caddyfile
  docker-compose.yml          Basis-Dienste (Postgres+pgvector, Keycloak, MinIO, Ollama, erato-api)
  docker-compose.prod.yml     Prod-Override (Caddy, erato-web-Container, erato-mcp)
```

Detail-Doku: [PLAN.md](PLAN.md) · [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · [PLATFORM.md](PLATFORM.md) · [ROADMAP.md](ROADMAP.md) · [ui.md](ui.md)

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

Test-Nutzer: `kai` / `erato` (Admin) · `member` / `member`.

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

## Qualität

- Token-Contract (keine hartkodierten Farben): `npm run lint --workspace @erato/ui`
- a11y-Addon in Storybook; visuelle/Interaktions-Tests: `npm run test-storybook --workspace @erato/ui`
- CI: `.github/workflows/ci.yml` (Lint, Web-Build, Storybook-Build, Docker-Images).

## Sicherheit / Hinweise

- `.env` ist gitignored — niemals echte Secrets committen.
- Suche/AI filtern (noch) nicht nach Notizbuch-Mitgliedschaft (im Code dokumentiert).
- Standard-Embedding `nomic-embed-text` (768-dim), Chat-Modell `llama3.2:3b` (lokal via Ollama).
