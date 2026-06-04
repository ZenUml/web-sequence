import { ItemTile } from '../components/ItemTile';

const fn = () => () => {};

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

// Compact sidebar mode - rendered inside a sidebar-like container that
// matches the real app's dark left panel so the title, time, and (hover-only)
// action buttons have room and don't overlap.
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
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px', background: '#202020', borderRadius: '8px', padding: '8px' }}>
        <Story />
      </div>
    ),
  ],
};

// Multiple compact tiles stacked in the sidebar container - demonstrates
// real usage in the app's left panel. Action buttons appear only on hover,
// so they are correctly hidden in a static screenshot.
export const CompactList = {
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px', background: '#202020', borderRadius: '8px', padding: '8px' }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <div>
      <ItemTile
        {...args}
        item={{
          id: 'item-101',
          title: 'User Login Flow',
          updatedOn: 1705312800000, // 2024-01-15T10:00:00.000Z
          img: null,
        }}
      />
      <ItemTile
        {...args}
        item={{
          id: 'item-102',
          title: 'Payment Sequence Diagram With A Very Long Title',
          updatedOn: 1704067200000, // 2024-01-01T00:00:00.000Z
          img: null,
        }}
      />
      <ItemTile
        {...args}
        item={{
          id: 'item-103',
          title: 'Order Processing',
          updatedOn: 1706745600000, // 2024-02-01T00:00:00.000Z
          img: null,
        }}
      />
    </div>
  ),
  args: {
    focusable: true,
    compact: true,
  },
};
