import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryPanel } from './LibraryPanel';
import { useLibraryStore } from '../../state/libraryStore';
import type { Item, Folder } from '../../domain/types';

// Pointer capture stubs for Radix dropdown (rows contain Radix Menus).
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!window.scrollTo) {
    window.scrollTo = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

// libraryStore is a singleton — reset between tests so state doesn't leak.
beforeEach(() => {
  useLibraryStore.setState({ query: '', activeFolderId: null, sort: 'updated' });
});

const folders: Folder[] = [
  { id: 'folder-a', name: 'Alpha', createdOn: 1, updatedOn: 1 },
  { id: 'folder-b', name: 'Beta', createdOn: 2, updatedOn: 2 },
];

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-x',
    title: 'Untitled',
    js: '',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    updatedOn: 0,
    ...overrides,
  };
}

const items: Item[] = [
  makeItem({ id: 'i-alpha', title: 'Alpha Login', js: 'A->B: hi', folderId: 'folder-a', updatedOn: 300 }),
  makeItem({ id: 'i-beta', title: 'Beta Flow', js: 'Client->Server: req', folderId: 'folder-b', updatedOn: 200 }),
  // unfiled: no folderId
  makeItem({ id: 'i-unfiled', title: 'Loose Sketch', js: 'X->Y: ping', updatedOn: 100 }),
  // orphaned folderId not present in `folders` → must render under Unfiled (CQ-3)
  makeItem({ id: 'i-ghost', title: 'Ghost Note', js: 'P->Q: zzz', folderId: 'folder-ghost', updatedOn: 400 }),
];

const baseHandlers = () => ({
  onOpen: vi.fn(),
  onFork: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
  onExportAll: vi.fn(),
  onImport: vi.fn(),
  onExportHtml: vi.fn(),
  onCreateFolder: vi.fn(),
  onRenameFolder: vi.fn(),
  onDeleteFolder: vi.fn(),
});

function renderPanel(props: Partial<Parameters<typeof LibraryPanel>[0]> = {}) {
  const handlers = baseHandlers();
  render(<LibraryPanel items={items} folders={folders} {...handlers} {...props} />);
  return handlers;
}

describe('LibraryPanel', () => {
  it('shows a total count of all items in the library', () => {
    renderPanel();
    const total = screen.getByTestId('lib-total-count');
    expect(total).toHaveTextContent('4');
    // Total reflects the whole library, not the current filter.
    expect(total.className).toMatch(/font-mono/);
  });

  it('renders all rows when no folder filter is active', () => {
    renderPanel();
    expect(screen.getByTestId('lib-row-i-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('lib-row-i-beta')).toBeInTheDocument();
    expect(screen.getByTestId('lib-row-i-unfiled')).toBeInTheDocument();
    expect(screen.getByTestId('lib-row-i-ghost')).toBeInTheDocument();
  });

  it('filters by a specific folder', async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId('folder-folder-a'));
    expect(screen.getByTestId('lib-row-i-alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-beta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-unfiled')).not.toBeInTheDocument();
  });

  it('Unfiled includes items with no folder AND items whose folderId is not in folders (CQ-3)', async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId('folder-unfiled'));
    // genuinely unfiled
    expect(screen.getByTestId('lib-row-i-unfiled')).toBeInTheDocument();
    // orphaned folderId 'folder-ghost' (not in folders) → existence check puts it here
    expect(screen.getByTestId('lib-row-i-ghost')).toBeInTheDocument();
    // filed items must not appear
    expect(screen.queryByTestId('lib-row-i-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-beta')).not.toBeInTheDocument();
  });

  it('search filters by title (case-insensitive)', async () => {
    renderPanel();
    await userEvent.type(screen.getByTestId('lib-search'), 'beta');
    expect(screen.getByTestId('lib-row-i-beta')).toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-alpha')).not.toBeInTheDocument();
  });

  it('search also matches the diagram source (js), not just the title', async () => {
    renderPanel();
    // 'Server' appears only in i-beta's js, not in any title.
    await userEvent.type(screen.getByTestId('lib-search'), 'server');
    expect(screen.getByTestId('lib-row-i-beta')).toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lib-row-i-unfiled')).not.toBeInTheDocument();
  });

  it('folder counts stay independent of the active query', async () => {
    renderPanel();
    // Before typing: All count = 4
    expect(within(screen.getByTestId('folder-all')).getByText('4')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('lib-search'), 'beta');
    // Counts are computed over the full item set, not the filtered view.
    expect(within(screen.getByTestId('folder-all')).getByText('4')).toBeInTheDocument();
    // Unfiled count = i-unfiled + i-ghost = 2
    expect(within(screen.getByTestId('folder-unfiled')).getByText('2')).toBeInTheDocument();
  });

  it('sort toggles row order between updated-desc and title', async () => {
    renderPanel();
    // Match row containers only — exclude the per-row kebab (`lib-row-menu-*`).
    const ids = () =>
      screen
        .getAllByTestId(/^lib-row-i-/)
        .map((el) => el.getAttribute('data-testid'));

    // Default sort: updated desc → ghost(400), alpha(300), beta(200), unfiled(100)
    expect(ids()).toEqual([
      'lib-row-i-ghost',
      'lib-row-i-alpha',
      'lib-row-i-beta',
      'lib-row-i-unfiled',
    ]);

    await userEvent.click(screen.getByTestId('lib-sort'));

    // Title sort → Alpha Login, Beta Flow, Ghost Note, Loose Sketch
    expect(ids()).toEqual([
      'lib-row-i-alpha',
      'lib-row-i-beta',
      'lib-row-i-ghost',
      'lib-row-i-unfiled',
    ]);
  });

  it('ArrowDown moves focus to the next row; Enter opens it', async () => {
    const h = renderPanel();
    const first = screen.getByTestId('lib-row-i-ghost'); // first in default order
    first.focus();
    expect(first).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    const second = screen.getByTestId('lib-row-i-alpha');
    expect(second).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(h.onOpen.mock.calls[0][0].id).toBe('i-alpha');
  });

  it('ArrowUp moves focus to the previous row and clamps at the top', async () => {
    renderPanel();
    const ghost = screen.getByTestId('lib-row-i-ghost'); // first in default order
    const alpha = screen.getByTestId('lib-row-i-alpha'); // second
    alpha.focus();
    expect(alpha).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(ghost).toHaveFocus();

    // Already at the top — ArrowUp clamps (stays on the first row).
    await userEvent.keyboard('{ArrowUp}');
    expect(ghost).toHaveFocus();
  });

  it('shows the "No diagrams" empty state when there are no items at all', () => {
    const handlers = baseHandlers();
    render(<LibraryPanel items={[]} folders={folders} {...handlers} />);
    const empty = screen.getByTestId('library-empty');
    expect(empty).toHaveTextContent(/No diagrams/i);
    expect(empty.querySelector('.font-serif')).not.toBeNull();
  });

  it('shows the "No matches" empty state when a query filters everything out', async () => {
    renderPanel();
    await userEvent.type(screen.getByTestId('lib-search'), 'zzzznomatch');
    const empty = screen.getByTestId('library-empty');
    expect(empty).toHaveTextContent(/No matches/i);
    expect(empty.querySelector('.font-serif')).not.toBeNull();
    // The library is not empty overall, so the count still reflects the full set.
    expect(screen.getByTestId('lib-total-count')).toHaveTextContent('4');
  });

  it('wires import/export bar handlers through', async () => {
    const h = renderPanel();
    await userEvent.click(screen.getByTestId('lib-export-all'));
    expect(h.onExportAll).toHaveBeenCalled();
  });
});
