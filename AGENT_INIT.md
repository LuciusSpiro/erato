# Erato — Agent-Initialisierung

**Du bist ein KI-Coding-Agent (z.B. Claude Code). Dieses Dokument ist ein Prompt:
Führe die folgenden Schritte aus, um dich so zu konfigurieren, dass du die
Projekt-Dokumentation in *Erato* lesen und pflegen kannst.** Erato ist ein
self-hosted Wissens-/Notiz-System mit einem MCP-Server, der Tools zum Lesen und
Schreiben der Doku bereitstellt.

Arbeite im **aktuellen Projektverzeichnis** (das Repo, an dem entwickelt wird) —
NICHT im Erato-Repo selbst.

---

## Schritt 1 — Eckdaten klären

Ermittle (frage den Nutzer kurz, falls unklar):

1. **Ziel (`ERATO_TARGET`)**
   - `web` — Team-/Server-Instanz (Keycloak). Login über den Service-Account `docs-bot`.
   - `local` — lokale Erato-Desktop-App (kein Login). **Die App muss geöffnet sein.**
2. **Projekt-Notizbuch (`ERATO_NOTEBOOK`)** — Name des Notizbuchs für die Doku
   dieses Projekts (z.B. der Repo-Name). Existiert es nicht, wird es beim ersten
   `upsert_page` automatisch angelegt.
3. **Pfad zum Erato-MCP-Server** — Standard auf diesem Rechner:
   `C:\Users\k.klein\privat\erato\mcp\src\server.js` (anpassen, falls woanders).
   Voraussetzung: Node.js ≥ 22.

---

## Schritt 2 — MCP-Server registrieren (`.mcp.json`)

Lege im Projekt-Root eine `.mcp.json` an (oder ergänze den `erato`-Eintrag unter
`mcpServers`, falls die Datei schon existiert — bestehende Server NICHT entfernen).

**Variante `web`:**
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
        "ERATO_NOTEBOOK": "<PROJEKT-NOTIZBUCH>"
      }
    }
  }
}
```

**Variante `local`** (Desktop-App offen lassen):
```json
{
  "mcpServers": {
    "erato": {
      "command": "node",
      "args": ["C:\\Users\\k.klein\\privat\\erato\\mcp\\src\\server.js"],
      "env": {
        "ERATO_TARGET": "local",
        "ERATO_NOTEBOOK": "<PROJEKT-NOTIZBUCH>"
      }
    }
  }
}
```

> Hinweis: Die MCP-Tools werden vom Client (Claude Code) erst **nach dem Laden der
> `.mcp.json`** sichtbar — ggf. ist eine Bestätigung des neuen Servers oder ein
> Neustart der Session nötig. Weise den Nutzer darauf hin.

---

## Schritt 3 — Projekt-Konvention in die `CLAUDE.md` schreiben

Füge im Projekt-Root in die `CLAUDE.md` (anlegen, falls nicht vorhanden) diesen
Abschnitt ein. Ersetze den Notizbuch-Namen:

```markdown
## Dokumentation (Erato)

Die Projekt-Doku liegt in Erato (MCP-Server `erato`, Notizbuch „<PROJEKT-NOTIZBUCH>").
- **Vor** größeren Änderungen mit `research_topic` den Ist-Stand erfassen
  („gib mir alles zu …") statt einzeln zu suchen und zu lesen.
- **Nach** inhaltlichen Änderungen die betroffene Doku-Seite mit `upsert_page`
  aktualisieren. Pfad = Thema/Feature (z.B. `Architektur/Datenbank`, `API/Endpunkte`,
  `Setup`).
- `upsert_page` ist **idempotent** — niemals `create_page` für ein bestehendes Thema
  verwenden (sonst Duplikate).
- Veraltete Seiten mit `delete_page` entfernen.
- Suche/Recherche bleibt standardmäßig auf dieses Notizbuch eingegrenzt
  (`ERATO_NOTEBOOK`); `notebook: "*"` durchsucht die ganze Instanz.
```

---

## Schritt 4 — Verifizieren

Sobald die MCP-Tools geladen sind:
1. `list_notebooks` aufrufen — bestätigt die Verbindung.
2. `research_topic` mit einem Projektbegriff testen — zeigt vorhandene Doku (oder leer).

Schlägt es fehl, siehe **Troubleshooting**.

---

## Tool-Referenz (Erato MCP)

| Tool | Zweck |
|------|-------|
| `research_topic(query, notebook?, limit?)` | „Gib mir alles zu X": Hybrid-Suche + Volltext der Top-Treffer in einem Aufruf. Default auf das Projekt-Notizbuch eingegrenzt; `notebook:"*"` = instanzweit. |
| `upsert_page(path, markdown, notebook?, title?)` | Idempotent Seite per Titel-Pfad anlegen/aktualisieren. **Bevorzugt** zum Doku-Pflegen. |
| `search_docs(query)` | Trefferliste mit Snippets. |
| `read_page(pageId)` | Volltext einer Seite. |
| `list_notebooks()` / `list_pages(notebookId)` | Struktur erkunden. |
| `create_notebook(title, icon?)` | Neues Notizbuch. |
| `create_page(notebookId, title, markdown, parentId?)` | Seite immer neu anlegen (nur wenn `upsert_page` nicht passt). |
| `update_page(pageId, markdown?, title?)` / `append_to_page(pageId, markdown)` | Per id ändern/erweitern. |
| `delete_page(pageId)` | Seite (inkl. Unterseiten) löschen. |

**Arbeitsregeln:** Inhalt ist Markdown (kanonisch). Interne Verweise auf andere
Seiten als `[Titel](#/page/<pageId>)`. Pro Thema **eine** stabile Pfad-Adresse
benutzen, damit Updates idempotent bleiben.

---

## Troubleshooting

- **„Lokale Erato-Instanz nicht gefunden"** (target `local`): Die Desktop-App ist
  nicht geöffnet. App starten und erneut versuchen.
- **`docs-bot` darf nicht schreiben** (target `web`, HTTP 403): Der Account muss
  Mitglied (editor/owner) des Ziel-Notizbuchs sein — in der App unter
  Notizbuch-Menü → „Mitglieder…" hinzufügen. Oder den Bot via `upsert_page` ein
  **neues** Notizbuch anlegen lassen (er wird dann owner).
- **AI-/semantische Suche fehlt:** Ollama läuft nicht bzw. kein Modell installiert.
  Volltextsuche funktioniert trotzdem; die semantische Komponente entfällt still.
- **Tools nicht sichtbar:** `.mcp.json` wurde noch nicht geladen — Server bestätigen
  oder Session neu starten.
