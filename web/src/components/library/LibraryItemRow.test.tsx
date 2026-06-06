import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryItemRow } from './LibraryItemRow';
import type { Item, Folder } from '../../domain/types';

// Pointer capture stubs for Radix dropdown.
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

const folders: Folder[] = [
  { id: 'folder-a', name: 'Alpha', createdOn: 1, updatedOn: 1 },
  { id: 'folder-b', name: 'Beta', createdOn: 2, updatedOn: 2 },
];

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'My Diagram',
    js: '',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    updatedOn: Date.UTC(2026, 0, 15),
    ...overrides,
  };
}

const baseHandlers = () => ({
  onOpen: vi.fn(),
  onFork: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
  onExportHtml: vi.fn(),
});

describe('LibraryItemRow', () => {
  it('renders title and meta line', () => {
    const item = makeItem({ folderId: 'folder-a' });
    render(<LibraryItemRow item={item} folders={folders} {...baseHandlers()} />);

    expect(screen.getByTestId('lib-row-item-1')).toBeInTheDocument();
    expect(screen.getByText('My Diagram')).toBeInTheDocument();
    // Meta line shows the current folder name when item.folderId matches a folder.
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
  });

  it('does not show a folder name in meta when item is unfiled', () => {
    const item = makeItem({ folderId: undefined });
    render(<LibraryItemRow item={item} folders={folders} {...baseHandlers()} />);
    expect(screen.queryByText(/Alpha/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Beta/)).not.toBeInTheDocument();
  });

  it('row click calls onOpen with the item', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-item-1'));
    expect(h.onOpen).toHaveBeenCalledWith(item);
  });

  it('Open action calls onOpen with the item', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-action-open-item-1'));
    expect(h.onOpen).toHaveBeenCalledWith(item);
  });

  it('opening the menu does not fire onOpen (kebab click does not bubble to row)', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    // Menu is open (action items present) but the row's onOpen must NOT have fired.
    expect(await screen.findByTestId('lib-action-open-item-1')).toBeInTheDocument();
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('Fork action calls onFork with the item and does NOT fire onOpen', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-action-fork-item-1'));
    expect(h.onFork).toHaveBeenCalledWith(item);
    // Menu-item clicks must not bubble through the React tree to the row's onClick.
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('Export HTML action calls onExportHtml with the item and does NOT fire onOpen', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-action-exporthtml-item-1'));
    expect(h.onExportHtml).toHaveBeenCalledWith(item);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('moving to a folder calls onMove with the folder id and does NOT fire onOpen', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-move-item-1-folder-b'));
    expect(h.onMove).toHaveBeenCalledWith(item, 'folder-b');
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('moving to Unfiled calls onMove with null', async () => {
    const item = makeItem({ folderId: 'folder-a' });
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-move-item-1-unfiled'));
    expect(h.onMove).toHaveBeenCalledWith(item, null);
  });

  it('delete opens confirm; confirming calls onDelete and does NOT fire onOpen', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);

    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-action-delete-item-1'));

    // Confirm dialog appears (in portal).
    const confirm = await screen.findByTestId('confirm-ok');
    await userEvent.click(confirm);

    expect(h.onDelete).toHaveBeenCalledWith('item-1');
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('delete then cancel does not call onDelete', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);

    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(await screen.findByTestId('lib-action-delete-item-1'));

    const cancel = await screen.findByTestId('confirm-cancel');
    await userEvent.click(cancel);

    expect(h.onDelete).not.toHaveBeenCalled();
    expect(h.onOpen).not.toHaveBeenCalled();
  });
});
