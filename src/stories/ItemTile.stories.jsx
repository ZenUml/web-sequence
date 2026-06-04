import { fn } from '@storybook/test';
import { ItemTile } from '../components/ItemTile';

export default {
  title: 'Components/ItemTile',
  component: ItemTile,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onForkBtnClick: fn(),
    onRemoveBtnClick: fn(),
    onMoveBtnClick: fn(),
  },
};

// Full card mode with thumbnail image
export const Default = {
  args: {
    item: {
      id: 'item-001',
      title: 'User Login Flow',
      updatedOn: 1705312800000, // 2024-01-15T10:00:00.000Z
      img: null,
    },
    focusable: true,
    compact: false,
  },
};

// Full card mode without image
export const WithImage = {
  args: {
    item: {
      id: 'item-002',
      title: 'Payment Sequence Diagram',
      updatedOn: 1705312800000,
      img: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzM0MTU1Ii8+PHRleHQgeD0iNSIgeT0iMjUiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5M2M1ZmQiPltdPC90ZXh0Pjwvc3ZnPg==',
    },
    focusable: true,
    compact: false,
  },
};

// Compact sidebar mode
export const Compact = {
  args: {
    item: {
      id: 'item-003',
      title: 'Order Processing',
      updatedOn: 1705312800000,
      img: null,
    },
    focusable: true,
    compact: true,
  },
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '240px', background: '#1e293b', borderRadius: '8px', padding: '8px' }}>
        <Story />
      </div>
    ),
  ],
};
