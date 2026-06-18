# White-Label / Branding der Desktop-App

Diese Dateien steuern das Branding **eines** Builds (pro Kunde ein vorgebrandeter
Installer). Sie werden zur Build-Zeit (Installer-Optik, App-Icon) und beim
Erststart der App (Theme + Logo in der DB) verwendet.

## Dateien

- `brand.json` — Theme & App-Name:
  ```json
  {
    "appName": "Mein Wiki",
    "primary": { "light": "#3B5BDB", "dark": "#748FFC" },
    "logo": { "light": "logo-light.png", "dark": "logo-dark.png" }
  }
  ```
  `logo` ist optional. Ohne `logo` startet die App mit dem Text-Logo (App-Name);
  ein Logo kann jederzeit **in der App** (Einstellungen → Branding) gesetzt werden.

- `logo-light.png` / `logo-dark.png` — optionale Logos (relativ zu `brand.json`),
  werden beim Erststart in den lokalen Storage geseedet.

- `icon.ico` (Windows), `icon.icns` (macOS), `icon.png` (Linux) — App- und
  Installer-Icon. Wird von electron-builder genutzt.

## Wichtig

Der Erststart-Seed überschreibt **keine** Nutzer-Anpassungen: Sobald jemand das
Branding in der App geändert hat, bleibt das bei Updates erhalten.
