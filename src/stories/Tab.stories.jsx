import Tab from '../components/Tab';

const fn = () => () => {};

// The Tab renders a bare <li>; on the dark canvas a lone tab is nearly
// invisible and active vs inactive look identical. Wrap each story in a
// <ul class="tab-list"> on a contrasting dark panel (matching the app's
// dark editor chrome) so the active styling actually shows.
const tabListDecorator = (Story) => (
  <div
    style={{
      background: '#202020',
      padding: '8px',
      borderRadius: '6px',
      width: '360px',
    }}
  >
    <ul className="tab-list">
      <Story />
    </ul>
  </div>
);

export default {
  title: 'Components/Tab',
  component: Tab,
  decorators: [tabListDecorator],
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = {
  args: {
    label: 'Sequence',
    activeTab: 'Sequence',
    onClick: fn(),
    lineOfCode: 0,
  },
};

export const Active = {
  args: {
    label: 'Sequence',
    activeTab: 'Sequence',
    onClick: fn(),
    lineOfCode: 0,
  },
};

export const Inactive = {
  args: {
    label: 'Overview',
    activeTab: 'Sequence',
    onClick: fn(),
    lineOfCode: 0,
  },
};

export const WithLineOfCode = {
  args: {
    label: 'Sequence',
    activeTab: 'Sequence',
    onClick: fn(),
    lineOfCode: 42,
  },
};

// Renders multiple tabs together so the active (Sequence) vs inactive
// (Overview, Mermaid) contrast is obvious in a single screenshot.
// Uses its own render() so the shared <ul class="tab-list"> wraps all three.
export const TabBar = {
  // This story provides its own <ul class="tab-list"> wrapper via render(),
  // so override the global decorator to avoid double-wrapping.
  decorators: [(Story) => <Story />],
  parameters: {
    layout: 'centered',
  },
  render: () => {
    const activeTab = 'Sequence';
    const noop = () => {};
    return (
      <div
        style={{
          background: '#202020',
          padding: '8px',
          borderRadius: '6px',
          width: '360px',
        }}
      >
        <ul className="tab-list">
          <Tab
            label="Sequence"
            activeTab={activeTab}
            onClick={noop}
            lineOfCode={42}
          />
          <Tab
            label="Overview"
            activeTab={activeTab}
            onClick={noop}
            lineOfCode={0}
          />
          <Tab
            label="Mermaid"
            activeTab={activeTab}
            onClick={noop}
            lineOfCode={0}
          />
        </ul>
      </div>
    );
  },
};
