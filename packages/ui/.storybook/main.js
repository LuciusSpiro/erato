/** @type { import('@storybook/react-vite').StorybookConfig } */
export default {
  stories: ['../src/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-themes', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
}
