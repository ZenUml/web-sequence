import { FolderRow } from '../components/FolderRow';

const fn = () => () => {};

export default {
  title: 'Components/FolderRow',
  component: FolderRow,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          width: '300px',
          background: '#202020',
          padding: '8px',
          borderRadius: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    onToggle: fn(),
    onRename: fn(),
    onDelete: fn(),
  },
};

export const Default = {
  args: {
    folder: { id: 'folder-1', name: 'My Diagrams' },
    isOpen: false,
    itemCount: 5,
  },
};

export const Expanded = {
  args: {
    folder: { id: 'folder-2', name: 'Work Projects' },
    isOpen: true,
    itemCount: 3,
  },
};

export const EmptyFolder = {
  args: {
    folder: { id: 'folder-3', name: 'New Folder' },
    isOpen: false,
    itemCount: 0,
  },
};
