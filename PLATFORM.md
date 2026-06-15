# Erato-Plattform — Durchstich (eine Instanz pro Kunde, design-system-fähig)

> Beantwortet:
> 1. Wie bleiben **Theme (DTCG-Tokens) + Logo** persistent gespeichert und **app-übergreifend** nutzbar?
> 2. Wie sieht der **Gesamtdurchstich** aus (Container, DBs), so dass eine **zweite App**
>    dasselbe Design-System nutzen *könnte*?
>
> Status: Architektur-Entwurf. Baut auf [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) und [PLAN.md](PLAN.md) auf.

## Gewähltes Modell

- **Eine Deployment-Instanz pro Kunde.** Kein Multi-Tenant-Routing, keine Mandantentrennung.
  Pro Instanz gibt es **ein** Branding (hell/dunkel + Logo), zur Laufzeit editierbar.
- **App B nur als Architektur-Seam.** Wir bauen jetzt nur Erato, sorgen aber dafür, dass eine
  zweite App dasselbe Design-System + denselben Login *anstöpseln könnte* (Konzept-Beweis,
  kein Bau).

## Kernidee: Design einmal hinterlegt, von jeder App konsumierbar

- **Build-Time (npm-Pakete, geteilt):** `@erato/design-tokens` (Default-Tokens + Resolver) und
  `@erato/ui` (Komponenten). Jede App baut damit → gleiche Komponenten, gleiche Defaults.
- **Laufzeit (Branding-Store, geteilt):** das kundenspezifische **Delta** (geänderte Tokens +
  Logo) liegt zentral und wird über die Defaults gemerged. Eine App-agnostische API liefert es
  aus → **eine** Pflegestelle, jede App zeigt dasselbe Branding.

## Branding-Datenmodell (die Persistenz-Antwort)

DB-Schema `branding` (eigene, isolierte Schema/DB — App-agnostisch):

```
branding(
  app_id TEXT NULL PRIMARY KEY,   -- NULL = instanz-weites Default-Branding (gilt für ALLE Apps)
                                  --        gesetzt = optionaler Override für eine bestimmte App
  tokens JSONB,                   -- DTCG-Delta über die Paket-Defaults
  logo_key      TEXT NULL,        -- Key in MinIO (hell)
  logo_dark_key TEXT NULL,        -- optional (dunkel)
  updated_at, updated_by
)
```

- Üblicherweise genau **eine** Zeile (`app_id = NULL`) = das Branding der Instanz.
  Bräuchte eine zweite App ein abweichendes Logo o.ä., kommt eine Zeile mit ihrer `app_id` dazu.
- **Logo** in **MinIO** (Bucket `branding`, Key `logo[-dark].svg`); in der DB nur der Key.
- **Lesen (App-Start):** `GET /v1/branding?app=<id>` → Merge **Default(Paket) ← instanz-weit ←
  app-spezifisch** → aufgelöstes DTCG + Logo-URLs → App führt Resolver aus → MUI-Theme/CSS-Vars.
- **Schreiben (Theme-Editor, Admin-Rolle):** `PUT /v1/branding[/<app>]` (Tokens, DTCG-validiert)
  und `POST /v1/branding/logo` (→ MinIO).
- **Caching:** ändert sich selten → `ETag`/`Cache-Control`.

## Wo lebt die Branding-API? (Empfehlung)

- **Jetzt (nur Erato):** Branding-Routen **als isoliertes Modul in `erato-api`** unter eigenem
  DB-Schema `branding` und app-agnostischem API-Vertrag (`/v1/branding?app=…`). Kein Extra-Container.
- **Wenn App B real wird:** dasselbe Modul 1:1 als eigenständigen `branding-api`-Service
  herauslösen (gleicher Vertrag, gleiches Schema). Der Seam ist durch den app-agnostischen
  Vertrag + das isolierte Schema schon angelegt → kein Umbau der Apps.

## Identität (Keycloak)

- **Keycloak** als Login für Erato; ein Realm. Stellt zugleich sicher, dass eine zweite App
  später denselben Realm nutzt → **SSO ohne Umbau**.
- Rollen im MVP: global `member` / `admin` (Admin darf Branding bearbeiten). Feinere Rechte später.

## Container-Inventar (jetzt zu bauen)

| Container | Zweck | DB / Storage | Status |
|---|---|---|---|
| `keycloak` | Login/Identität (SSO-fähig für 2. App) | `pg:keycloak` | jetzt |
| `postgres` (pgvector) | eine Instanz, DBs/Schemas: `keycloak`, `erato` (+ Schema `branding`) | Volume | jetzt |
| `minio` | Object-Storage; Buckets `branding`, `erato` | Volume | jetzt |
| `erato-api` | Erato-Backend **inkl. Branding-Modul** (`/v1/branding`) | `pg:erato` + Schema `branding`, `minio` | jetzt |
| `erato-web` | Erato-Frontend (nginx, statisch); baut `@erato/ui` + `@erato/design-tokens` | – | jetzt |
| `erato-mcp` | MCP-Server (über erato-api) | – | Phase 2 |
| `ollama` | Embeddings (semantische Suche/AI) | Volume | Phase 2 |

**Seam für App B (nicht gebaut):** `appb-api` + `appb-web` würden denselben `keycloak`,
dieselbe (dann herausgelöste) `branding-api`, dasselbe `minio` und eine eigene DB `appb` nutzen.
Optional ein `traefik`/`nginx`-Reverse-Proxy, sobald zwei Web-Apps + TLS gebündelt werden.

> `@erato/design-tokens` und `@erato/ui` sind **keine Container**, sondern npm-Pakete im Monorepo,
> die `erato-web` (und später `appb-web`) zur Build-Zeit einbinden.

## Topologie (docker-compose, jetzt)

```
        Browser
           │
           ▼
       erato-web ───────────────┐ (holt Branding beim Start)
           │                    ▼
           ├──────────▶  erato-api  ──┬─▶ pg:erato (+ schema branding)
           │            (+ /v1/branding,│
           │             + erato-mcp,   ├─▶ minio (branding, erato)
           │             + ollama [P2]) │
           ▼                            ▼
       keycloak ───────────────────▶ pg:keycloak

   Gemeinsam/Plattform: postgres (1 Instanz) · minio · keycloak
   Design-System: npm-Pakete (build-time) + /v1/branding (runtime)
```

## Boot-/Request-Fluss

1. Browser → `erato-web`; Login/SSO über **Keycloak**.
2. `erato-web` ruft `GET /v1/branding?app=erato` (über erato-api).
3. Branding-Modul merged Default(Paket) ← instanz-weit ← (app-spez.) → DTCG + Logo-URLs.
4. App führt `@erato/design-tokens`-Resolver aus → MUI-Theme/CSS-Vars, Logo rendern.
5. Admin im **Theme-Editor**: `PUT /v1/branding` (Tokens) / `POST /v1/branding/logo` (→ MinIO).
   Wirkt beim nächsten Laden (Cache-TTL).

## Phasen-Rollout

- **P0 — Durchstich:** `keycloak` + `postgres` + `minio` + `erato-api` (mit Branding-Modul,
  Default-Branding) + `erato-web`, das sein Theme aus `/v1/branding` zieht statt aus der Konstante.
  Beweist den Laufzeit-Pfad Login→Branding→Theme.
- **P1 — Editor & Logo:** Theme-Editor schreibt Branding; Logo-Upload nach MinIO.
- **P2 — Erato-Features:** restliche M1–M4 aus [PLAN.md](PLAN.md) (Editor, Suche), dann AI/MCP.
- **(Bei Bedarf) — App B:** Branding-Modul als eigenen Service herauslösen, zweite App
  anstöpseln; ggf. Reverse-Proxy. Architektur trägt es bereits.

## Offene Entscheidungen

1. **Branding jetzt als Modul in `erato-api`** (empfohlen, schlank) vs. von Anfang an eigener
   `branding-api`-Container (mehr Trennung, mehr Ops).
2. **Keycloak-DB:** eigene DB in derselben Postgres-Instanz (empfohlen) vs. separate Instanz.
3. **Reverse-Proxy schon jetzt** (sauberes TLS/Routing) vs. erst wenn die zweite App kommt.

