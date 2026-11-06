import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HomeView, type HomeViewProps } from './HomeView';
import { useLibraryStore } from '../../state/libraryStore';
import type { Folder, Item } from '../../domain/types';

// Folder states (Figma F48): inline create/rename, delete, empty folder, drag to a
// folder, Move to folder fallback, Undo, failures and retry; plus search no-results,
// the import contract and the Report a bug placement.

function item(id: string, title: string, updatedOn: number, extra: Partial<Item> = {}): Item {
  return { id, title, updatedOn, js: `A->B: ${title}`, css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: 'p', folderId: null, ...extra } as Item;
}

const FOLDERS: Folder[] = [
  { id: 'f1', name: 'Checkout', createdOn: 1, updatedOn: 1 },
  { id: 'f2', name: 'Authentication', createdOn: 1, updatedOn: 1 },
];
const ITEMS = [
  item('a', 'Checkout flow', 300, { folderId: 'f1' }),
  item('b', 'API request', 200),
  item('c', 'Payment retry', 100, { folderId: 'f1' }),
];

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function baseProps(over: Partial<HomeViewProps> = {}): HomeViewProps {
  return {
    items: ITEMS,
    folders: FOLDERS,
    user: { uid: 'u', displayName: 'Ada' },
    onOpen: vi.fn(),
    onNewDiagram: vi.fn(),
    onBrowseTemplates: vi.fn(),
    onCreateFromTemplate: vi.fn(),
    onOpenSignIn: vi.fn(),
    onLogout: vi.fn(),
    onCreateFolder: vi.fn(() => Promise.resolve()),
    onRenameFolder: vi.fn(() => Promise.resolve()),
    onDeleteFolder: vi.fn(() => Promise.resolve()),
    onForkItem: vi.fn(),
    onDeleteItem: vi.fn(() => Promise.resolve()),
    onMoveItem: vi.fn(() => Promise.resolve()),
    readOnly: false,
    ...over,
  };
}

// A HomeView whose items follow successful moves, like the real library store.
function LiveHome({ props, initial = ITEMS }: { props: Partial<HomeViewProps>; initial?: Item[] }) {
  const [items, setItems] = useState(initial);
  const onMoveItem = async (it: Item, folderId: string | null) => {
    await props.onMoveItem?.(it, folderId);
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, folderId } : i)));
  };
  return <HomeView {...baseProps(props)} items={items} onMoveItem={onMoveItem} />;
}

beforeEach(() => {
  useLibraryStore.setState({ query: '', activeFolderId: null, sort: 'updated' });
});

describe('create folder (inline)', () => {
  it('Enter creates, Esc cancels, blank does nothing', async () => {
    const onCreateFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onCreateFolder })} />);
    await userEvent.click(screen.getByTestId('folder-new'));
    const input = screen.getByTestId('folder-new-input');
    expect(screen.getByTestId('folder-edit')).toHaveTextContent('Enter to create · Esc to cancel');
    await userEvent.type(input, '   {Enter}');
    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(screen.getByTestId('folder-new-input')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    expect(onCreateFolder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('folder-new'));
    await userEvent.type(screen.getByTestId('folder-new-input'), '  Backend {Enter}');
    expect(onCreateFolder).toHaveBeenCalledWith('Backend');
    await waitFor(() => expect(screen.queryByTestId('folder-new-input')).toBeNull());
    expect(screen.getAllByTestId('folder-new')).toHaveLength(1);
  });

  it('pending blocks a duplicate write; failure keeps the name and Try again retries', async () => {
    const first = deferred();
    const onCreateFolder = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve());
    render(<HomeView {...baseProps({ onCreateFolder })} />);
    await userEvent.click(screen.getByTestId('folder-new'));
    const input = screen.getByTestId('folder-new-input');
    await userEvent.type(input, 'Backend{Enter}');
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('folder-edit')).toHaveTextContent('Creating…');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
    await act(async () => { first.reject(new Error('offline')); });
    const error = await screen.findByTestId('folder-edit-error');
    expect(error).toHaveTextContent('Couldn’t create this folder');
    expect(error).toHaveTextContent('Check your connection and try again.');
    expect(error).toHaveTextContent('Your folder name is kept.');
    expect(screen.getByTestId('folder-new-input')).toHaveValue('Backend');
    await userEvent.click(screen.getByTestId('folder-edit-retry'));
    expect(onCreateFolder).toHaveBeenNthCalledWith(2, 'Backend');
    await waitFor(() => expect(screen.queryByTestId('folder-new-input')).toBeNull());
  });

  it('Cancel after a failure closes without writing; clicking away cancels creation', async () => {
    const onCreateFolder = vi.fn(() => Promise.reject(new Error('offline')));
    render(<HomeView {...baseProps({ onCreateFolder })} />);
    await userEvent.click(screen.getByTestId('folder-new'));
    await userEvent.type(screen.getByTestId('folder-new-input'), 'Backend{Enter}');
    await screen.findByTestId('folder-edit-error');
    await userEvent.click(screen.getByTestId('folder-edit-cancel'));
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    expect(onCreateFolder).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId('folder-new'));
    await userEvent.type(screen.getByTestId('folder-new-input'), 'Draft');
    await userEvent.click(screen.getByTestId('home-search'));
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
  });

  it('is not offered when signed out (folders are cloud-only)', () => {
    render(<HomeView {...baseProps({ readOnly: true, folders: [], user: null })} />);
    expect(screen.queryByTestId('folder-new')).toBeNull();
    expect(screen.queryByRole('button', { name: /Move .* to folder/ })).toBeNull();
    expect(screen.getByTestId('home-card-a')).not.toHaveAttribute('draggable');
  });
});

describe('rename folder (inline)', () => {
  it('opens from the rename button, double-click or F2; Enter renames; Esc cancels', async () => {
    const onRenameFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onRenameFolder })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Rename folder Authentication' }));
    const input = screen.getByTestId('folder-rename-f2');
    expect(input).toHaveValue('Authentication');
    expect(screen.getByTestId('folder-edit')).toHaveTextContent('Enter to rename · Esc to cancel');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('folder-rename-f2')).toBeNull();
    expect(onRenameFolder).not.toHaveBeenCalled();

    screen.getByTestId('folder-f2').focus();
    await userEvent.keyboard('{F2}');
    await userEvent.clear(screen.getByTestId('folder-rename-f2'));
    await userEvent.keyboard('{Enter}');
    expect(onRenameFolder).not.toHaveBeenCalled(); // blank does nothing
    await userEvent.type(screen.getByTestId('folder-rename-f2'), 'Identity{Enter}');
    expect(onRenameFolder).toHaveBeenCalledWith('f2', 'Identity');
  });

  it('a touch double-tap on a folder does not open rename (mouse double-click does)', () => {
    // jsdom has no PointerEvent; a minimal one carries pointerType to React.
    const g = globalThis as unknown as { PointerEvent?: unknown };
    const hadPointer = 'PointerEvent' in g;
    if (!hadPointer) {
      g.PointerEvent = class extends MouseEvent {
        pointerType: string;
        constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
          super(type, init);
          this.pointerType = init.pointerType ?? 'mouse';
        }
      };
    }
    try {
      render(<HomeView {...baseProps()} />);
      const row = screen.getByTestId('folder-f2');
      fireEvent.pointerDown(row, { pointerType: 'touch' });
      fireEvent.doubleClick(row);
      expect(screen.queryByTestId('folder-rename-f2')).toBeNull();
      fireEvent.pointerDown(row, { pointerType: 'mouse' });
      fireEvent.doubleClick(row);
      expect(screen.getByTestId('folder-rename-f2')).toBeInTheDocument();
    } finally {
      if (!hadPointer) delete g.PointerEvent;
    }
  });

  it('blur commits (existing behaviour); failure keeps the name for retry', async () => {
    const onRenameFolder = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      .mockImplementationOnce(() => Promise.resolve());
    render(<HomeView {...baseProps({ onRenameFolder })} />);
    await userEvent.dblClick(screen.getByTestId('folder-f1'));
    const input = screen.getByTestId('folder-rename-f1');
    await userEvent.clear(input);
    await userEvent.type(input, 'Orders');
    await userEvent.click(screen.getByTestId('home-search'));
    expect(onRenameFolder).toHaveBeenCalledWith('f1', 'Orders');
    const error = await screen.findByTestId('folder-edit-error');
    expect(error).toHaveTextContent('Couldn’t rename this folder');
    expect(screen.getByTestId('folder-rename-f1')).toHaveValue('Orders');
    await userEvent.click(screen.getByTestId('folder-edit-retry'));
    expect(onRenameFolder).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByTestId('folder-rename-f1')).toBeNull());
  });
});

describe('delete folder', () => {
  it('names the folder and its diagram count, keeps diagrams, and Cancel returns focus', async () => {
    const onDeleteFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onDeleteFolder })} />);
    const trigger = screen.getByRole('button', { name: 'Delete folder Checkout' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Delete “Checkout”?' });
    expect(dialog).toHaveTextContent('The folder contains 2 diagrams.');
    expect(dialog).toHaveTextContent('Your diagrams will be kept and moved to Not in a folder.');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDeleteFolder).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('pending blocks double submit; failure keeps the dialog for retry; success shows Not in a folder', async () => {
    const first = deferred();
    const onDeleteFolder = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve());
    useLibraryStore.setState({ activeFolderId: 'f1' });
    render(<HomeView {...baseProps({ onDeleteFolder })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder Checkout' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByTestId('folder-delete-confirm');
    expect(confirm).toHaveTextContent('Delete folder');
    await userEvent.click(confirm);
    expect(confirm).toHaveTextContent('Deleting…');
    await userEvent.click(confirm);
    await userEvent.keyboard('{Escape}');
    expect(onDeleteFolder).toHaveBeenCalledTimes(1);
    await act(async () => { first.reject(new Error('offline')); });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Couldn’t delete this folder');
    await userEvent.click(within(dialog).getByTestId('folder-delete-confirm'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDeleteFolder).toHaveBeenCalledTimes(2);
    expect(onDeleteFolder).toHaveBeenCalledWith('f1');
    expect(useLibraryStore.getState().activeFolderId).toBe('unfiled');
  });

  it('says an empty folder is empty', async () => {
    render(<HomeView {...baseProps()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder Authentication' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('The folder is empty.');
    expect(dialog).not.toHaveTextContent('moved to');
  });
});

describe('empty states are distinct', () => {
  it('empty folder, no search results, and empty library each have their own message', async () => {
    const { rerender } = render(<HomeView {...baseProps()} />);
    await userEvent.click(screen.getByTestId('folder-f2'));
    expect(screen.getByTestId('home-folder-empty')).toHaveTextContent('No diagrams in this folder');
    expect(screen.getByTestId('home-folder-empty')).toHaveTextContent('Drag a diagram here');
    expect(screen.queryByTestId('home-no-results')).toBeNull();
    expect(screen.queryByTestId('home-empty')).toBeNull();

    await userEvent.type(screen.getByTestId('home-search'), 'nothing-here');
    expect(screen.queryByTestId('home-folder-empty')).toBeNull();
    const none = screen.getByTestId('home-no-results');
    expect(none).toHaveTextContent('No matches');
    expect(none).toHaveTextContent('No diagrams match “nothing-here”.');
    expect(screen.getByTestId('home-search')).toHaveValue('nothing-here');
    await userEvent.click(within(none).getByRole('button', { name: 'Clear search' }));
    expect(screen.getByTestId('home-search')).toHaveValue('');
    expect(screen.getByTestId('home-search')).toHaveFocus();

    rerender(<HomeView {...baseProps({ items: [] })} />);
    useLibraryStore.setState({ activeFolderId: null });
    await waitFor(() => expect(screen.getByTestId('home-empty')).toHaveTextContent('No diagrams yet'));
  });
});

describe('move to folder', () => {
  it('menu fallback moves immediately (no confirmation) and updates counts', async () => {
    const onMoveItem = vi.fn(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    expect(screen.getByTestId('folder-f2')).toHaveTextContent('Authentication0');
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Not in a folder/ })).toHaveAttribute('data-disabled');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Authentication' }));
    expect(onMoveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), 'f2');
    await waitFor(() => expect(screen.getByTestId('folder-f2')).toHaveTextContent('Authentication1'));
    expect(screen.getByTestId('folder-unfiled')).toHaveTextContent('Not in a folder0');
    const status = screen.getByTestId('move-status');
    expect(status).toHaveTextContent('Diagram moved');
    expect(status).toHaveTextContent('API request → Authentication');
    expect(status).toHaveTextContent('Diagram content is unchanged.');
    expect(screen.queryByRole('button', { name: /Move here/ })).toBeNull();
  });

  it('Undo restores the previous folder, including Not in a folder (null)', async () => {
    const onMoveItem = vi.fn(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Checkout' }));
    await waitFor(() => expect(screen.getByTestId('folder-f1')).toHaveTextContent('Checkout3'));
    await userEvent.click(screen.getByTestId('move-undo'));
    expect(onMoveItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), null);
    await waitFor(() => expect(screen.getByTestId('folder-unfiled')).toHaveTextContent('Not in a folder1'));
    expect(screen.getByTestId('move-status')).toHaveTextContent('Move undone');
  });

  it('a stale Undo is refused when the diagram moved again elsewhere', async () => {
    const onMoveItem = vi.fn(() => Promise.resolve());
    const props = baseProps({ onMoveItem });
    const { rerender } = render(<HomeView {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Checkout' }));
    await waitFor(() => expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved'));
    // The library reports the move, then a later move from another tab.
    const at = (folderId: string | null) => ITEMS.map((i) => (i.id === 'b' ? { ...i, folderId } : i));
    rerender(<HomeView {...props} items={at('f1')} />);
    rerender(<HomeView {...props} items={at('f2')} />);
    await userEvent.click(screen.getByTestId('move-undo'));
    expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'stale');
    expect(screen.getByTestId('move-status')).toHaveTextContent('was moved again, so Undo was skipped');
    expect(onMoveItem).toHaveBeenCalledTimes(1);
  });

  it('a failed move keeps the diagram where it was and Try again retries', async () => {
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      .mockImplementationOnce(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Authentication' }));
    const status = await screen.findByRole('alert');
    expect(status).toHaveTextContent('Couldn’t move this diagram');
    expect(screen.getByTestId('folder-unfiled')).toHaveTextContent('Not in a folder1');
    await userEvent.click(within(status).getByTestId('move-retry'));
    await waitFor(() => expect(screen.getByTestId('folder-f2')).toHaveTextContent('Authentication1'));
    expect(onMoveItem).toHaveBeenCalledTimes(2);
  });

  it('dismissing while a move is pending hides its success, but a failure still shows', async () => {
    const first = deferred();
    const second = deferred();
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<HomeView {...baseProps({ onMoveItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Authentication' }));
    await userEvent.click(screen.getByTestId('move-status-dismiss'));
    await act(async () => { first.resolve(); });
    expect(screen.queryByTestId('move-status')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Move Payment retry to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Authentication' }));
    await userEvent.click(screen.getByTestId('move-status-dismiss'));
    await act(async () => { second.reject(new Error('offline')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t move this diagram');
  });

  it('a pending move ignores a second move of the same diagram', async () => {
    const first = deferred();
    const onMoveItem = vi.fn(() => first.promise);
    render(<HomeView {...baseProps({ onMoveItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Authentication' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move API request to folder' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Checkout' }));
    expect(onMoveItem).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); });
  });

  it('drag onto a folder highlights it, drop moves at once, and the drag never opens the diagram', async () => {
    const onMoveItem = vi.fn(() => Promise.resolve());
    const onOpen = vi.fn();
    render(<LiveHome props={{ onMoveItem, onOpen }} />);
    const card = screen.getByTestId('home-card-b');
    expect(card).toHaveAttribute('draggable', 'true');
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(card, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-zenuml-diagram', 'b');
    expect(screen.getByTestId('folder-drag-hint')).toHaveTextContent('Drop to move · Esc to cancel');
    const target = screen.getByTestId('folder-f2');
    fireEvent.dragOver(target, { dataTransfer });
    expect(target).toHaveClass('is-drop-target');
    expect(target).toHaveTextContent('+1');
    // The current place is not a drop target.
    fireEvent.dragOver(screen.getByTestId('folder-unfiled'), { dataTransfer });
    expect(screen.getByTestId('folder-unfiled')).not.toHaveClass('is-drop-target');
    fireEvent.drop(target, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });
    fireEvent.click(within(card).getByRole('button', { name: 'Open API request' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onMoveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), 'f2');
    await waitFor(() => expect(screen.getByTestId('folder-f2')).toHaveTextContent('Authentication1'));
    expect(screen.queryByTestId('folder-drag-hint')).toBeNull();
  });

  it('highlights on dragenter alone and keeps it when the pointer moves onto the row label', () => {
    render(<HomeView {...baseProps()} />);
    const card = screen.getByTestId('home-card-b');
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(card, { dataTransfer });
    const target = screen.getByTestId('folder-f2');
    // Chromium can deliver dragenter for the final position without a dragover.
    fireEvent.dragEnter(target, { dataTransfer });
    expect(target).toHaveClass('is-drop-target');
    // Moving onto the row's own label keeps the highlight (no flicker, no loss).
    const label = within(target).getByText('Authentication');
    fireEvent.dragEnter(label, { dataTransfer });
    fireEvent.dragLeave(target, { dataTransfer });
    expect(target).toHaveClass('is-drop-target');
    // Entering anything outside a folder row clears it.
    fireEvent.dragEnter(screen.getByTestId('home-search'), { dataTransfer });
    expect(target).not.toHaveClass('is-drop-target');
  });

  it('a cancelled drag (Esc) moves nothing and clears the highlight', () => {
    const onMoveItem = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onMoveItem })} />);
    const card = screen.getByTestId('home-card-b');
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: 'none' };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('folder-f1'), { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });
    expect(onMoveItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('folder-f1')).not.toHaveClass('is-drop-target');
    expect(screen.queryByTestId('folder-drag-hint')).toBeNull();
  });
});

describe('import contract', () => {
  function pick(file?: File) {
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: file ? [file] : [] });
    fireEvent.change(input);
    return input;
  }

  it('onImportFile receives the File, blocks overlapping picks while pending, and allows reselecting the same file', async () => {
    const first = deferred();
    const onImportFile = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve());
    render(<HomeView {...baseProps({ onImportFile, onExportAll: vi.fn() })} />);
    const file = new File(['{}'], 'diagrams.json', { type: 'application/json' });
    const input = pick(file);
    expect(onImportFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
    await waitFor(() => expect(screen.getByTestId('lib-import')).toHaveAttribute('aria-disabled', 'true'));
    pick(file);
    expect(onImportFile).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); });
    await waitFor(() => expect(screen.getByTestId('lib-import')).not.toHaveAttribute('aria-disabled'));
    pick(file);
    expect(onImportFile).toHaveBeenCalledTimes(2);
  });

  it('importPending from the controller disables the picker', async () => {
    render(<HomeView {...baseProps({ onImportFile: vi.fn(), importPending: true, onExportAll: vi.fn() })} />);
    expect(screen.getByTestId('lib-import')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('lib-import')).toHaveTextContent('Importing…');
  });

  it('a cancelled picker is silent', () => {
    const onImportFile = vi.fn();
    const onImport = vi.fn();
    render(<HomeView {...baseProps({ onImportFile, onImport, onExportAll: vi.fn() })} />);
    pick(undefined);
    expect(onImportFile).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('legacy onImport: a file read failure is reported, not an unhandled rejection', async () => {
    const onImport = vi.fn();
    const onImportError = vi.fn();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      render(<HomeView {...baseProps({ onImport, onImportError, onExportAll: vi.fn() })} />);
      const bad = new File(['x'], 'broken.json');
      const readError = new DOMException('The file could not be read.', 'NotReadableError');
      Object.defineProperty(bad, 'text', { value: () => Promise.reject(readError) });
      pick(bad);
      await waitFor(() => expect(onImportError).toHaveBeenCalledWith(readError));
      expect(onImport).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('legacy onImport still receives the file text', async () => {
    const onImport = vi.fn();
    render(<HomeView {...baseProps({ onImport, onExportAll: vi.fn() })} />);
    const file = new File(['{"a":1}'], 'd.json');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('{"a":1}') });
    pick(file);
    await waitFor(() => expect(onImport).toHaveBeenCalledWith('{"a":1}'));
  });
});

describe('Report a bug placement', () => {
  it('renders the provided control as the last Library tool, not over the grid', () => {
    render(
      <HomeView
        {...baseProps({ onExportAll: vi.fn(), onImport: vi.fn(), reportBug: <button type="button" data-testid="report-bug-fab">Report a bug</button> })}
      />,
    );
    const tools = screen.getByRole('group', { name: 'Library tools' });
    const buttons = within(tools).getAllByRole('button');
    expect(buttons[buttons.length - 1]).toHaveTextContent('Report a bug');
    expect(screen.getByTestId('home-grid')).not.toContainElement(screen.getByTestId('report-bug-fab'));
  });
});

// DG-F1: a pending rename owns the edit until it settles.
describe('pending rename keeps its edit (DG-F1)', () => {
  async function startRename() {
    await userEvent.dblClick(screen.getByTestId('folder-f1'));
    const input = screen.getByTestId('folder-rename-f1');
    await userEvent.clear(input);
    await userEvent.type(input, 'Orders');
    return input;
  }

  it('Enter, then New folder while pending: the rename keeps its name, error and retry', async () => {
    const first = deferred();
    const onRenameFolder = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve());
    const onCreateFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onRenameFolder, onCreateFolder })} />);
    await startRename();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByTestId('folder-new'));
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    expect(screen.getByTestId('folder-rename-f1')).toHaveValue('Orders');
    await act(async () => { first.reject(new Error('offline')); });
    expect(await screen.findByTestId('folder-edit-error')).toHaveTextContent('Couldn’t rename this folder');
    expect(screen.getByTestId('folder-rename-f1')).toHaveValue('Orders');
    await userEvent.click(screen.getByTestId('folder-edit-retry'));
    expect(onRenameFolder).toHaveBeenCalledTimes(2);
    expect(onRenameFolder).toHaveBeenNthCalledWith(2, 'f1', 'Orders');
    await waitFor(() => expect(screen.queryByTestId('folder-rename-f1')).toBeNull());
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('blur then New folder click (rejection): one rename write, labelled as rename, retry once', async () => {
    const first = deferred();
    const onRenameFolder = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve());
    const onCreateFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onRenameFolder, onCreateFolder })} />);
    await startRename();
    await userEvent.click(screen.getByTestId('folder-new')); // blur starts the save, click follows
    expect(onRenameFolder).toHaveBeenCalledTimes(1);
    expect(onRenameFolder).toHaveBeenCalledWith('f1', 'Orders');
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    await act(async () => { first.reject(new Error('offline')); });
    expect(await screen.findByTestId('folder-edit-error')).toHaveTextContent('Couldn’t rename this folder');
    expect(screen.getByTestId('folder-rename-f1')).toHaveValue('Orders');
    await userEvent.click(screen.getByTestId('folder-edit-retry'));
    expect(onRenameFolder).toHaveBeenCalledTimes(2);
    expect(onRenameFolder).toHaveBeenLastCalledWith('f1', 'Orders');
    await waitFor(() => expect(screen.queryByTestId('folder-rename-f1')).toBeNull());
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('blur then New folder click (success): the rename completes and New folder works afterwards', async () => {
    const first = deferred();
    const onRenameFolder = vi.fn(() => first.promise);
    const onCreateFolder = vi.fn(() => Promise.resolve());
    render(<HomeView {...baseProps({ onRenameFolder, onCreateFolder })} />);
    await startRename();
    await userEvent.click(screen.getByTestId('folder-new'));
    expect(screen.queryByTestId('folder-new-input')).toBeNull();
    await act(async () => { first.resolve(); });
    await waitFor(() => expect(screen.queryByTestId('folder-rename-f1')).toBeNull());
    expect(onRenameFolder).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('folder-new'));
    expect(screen.getByTestId('folder-new-input')).toHaveValue('');
    expect(screen.queryByTestId('folder-edit-error')).toBeNull();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });
});

// DG-F2: only the latest move owns the status panel and its Undo.
describe('out-of-order moves (DG-F2)', () => {
  async function moveVia(title: string, folder: string) {
    await userEvent.click(screen.getByRole('button', { name: `Move ${title} to folder` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: folder }));
  }

  it('an older success while the newer move is pending keeps the newer status; Undo targets the newer move (null)', async () => {
    const a = deferred();
    const b = deferred();
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementation(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await moveVia('Checkout flow', 'Authentication'); // A: f1 -> f2
    await moveVia('API request', 'Checkout'); // B: null -> f1
    const status = screen.getByTestId('move-status');
    expect(status).toHaveAttribute('data-kind', 'pending');
    expect(status).toHaveTextContent('API request → Checkout');
    await act(async () => { a.resolve(); });
    expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'pending');
    expect(screen.getByTestId('move-status')).toHaveTextContent('API request → Checkout');
    await act(async () => { b.resolve(); });
    await waitFor(() => expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved'));
    expect(screen.getByTestId('move-status-route')).toHaveTextContent('API request → Checkout');
    await userEvent.click(screen.getByTestId('move-undo'));
    expect(onMoveItem).toHaveBeenCalledTimes(3);
    expect(onMoveItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), null);
    await waitFor(() => expect(screen.getByTestId('move-status')).toHaveTextContent('Move undone'));
  });

  it('an older success after the newer result keeps the newer result and Undo', async () => {
    const a = deferred();
    const b = deferred();
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementation(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await moveVia('Checkout flow', 'Authentication');
    await moveVia('API request', 'Checkout');
    await act(async () => { b.resolve(); });
    await waitFor(() => expect(screen.getByTestId('move-status-route')).toHaveTextContent('API request → Checkout'));
    await act(async () => { a.resolve(); });
    expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved');
    expect(screen.getByTestId('move-status-route')).toHaveTextContent('API request → Checkout');
    await userEvent.click(screen.getByTestId('move-undo'));
    expect(onMoveItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), null);
  });

  it('an older failure does not replace the newer status; it is shown separately with its own retry', async () => {
    const a = deferred();
    const b = deferred();
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementation(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await moveVia('Checkout flow', 'Authentication');
    await moveVia('API request', 'Checkout');
    await act(async () => { a.reject(new Error('offline')); });
    expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'pending');
    expect(screen.getByTestId('move-status')).toHaveTextContent('API request → Checkout');
    const earlier = screen.getByTestId('move-earlier-failure');
    expect(earlier).toHaveTextContent('Couldn’t move Checkout flow');
    await act(async () => { b.resolve(); });
    await waitFor(() => expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved'));
    expect(screen.getByTestId('move-status-route')).toHaveTextContent('API request → Checkout');
    expect(screen.getByTestId('move-earlier-failure')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('move-earlier-retry'));
    expect(onMoveItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }), 'f2');
    await waitFor(() => expect(screen.getByTestId('folder-f2')).toHaveTextContent('Authentication1'));
    expect(screen.queryByTestId('move-earlier-failure')).toBeNull();
  });

  it('an older failure after the newer result keeps that result and its Undo', async () => {
    const a = deferred();
    const b = deferred();
    const onMoveItem = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise)
      .mockImplementation(() => Promise.resolve());
    render(<LiveHome props={{ onMoveItem }} />);
    await moveVia('Checkout flow', 'Authentication');
    await moveVia('API request', 'Checkout');
    await act(async () => { b.resolve(); });
    await waitFor(() => expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved'));
    await act(async () => { a.reject(new Error('offline')); });
    expect(screen.getByTestId('move-status')).toHaveAttribute('data-kind', 'moved');
    expect(screen.getByTestId('move-status-route')).toHaveTextContent('API request → Checkout');
    expect(screen.getByTestId('move-earlier-failure')).toHaveTextContent('Couldn’t move Checkout flow');
    await userEvent.click(screen.getByTestId('move-undo'));
    expect(onMoveItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), null);
  });
});
