# Qualitäts-Garantien — `@erato/ui`

Diese drei Werkzeuge sichern zu, dass Komponenten **immer korrekt (token-konform)
gestylt** und **zugänglich** sind. Sie setzen die „Qualitäts-Garantien" des
Design-Systems um.

Alle Befehle laufen im Workspace `@erato/ui` (vom Repo-Root mit
`--workspace @erato/ui` oder direkt in `packages/ui/`).

## 1. Token-Contract per Lint

```bash
npm run lint --workspace @erato/ui
```

Die ESLint-Flat-Config (`eslint.config.js`) verbietet in `src/**/*.{js,jsx}`
**hartkodierte Farbwerte**:

- Hex-Farben (`#fff`, `#3B5BDB`, auch mit Alpha `#rrggbbaa`)
- `rgb(...)` / `rgba(...)`

Greift sowohl in String-Literalen als auch in Template-Literalen (ohne Interpolation).

**Was das bedeutet:** Farben dürfen ausschließlich aus dem Theme/den Tokens kommen,
z. B. `bgcolor: 'primary.main'`, `borderColor: 'divider'`, `color: 'text.secondary'`.
So bleibt White-Label/Light-Dark zentral steuerbar — eine Token-Änderung schlägt
überall durch, ohne Komponenten anzufassen.

**Ausnahmen** (nur wo ein roher Farbwert bewusst nötig ist) lokal deaktivieren:

```js
// eslint-disable-next-line no-restricted-syntax
const demoBrand = '#0CA678'
```

## 2. A11y (Accessibility)

`@storybook/addon-a11y` ist in `.storybook/main.js` registriert. Es prüft pro Story
automatisch Kontrast, Rollen und Bedienbarkeit (axe-core) — besonders relevant für
Dark-Mode-Kontraste und die Brand-Paletten.

```bash
npm run storybook --workspace @erato/ui
```

Im Storybook-UI öffnet sich der Tab **„Accessibility"** je Story mit Violations/Passes.
Wichtig: Storybook nach dem Hinzufügen des Addons **neu starten**.

## 3. Visuelle / Interaktions-Tests (Test-Runner)

`@storybook/test-runner` fährt mit Playwright **gegen ein laufendes Storybook** und
testet jede Story (Smoke-Test „rendert fehlerfrei" + Play-Functions als
Interaktions-Tests).

```bash
# Terminal 1: Storybook starten
npm run storybook --workspace @erato/ui

# Terminal 2: Test-Runner gegen das laufende Storybook
npm run test-storybook --workspace @erato/ui
```

Standard-Ziel ist `http://127.0.0.1:6006`; abweichend per Umgebungsvariable
`TARGET_URL` (z. B. gegen ein statisch gebautes Storybook / CI-Artefakt).
Konfiguration/Erweiterungspunkte: `.storybook/test-runner.js`.

> Hinweis: Der Test-Runner setzt eine installierte Playwright-Browser-Engine voraus
> (`npx playwright install`), falls noch nicht vorhanden.

## Reihenfolge in CI (Empfehlung)

1. `npm install` (zieht die neuen Dev-Deps)
2. `npm run lint --workspace @erato/ui` — Token-Contract
3. `npm run build-storybook --workspace @erato/ui` (statisches Storybook als Artefakt)
4. Storybook (dev oder statisch) bereitstellen → `npm run test-storybook` dagegen
