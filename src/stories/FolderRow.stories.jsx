import { FolderRow } from '../components/FolderRow';

const fn = () => () => {};

export default {
  title: 'Components/FolderRow',
  component: FolderRow,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'padded',
  },
  tags: ['autodocs'],
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

export const Collapsed = {
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
