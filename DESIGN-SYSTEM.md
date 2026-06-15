# Erato — Design-System (Architektur)

> Ziel: ein **token-getriebenes, app-übergreifend teilbares** Design-System. Designs sind
> portabel (Standard-Format), Komponenten sind garantiert token-konform gestylt, und es gibt
> eine teilbare Live-**Preview**. Grundlage für White-Label.
>
> Status: **Architektur-Entwurf** (noch kein Code). Standard-Prüfung abgeschlossen — siehe
> Quellen am Ende.

## Leitidee

Eine Einbahnstraße als Single Source of Truth:

```
DTCG-Tokens  →  Theme (MUI + CSS-Vars)  →  Komponenten (@erato/ui)  →  Storybook + Apps
```

- **Format:** W3C **DTCG v2025.10** (stabil seit 28.10.2025) — vendor-neutral, von Adobe,
  Google, Microsoft, Figma, Salesforce u.a. getragen. → Designs zwischen Apps tauschbar.
- **Komponenten konsumieren NUR Tokens** (kein hartkodiertes `#fff`/`16px`). Erzwungen per Lint.
- **Preview:** Storybook mit Mode- + Marken-Switcher; als statische Site deploybar = lebender Styleguide.

## Monorepo-Struktur

```
erato/
  packages/
    design-tokens/          @erato/design-tokens
      tokens/               DTCG-JSON (siehe Token-Architektur)
      src/
        resolve.js          Laufzeit-Resolver: (brand, mode) → flache Token-Map
        toMuiTheme.js       Token-Map → MUI createTheme({ cssVariables: true })
        toCssVars.js        Token-Map → CSS-Variablen-String
        schema.js           DTCG-Validierung (JSON Schema / Zod)
      terrazzo.config.js    Build-Time-Generierung der Default-Themes (CSS-Vars)
      index.js
    ui/                     @erato/ui  (React 19 + MUI 7, nur Token-gestylt)
      src/components/...
      .storybook/           Preview + lebende Doku
  apps/
    web/                    Erato-App; konsumiert @erato/ui + @erato/design-tokens
```

(Das bestehende `web/`-Mockup wandert später nach `apps/web` und wird auf die Pakete umgestellt.)

## Token-Architektur (3 Ebenen, DTCG)

DTCG nutzt `$type`/`$value` und Alias-Referenzen `{pfad.zum.token}`.

1. **Primitive** (`tokens/primitives.json`) — mode-/markenneutrale Rohwerte: Farbrampen,
   Spacing-Skala, Radien, Schriftgrößen.
2. **Semantisch** (`tokens/semantic.light.json`, `tokens/semantic.dark.json`) — Bedeutung,
   referenziert Primitive. **Haupt-White-Label-Ebene** (`primary`, `surface`, `text`, `border`…).
3. **Komponenten** (`tokens/component.json`) — Feinschliff, referenziert Semantik
   (`sidebar.bg`, `button.radius`, `highlight.*`).

**Composite-Tokens** (wichtige Praxis-Regel): Typografie und Schatten als DTCG-Composites
modellieren, NICHT flach klopfen — sonst rekonstruieren Tools die Zusammenhänge schlecht.

```jsonc
{
  "color": { "indigo": { "500": { "$type": "color", "$value": "#3B5BDB" } } },   // primitive
  "semantic": { "primary": { "$type": "color", "$value": "{color.indigo.500}" } }, // semantic
  "text": {
    "body": { "$type": "typography", "$value": {                                  // composite
      "fontFamily": "{font.family.sans}", "fontSize": "{font.size.300}",
      "fontWeight": 400, "lineHeight": 1.65
    }}
  }
}
```

## Mode- & Theming-Konvention (die im Standard offene Entscheidung)

Der DTCG-Standard lässt „Modes/Theming" bewusst offen (Tokens Studio nutzt „sets",
Style Dictionary „themes"). **Wir legen eine eigene, einfache Konvention fest** — jede Datei
bleibt valides DTCG, also portabel:

- **Mode (Light/Dark)** und **Brand (White-Label)** sind **orthogonal**. Das aufgelöste Theme
  ist eine Funktion: `theme = resolve(brand, mode)`.
- **Dateien:**
  - `primitives.json` — gemeinsam.
  - `semantic.light.json` / `semantic.dark.json` — Semantik je Mode.
  - `brands/<brand>.json` — überschreibt gezielt Primitive und/oder semantische Tokens.
  - `component.json` — gemeinsam, referenziert Semantik.
- **Merge-Reihenfolge im Resolver:**
  `primitives` ← `brand.primitives` ← `semantic.<mode>` ← `brand.semantic` ← `component`.
- **Ausgabe:**
  - **Build-Time (Default-Themes):** Terrazzo erzeugt CSS-Vars unter `[data-theme="light"]`,
    `[data-theme="dark"]` + `@media (prefers-color-scheme)`.
  - **Laufzeit (White-Label):** unser Resolver merged ein Kunden-`brands/<x>.json` live und
    injiziert CSS-Vars → sofortige Vorschau ohne Rebuild.

## Tooling

- **Build-Time:** **Terrazzo** (`@terrazzo/cli` + `@terrazzo/plugin-css`) — derzeit einziges
  Tool mit voller v2025.10-Unterstützung; Modes → CSS-Selektoren/Media-Queries. Erzeugt die
  Default-CSS-Vars + optional TS-Typen.
- **Laufzeit:** schlanker eigener **Resolver** in `@erato/design-tokens` (Alias-Auflösung +
  `$type`-Handler für color/dimension/typography/shadow → MUI-Palette/CSS-Vars). Klein,
  weil das Format standardisiert ist.
- **MUI:** `createTheme({ cssVariables: true })` → Theme als CSS-Variablen, Umschalten ohne
  Rebuild (ideal für Mode- und Marken-Wechsel).
- **(Optional) Designer-Pfad:** Tokens Studio (Figma, DTCG-kompatibel) kann dieselben Dateien
  pflegen.

> Hinweis: Style Dictionary v4 ist populär, unterstützt v2025.10 aber noch nicht voll (v5 WIP).
> Deshalb Terrazzo. Alias-Auflösung über mehrere Dateien testen wir bewusst (Tool-Semantik
> noch nicht 100% einheitlich) — Aliasing simpel halten.

## Komponentenbibliothek (`@erato/ui`)

- React 19 + MUI 7, jede Komponente ausschließlich über Theme/Tokens gestylt.
- Pro Komponente eine **Story** (`*.stories.jsx`) + optional Play-Function (Interaction-Test).
- Erato-App importiert nur aus `@erato/ui` — kein direktes Styling in der App.

## Qualitäts-Garantien („immer korrekt gestyled")

1. **Token-Contract per Lint:** Stylelint/ESLint-Regel verbietet hartkodierte Farben/Maße
   (`#hex`, `px` außerhalb erlaubter Stellen) → Komponenten *müssen* Tokens nutzen.
2. **Theme-Decorator in Storybook:** globaler Decorator wickelt jede Story in
   `<ThemeProvider>` + `CssBaseline` → keine Story rendert ungethemt.
3. **Mode-/Marken-Switcher:** `@storybook/addon-themes` (`withThemeFromJSXProvider`) → Toolbar
   schaltet Light/Dark + Brands live. = White-Label-Live-Preview über die ganze Bibliothek.
4. **Visuelle Regression:** Storybook **Test-Runner** (Playwright-Snapshots) oder **Chromatic**
   → jede ungewollte visuelle Änderung (auch durch Token-Änderung) wird im PR sichtbar/blockiert.
5. **A11y:** `@storybook/addon-a11y` prüft Kontrast/Bedienbarkeit je Story (relevant für die
   Highlight-Palette und Dark-Mode-Kontraste).

## Preview als Deliverable

`storybook build` → statische Site, deploybar (eigener Host / CI-Artefakt) → teilbare URL.
Stakeholder klicken jedes Branding + Mode durch, ohne die App zu starten. Das ist der gängige
Weg, ein Design-System „auszuliefern".

## White-Label-Zusammenspiel (Zielbild)

- Kunden-Branding = **eine DTCG-Datei** (`brands/<kunde>.json`), die gezielt Tokens überschreibt.
- Logo: Upload → MinIO, URL im Workspace-Setting, gerendert in Icon-Rail + Login.
- Theme-Editor (Phase 2, eigene Komponente `@erato/theme-editor`): Color-Picker an semantische
  Tokens gebunden, Logo-Upload, Live-Vorschau, Export/Import als DTCG. Da das Format Standard
  ist, sind erzeugte Designs zwischen Apps tauschbar.
- Reichweite: self-hosted = „eine Marke pro Instanz"; echtes pro-Kunde-Branding braucht den
  (bewusst zurückgestellten) Multi-Tenant-Schnitt — der Token-Layer ist für beides identisch.

## Empfohlene Aufbau-Reihenfolge (inkrementell, wenn es ans Bauen geht)

1. `@erato/design-tokens`: DTCG-Tokens (3 Ebenen + Composites) + Resolver + `toMuiTheme`.
2. Mockup/`apps/web` auf das Token-Paket umstellen (theme.js → dünner Adapter).
3. `@erato/ui`: 2–3 Komponenten aus dem Mockup extrahieren, token-konform.
4. Storybook mit Theme-/Marken-Switcher → erste teilbare Preview.
5. Lint-Contract + visuelle Regression + a11y.
6. (Phase 2) `@erato/theme-editor` + White-Label-Persistenz.

## Verhältnis zum Erato-MVP

Das Design-System ist ein **Fundament-Subprojekt**, das parallel/vor dem Feature-MVP nützlich
ist, aber den „schlanker MVP zuerst"-Grundsatz nicht aushebeln soll. Empfehlung: Schritte 1–4
liefern schnell Wert (konsistente, previewbare Komponenten für Erato), Schritte 5–6 nach Bedarf.

## Quellen (Standard-Prüfung)

- DTCG v2025.10 stabil: https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- Format Module 2025.10: https://www.designtokens.org/tr/2025.10/format/
- Style Dictionary & DTCG: https://styledictionary.com/info/dtcg/ — v2025.10-Support-Issue: https://github.com/style-dictionary/style-dictionary/issues/1590
- Terrazzo CSS-Plugin: https://terrazzo.app/docs/integrations/css/
- DTCG Praxis-Guide (Pitfalls): https://tasteprofile.io/blog/w3c-dtcg-design-tokens-practical-guide
- Tokens Studio Format-Doku: https://docs.tokens.studio/manage-settings/token-format
