import { Popover } from '../components/PopOver';

const fn = () => () => {};

const openLayoutDecorator = (Story) => (
  <div
    style={{
      minHeight: '220px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '40px',
    }}
  >
    <Story />
  </div>
);

export default {
  title: 'Components/Popover',
  component: Popover,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  decorators: [openLayoutDecorator],
  tags: ['autodocs'],
};

export const Interactive = {
  args: {
    trigger: <button className="px-3 py-1 bg-blue-600 text-white rounded">Open menu</button>,
    content: (
      <div className="p-3 text-sm text-gray-800">Click the trigger to toggle this popover.</div>
    ),
    hasArrow: false,
    hasShadow: false,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};

export const Open = {
  args: {
    trigger: <button className="px-3 py-1 bg-green-600 text-white rounded">Always open</button>,
    content: (
      <div className="p-3 text-sm text-gray-800">
        This popover is open by default so the content is visible.
      </div>
    ),
    isVisible: true,
    hasArrow: false,
    hasShadow: false,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};

export const OpenWithArrowAndShadow = {
  args: {
    trigger: <button className="px-3 py-1 bg-purple-600 text-white rounded">Actions</button>,
    content: (
      <ul className="p-3 text-sm text-gray-800 space-y-2">
        <li className="cursor-pointer hover:text-blue-600">Rename page</li>
        <li className="cursor-pointer hover:text-blue-600">Duplicate page</li>
        <li className="cursor-pointer hover:text-red-600">Delete page</li>
      </ul>
    ),
    isVisible: true,
    hasArrow: true,
    hasShadow: true,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};
