import "../src/assets/tailwind.css";
import "../src/style.css";
import "./preview-global.css";

/** @type { import('@storybook/preact').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#252637" },
        { name: "light", value: "#ffffff" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};
export default preview;
