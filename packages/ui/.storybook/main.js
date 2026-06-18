/** @type { import('@storybook/react-vite').StorybookConfig } */
export default {
  stories: ['../src/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-themes', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Automatischer JSX-Runtime (wie im Web): kein "import React" nötig, sonst
  // erscheint "React is not defined". Erzwingt esbuild + ein aktives plugin-react.
  async viteFinal(config) {
    const react = (await import('@vitejs/plugin-react')).default
    config.esbuild = { ...(config.esbuild || {}), jsx: 'automatic', jsxImportSource: 'react' }
    const hasReact = (config.plugins || []).some((p) => {
      const name = Array.isArray(p) ? p[0]?.name : p?.name
      return typeof name === 'string' && name.includes('vite:react')
    })
    if (!hasReact) config.plugins = [...(config.plugins || []), react()]
    return config
  },
}
