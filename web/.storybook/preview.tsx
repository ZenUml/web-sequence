import type { Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';

// This UI lives on the dark "ink" chrome surface, so wrap every story in it and
// load the global stylesheet so Drafting Table tokens + fonts resolve.
const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div
        className="bg-ink-900 text-ondark-strong font-sans"
        style={{ minHeight: '100vh', width: '100%', padding: '2rem' }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
