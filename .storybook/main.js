/** @type { import('@storybook/preact-vite').StorybookConfig } */
const config = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/preact-vite",
    options: {},
  },
  viteFinal: async (config) => {
    config.define = {
      ...config.define,
      __COMMITHASH__: JSON.stringify("storybook"),
    };
    return config;
  },
};
export default config;
