import Tab from '../components/Tab';

const fn = () => () => {};

export default {
  title: 'Components/Tab',
  component: Tab,
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
    label: 'Sequence',
    activeTab: 'Overview',
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
