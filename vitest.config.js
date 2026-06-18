import { defineConfig } from 'vitest/config'

// Ein Vitest-Lauf für das ganze Monorepo. Auswahl per Pfad-Filter:
//   npm run test:unit  → web/src + packages/design-tokens (schnell, ohne Dienste)
//   npm run test:api   → api/test (braucht den laufenden Stack)
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/design-tokens/test/**/*.test.js',
      'web/src/**/*.test.{js,jsx}',
      'api/test/**/*.test.js',
    ],
  },
})
