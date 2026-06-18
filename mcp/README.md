# Erato MCP-Server

Ein [Model Context Protocol](https://modelcontextprotocol.io) Server (stdio), der
die Erato-Doku für AI-Clients (z.B. Claude Code) les- und schreibbar macht. Ideal,
um Agents während der Entwicklung die Projekt-Doku direkt pflegen zu lassen
(„halte die Doku in Erato aktuell"). Er ruft intern die Erato-API auf.

## Zwei Ziele (`ERATO_TARGET`)

| Target | Wann | Auth | API-Basis |
|--------|------|------|-----------|
| `web` (default) | Team-/Server-Instanz | Keycloak (Direct Grant, Bearer) | `ERATO_API_URL` |
| `local` | lokale **Desktop-App** (PGlite) | keine (lokaler Admin) | aus der Port-Datei der App |

Im local-Modus liest der MCP die Port-Datei, die die Desktop-App beim Start
schreibt (`<userData>/Erato/erato-local.json`) — dadurch findet er den
zufälligen Port automatisch. **Voraussetzung: die Desktop-App ist geöffnet**
(die lokale DB ist single-process; Edits erscheinen live in der App).

## Tools

| Tool | Eingabe | Beschreibung |
|------|---------|--------------|
| `list_notebooks` | – | Alle Notizbücher (id, title, icon). |
| `list_pages` | `notebookId` | Seitenbaum eines Notizbuchs. |
| `read_page` | `pageId` | Titel + Markdown-Inhalt einer Seite. |
| `search_docs` | `query` | Volltextsuche (Hybrid falls verfügbar) — Trefferliste mit Snippets. |
| **`research_topic`** | `query`, `notebook?`, `limit?` | „Gib mir alles zum Thema X": Hybrid-Suche + **Volltext** der Top-Treffer in einem Aufruf. Default auf `ERATO_NOTEBOOK` eingegrenzt; `notebook:"*"` = instanzweit. |
| **`upsert_page`** | `path`, `markdown`, `notebook?`, `title?` | **Idempotent**: Seite per Titel-Pfad (`Architektur/Datenbank`) anlegen ODER aktualisieren. Bevorzugt, um Doku aktuell zu halten — kein Duplikat bei Wiederholung. |
| `create_notebook` | `title`, `icon?` | Neues Notizbuch. |
| `create_page` | `notebookId`, `title`, `markdown`, `parentId?` | Legt eine Seite an (immer neu). |
| `update_page` | `pageId`, `markdown?`, `title?` | Aktualisiert per id. |
| `append_to_page` | `pageId`, `markdown` | Hängt Markdown an. |
| `delete_page` | `pageId` | Löscht Seite (inkl. Unterseiten). |

Der empfohlene Workflow für Agents ist **`upsert_page`** mit einem stabilen
Titel-Pfad pro Thema. Mit gesetztem `ERATO_NOTEBOOK` kann `notebook` entfallen.

## Env-Vars

| Variable | Default | Gilt für |
|----------|---------|----------|
| `ERATO_TARGET` | `web` | beide |
| `ERATO_NOTEBOOK` | – | beide (Default-Notizbuch / Scoping; Titel oder id) |
| `ERATO_API_URL` | `http://localhost:3001` | web (Basis) / local (Override der Port-Datei) |
| `ERATO_LOCAL_FILE` | OS-`userData`/Erato/erato-local.json | local (Pfad zur Port-Datei) |
| `KEYCLOAK_TOKEN_URL` | `…/realms/erato/…/token` | web |
| `ERATO_USER` / `ERATO_PASS` | `kai` / `erato` | web |
| `ERATO_CLIENT_ID` | `erato-web` | web |

## Installation & Start

```bash
cd mcp
npm install
npm start        # = node src/server.js
```

Voraussetzung: Node.js >= 22 (ESM, globales `fetch`).

## Registrierung in Claude Code (`.mcp.json` im Projekt)

**Web-Instanz (Büro)** — mit dediziertem `docs-bot`-Account (siehe unten):

```json
{
  "mcpServers": {
    "erato": {
      "command": "node",
      "args": ["C:\\Users\\k.klein\\privat\\erato\\mcp\\src\\server.js"],
      "env": {
        "ERATO_TARGET": "web",
        "ERATO_API_URL": "http://localhost:3001",
        "ERATO_USER": "docs-bot",
        "ERATO_PASS": "docs-bot",
        "ERATO_NOTEBOOK": "MeinProjekt"
      }
    }
  }
}
```

**Lokale Desktop-App (zu Hause)** — kein Login, App muss geöffnet sein:

```json
{
  "mcpServers": {
    "erato": {
      "command": "node",
      "args": ["C:\\Users\\k.klein\\privat\\erato\\mcp\\src\\server.js"],
      "env": {
        "ERATO_TARGET": "local",
        "ERATO_NOTEBOOK": "MeinProjekt"
      }
    }
  }
}
```

Oder per CLI: `claude mcp add erato -- node <pfad>\mcp\src\server.js`.

## docs-bot-Serviceaccount (web)

Der Realm bringt einen Account `docs-bot` / `docs-bot` (Rolle `member`) mit. Damit
er schreiben darf, muss er **Mitglied (editor/owner)** des Ziel-Notizbuchs sein:
in der App → Notizbuch-Menü → „Mitglieder…" → `docs-bot` als *editor* hinzufügen.
Alternativ legt der Bot über `upsert_page`/`create_notebook` ein **neues**
Notizbuch selbst an (er wird dann automatisch dessen owner).

## Projekt-Konvention (in die `CLAUDE.md` des Projekts kopieren)

Damit Agents die Doku ohne erneute Erklärung pflegen, diesen Block in die
`CLAUDE.md` des jeweiligen Projekts aufnehmen:

```markdown
## Dokumentation (Erato)

Die Projekt-Doku liegt in Erato (MCP-Server `erato`, Notizbuch „MeinProjekt").
- Nach inhaltlichen Änderungen die betroffene Doku-Seite mit `upsert_page`
  aktualisieren — Pfad = Thema/Feature (z.B. `Architektur/Datenbank`,
  `API/Endpunkte`, `Setup`).
- `upsert_page` ist idempotent: nie `create_page` für bestehende Themen nutzen
  (sonst Duplikate).
- Vor größeren Änderungen mit `research_topic` („gib mir alles zu …") den
  aktuellen Stand erfassen, statt einzeln zu suchen+lesen.
- Veraltete Seiten mit `delete_page` entfernen.
```

## Hinweise

- Logs gehen ausschließlich auf `stderr` (stdout ist dem MCP-Protokoll vorbehalten).
- `search_docs` versucht zuerst `/v1/search/hybrid`, sonst `/v1/search`.
- local: bei „Lokale Erato-Instanz nicht gefunden" ist die Desktop-App nicht offen.
