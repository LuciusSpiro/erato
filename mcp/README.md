# Erato MCP-Server

Ein [Model Context Protocol](https://modelcontextprotocol.io) Server (stdio), der
die Erato-Doku fuer AI-Clients (z.B. Claude) les- und schreibbar macht. Er ruft
intern die bestehende Erato-API auf und holt sich serverseitig ein Token via
Keycloak (OIDC Direct Grant).

## Tools

| Tool | Eingabe | Beschreibung |
|------|---------|--------------|
| `list_notebooks` | – | Alle Notizbuecher (id, title, icon). |
| `list_pages` | `notebookId` | Seitenbaum eines Notizbuchs. |
| `read_page` | `pageId` | Titel + Markdown-Inhalt einer Seite. |
| `search_docs` | `query` | Volltextsuche (Hybrid falls verfuegbar, sonst Volltext). |
| `create_page` | `notebookId`, `title`, `markdown`, `parentId?` | Legt Seite an (POST) und setzt den Inhalt (PUT). |
| `update_page` | `pageId`, `markdown?`, `title?` | Aktualisiert Titel und/oder Inhalt. |
| `append_to_page` | `pageId`, `markdown` | Haengt Markdown an den bestehenden Seiteninhalt an. |

## Env-Vars

Alle optional, mit Dev-Defaults:

| Variable | Default |
|----------|---------|
| `ERATO_API_URL` | `http://localhost:3001` |
| `KEYCLOAK_TOKEN_URL` | `http://localhost:8085/realms/erato/protocol/openid-connect/token` |
| `ERATO_USER` | `christian` |
| `ERATO_PASS` | `erato` |
| `ERATO_CLIENT_ID` | `erato-web` |

Das Token wird im Speicher gecacht und vor Ablauf automatisch erneuert; bei einer
401-Antwort wird es einmalig verworfen und der Request wiederholt.

## Installation & Start

```bash
cd mcp
npm install
npm start        # = node src/server.js
```

Voraussetzung: Node.js >= 22 (ESM, globales `fetch`). Es wird keine zusaetzliche
HTTP-Bibliothek benoetigt.

## Registrierung in einem MCP-Client (z.B. Claude)

stdio-Transport, Kommando `node src/server.js`. Beispiel-Konfiguration:

```json
{
  "mcpServers": {
    "erato": {
      "command": "node",
      "args": ["C:\\Users\\k.klein\\privat\\erato\\mcp\\src\\server.js"],
      "env": {
        "ERATO_API_URL": "http://localhost:3001",
        "ERATO_USER": "christian",
        "ERATO_PASS": "erato"
      }
    }
  }
}
```

Fuer Claude Code alternativ:

```bash
claude mcp add erato -- node C:\\Users\\k.klein\\privat\\erato\\mcp\\src\\server.js
```

## Hinweise

- Logs gehen ausschliesslich auf `stderr`, damit das stdio-Protokoll auf `stdout`
  nicht gestoert wird.
- `search_docs` versucht zuerst `/v1/search/hybrid` und faellt bei `404` dauerhaft
  auf `/v1/search` zurueck.
