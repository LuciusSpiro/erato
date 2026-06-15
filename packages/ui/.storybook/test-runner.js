/**
 * Konfiguration für @storybook/test-runner.
 *
 * Der Test-Runner startet Playwright und besucht JEDE Story in einem laufenden
 * Storybook (Default: http://127.0.0.1:6006, überschreibbar via TARGET_URL).
 * Pro Story wird damit ein Smoke-Test gefahren (rendert fehlerfrei) und — wenn
 * vorhanden — die Play-Function als Interaktions-Test ausgeführt.
 *
 * Voraussetzung: ein laufendes Storybook (npm run storybook --workspace @erato/ui)
 * bzw. ein gebautes statisches Storybook (siehe QUALITY.md).
 *
 * Die Hooks sind bewusst minimal/no-op gehalten und dienen als Erweiterungspunkt,
 * z. B. um später visuelle Snapshots oder zusätzliche a11y-Assertions pro Story
 * zu ergänzen.
 *
 * @type {import('@storybook/test-runner').TestRunnerConfig}
 */
const config = {
  async preVisit() {
    // Hook vor dem Rendern jeder Story (Erweiterungspunkt).
  },
  async postVisit() {
    // Hook nach dem Rendern jeder Story (Erweiterungspunkt, z. B. Snapshots/a11y).
  },
}

export default config
