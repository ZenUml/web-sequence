import { Popover } from '../components/PopOver';

const fn = () => () => {};

export default {
  title: 'Components/Popover',
  component: Popover,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = {
  args: {
    trigger: <button className="px-3 py-1 bg-blue-600 text-white rounded">Open</button>,
    content: <div className="p-3 text-sm text-white">Popover content here.</div>,
    hasArrow: false,
    hasShadow: false,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};

export const WithArrowAndShadow = {
  args: {
    trigger: <button className="px-3 py-1 bg-purple-600 text-white rounded">Hover me</button>,
    content: (
      <div className="p-3 text-sm text-white">
        <strong>Info</strong>
        <p>This popover has an arrow and a drop shadow.</p>
      </div>
    ),
    hasArrow: true,
    hasShadow: true,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};

export const ControlledVisible = {
  args: {
    trigger: <button className="px-3 py-1 bg-green-600 text-white rounded">Always Open</button>,
    content: (
      <ul className="p-3 text-sm text-white space-y-1">
        <li>Action 1</li>
        <li>Action 2</li>
        <li>Action 3</li>
      </ul>
    ),
    isVisible: true,
    hasArrow: true,
    hasShadow: true,
    placement: 'bottom',
    onVisibilityChange: fn(),
  },
};
