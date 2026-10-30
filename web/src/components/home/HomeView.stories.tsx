import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomeView, type HomeViewProps } from './HomeView';
import type { Appearance, Folder, Item } from '../../domain/types';

// Local sample data only. Signed-in folder states cannot be reached in the
// signed-out app, so these stories show the sidebar with folders and the account
// button. Previews are rendered by the real per-card renderer.
const now = Date.UTC(2026, 9, 20, 10);
function sample(id: string, title: string, js: string, folderId: string | null = null, extra: Partial<Item> = {}): Item {
  return { id, title, js, css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: 'p', updatedOn: now, folderId, ...extra } as Item;
}

const folders: Folder[] = [
  { id: 'f-checkout', name: 'Checkout', createdOn: now, updatedOn: now },
  { id: 'f-auth', name: 'Authentication', createdOn: now, updatedOn: now },
];
const wide = ['Browser', 'Gateway', 'Auth', 'Catalog', 'Cart', 'Pricing', 'Inventory', 'Payment', 'Fraud', 'Ledger', 'Shipping', 'Email', 'Analytics'];
const items: Item[] = [
  sample('s1', 'Checkout flow', 'Customer->Store: Place order\nStore->Payment: Charge\nPayment-->Store: Approved\nStore-->Customer: Confirmation', 'f-checkout'),
  sample('s2', 'Payment retry', 'Checkout->Gateway: Charge card\nGateway-->Checkout: Timeout\nloop(retry) {\n  Checkout->Gateway: Retry payment\n}', 'f-checkout'),
  sample('s3', 'Cross-service checkout', wide.slice(0, -1).map((n, i) => `${n}->${wide[i + 1]}: Step ${i + 1}`).join('\n'), 'f-checkout'),
  sample('s4', 'Sign-in flow', 'Browser->Auth: Sign in\nAuth->Users: Verify credentials\nUsers-->Auth: Account found\nAuth-->Browser: Session token', 'f-auth'),
  sample('s5', 'API request', 'Client->API: GET orders\nAPI->Database: Query orders\nDatabase-->API: Results\nAPI-->Client: 200 OK'),
  sample('s6', 'Untitled', ''),
];

function Frame({ appearance, children }: { appearance: Appearance; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
  }, [appearance]);
  return <div style={{ position: 'fixed', inset: 0 }}>{children}</div>;
}

const noop = () => {};
const base: HomeViewProps = {
  items,
  folders,
  user: { uid: 'sample', displayName: 'Sample User' },
  onOpen: noop,
  onNewDiagram: noop,
  onBrowseTemplates: noop,
  onCreateFromTemplate: noop,
  onOpenSignIn: noop,
  onLogout: noop,
  onCreateFolder: noop,
  onRenameFolder: noop,
  onDeleteFolder: noop,
  onForkItem: noop,
  onDeleteItem: () => Promise.resolve(),
  onExportAll: noop,
  onImport: noop,
  onToggleAppearance: noop,
  readOnly: false,
};

const meta: Meta<typeof HomeView> = {
  title: 'Home/Diagrams',
  component: HomeView,
  args: base,
  render: (args) => (
    <Frame appearance={args.appearance ?? 'light'}>
      <HomeView {...args} />
    </Frame>
  ),
};
export default meta;

type Story = StoryObj<typeof HomeView>;

export const SignedInLight: Story = { args: { appearance: 'light' } };
export const SignedInDark: Story = { args: { appearance: 'dark' } };
export const DeleteFails: Story = {
  args: { appearance: 'light', onDeleteItem: () => Promise.reject(new Error('Sample failure')) },
};
