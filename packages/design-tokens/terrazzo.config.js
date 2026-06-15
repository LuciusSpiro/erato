// Terrazzo-Build-Konfig (DOKUMENTATION / nicht ausgeführt).
//
// Ziel: Mit @terrazzo/cli + @terrazzo/plugin-css aus den DTCG-Token-Dateien
// CSS-Variablen je Mode (light/dark) erzeugen — pro Mode unter einem
// [data-theme]-Selektor, sodass ein Theme-Wechsel ohne JS-Rebuild möglich ist.
//
// Voraussetzung (NICHT installiert — alles hier ist pures JS/Node 22):
//   npm i -D @terrazzo/cli @terrazzo/plugin-css
// Build (später):
//   npx terrazzo build
//
// Die Mode-Auflösung (semantic.light / semantic.dark) entspricht der Layer-
// Reihenfolge in src/index.js: primitives ← semantic[mode] ← typography ←
// highlight ← component ← brand. Zur Laufzeit liefert toCssVars() aus
// resolveTokens(mode) denselben Effekt rein in JS.
//
// import { defineConfig } from '@terrazzo/cli'
// import css from '@terrazzo/plugin-css'
//
// export default defineConfig({
//   tokens: [
//     './tokens/primitives.json',
//     './tokens/semantic.light.json',
//     './tokens/semantic.dark.json',
//     './tokens/typography.json',
//     './tokens/highlight.json',
//     './tokens/component.json',
//   ],
//   outDir: './dist',
//   plugins: [
//     css({
//       filename: 'tokens.css',
//       // Pro Mode ein Selektor: :root[data-theme="light"] / [data-theme="dark"].
//       modeSelectors: [
//         { mode: 'light', selectors: [':root', '[data-theme="light"]'] },
//         { mode: 'dark', selectors: ['[data-theme="dark"]'] },
//       ],
//       variableName: (id) => `--erato-${id.replace(/\./g, '-')}`,
//     }),
//   ],
// })

export default {}
