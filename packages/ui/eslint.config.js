import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

// Flat-Config für @erato/ui.
//
// Kern-Garantie ("Token-Contract"): In Komponenten sind KEINE hartkodierten Farbwerte
// erlaubt. Farben müssen ausschließlich aus dem Theme/den Tokens kommen
// (z. B. 'primary.main', 'background.paper', 'divider').
//
// Umgesetzt über `no-restricted-syntax`, das gegen String-Literale matcht, deren Wert
// eine Hex-Farbe (#rgb..#rrggbbaa) bzw. eine rgb()/rgba()-Funktion enthält. Die Regeln
// greifen sowohl bei normalen String-Literalen als auch in Template-Literalen ohne
// Interpolation.
//
// Ausnahmen: An Stellen, an denen ein roher Farbwert bewusst nötig ist (z. B. der
// Brand-Demo-Override in der Storybook-Preview), kann die Regel lokal deaktiviert werden:
//   // eslint-disable-next-line no-restricted-syntax

const HEX_COLOR = '#([0-9a-fA-F]{3,8})'
const RGB_COLOR = 'rgba?\\('

const noHardcodedColors = [
  {
    // String-Literale: '#fff', "#3B5BDB", ...
    selector: `Literal[value=/${HEX_COLOR}/]`,
    message:
      'Keine hartkodierten Farben — nutze Theme/Tokens (z. B. "primary.main", "divider"). Begründung: Token-Contract des Design-Systems.',
  },
  {
    // Template-Literale ohne Interpolation: `#fff`
    selector: `TemplateElement[value.cooked=/${HEX_COLOR}/]`,
    message:
      'Keine hartkodierten Farben — nutze Theme/Tokens (z. B. "primary.main", "divider"). Begründung: Token-Contract des Design-Systems.',
  },
  {
    // rgb()/rgba()-Literale: 'rgb(0,0,0)', "rgba(0,0,0,.5)"
    selector: `Literal[value=/${RGB_COLOR}/]`,
    message:
      'Keine hartkodierten Farben (rgb/rgba) — nutze Theme/Tokens. Begründung: Token-Contract des Design-Systems.',
  },
  {
    selector: `TemplateElement[value.cooked=/${RGB_COLOR}/]`,
    message:
      'Keine hartkodierten Farben (rgb/rgba) — nutze Theme/Tokens. Begründung: Token-Contract des Design-Systems.',
  },
]

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'no-restricted-syntax': ['error', ...noHardcodedColors],
      // Markiert in JSX referenzierte Imports als "genutzt" (sonst no-unused-vars falsch-positiv):
      'react/jsx-uses-vars': 'error',
      // JSX wird genutzt, aber kein klassischer React-Import (React 19 / new JSX transform):
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Stories sind Demos: render()-Funktionen dürfen Hooks nutzen, ungenutzte
    // Demo-Importe sind hier kein Fehler. Der Token-Contract gilt weiterhin.
    files: ['src/**/*.stories.jsx'],
    rules: {
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]
