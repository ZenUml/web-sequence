import type { StorybookConfig } from '@storybook/react-vite';

// react-vite inherits web/vite.config.ts automatically (Tailwind via postcss,
// path resolution, plugins), so no viteFinal override is needed for these
// components. In SB9+, viewport/controls/actions are part of core — only a11y is
// listed here.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;
