import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeView, QUICK_STARTS, type HomeViewProps } from './HomeView';
import { useLibraryStore } from '../../state/libraryStore';
import { TEMPLATES, blankTemplate } from '../../domain/templates';
import type { Folder, Item } from '../../domain/types';

function item(id: string, title: string, updatedOn: number, extra: Partial<Item> = {}): Item {
  return { id, title, updatedOn, js: `A->B: ${title}`, css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: 'p', ...extra } as Item;
}

const ITEMS = [
  item('a', 'Checkout flow', 300),
  item('b', 'API request', 200, { folderId: 'f1' }),
  item('c', 'Payment retry', 100, { js: 'Gateway->Bank: refund' }),
];
const FOLDERS: Folder[] = [{ id: 'f1', name: 'Checkout', createdOn: 1, updatedOn: 1 }];

function makeProps(over: Partial<HomeViewProps> = {}): HomeViewProps {
  return {
    items: ITEMS,
    folders: FOLDERS,
    user: null,
    onOpen: vi.fn(),
    onNewDiagram: vi.fn(),
    onBrowseTemplates: vi.fn(),
    onCreateFromTemplate: vi.fn(),
    onOpenSignIn: vi.fn(),
    onLogout: vi.fn(),
    onCreateFolder: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onForkItem: vi.fn(),
    onDeleteItem: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

function cardTitles() {
  return within(screen.getByTestId('home-grid'))
    .getAllByRole('button', { name: /^Open / })
    .map((b) => b.getAttribute('aria-label')!.replace(/^Open /, ''));
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  useLibraryStore.setState({ query: '', activeFolderId: null, sort: 'updated' });
});

describe('Start something new', () => {
  it('offers Blank, Black & White, Blue and Classic UML — not Basic, and no Hide action', () => {
    render(<HomeView {...makeProps()} />);
    const block = screen.getByTestId('home-start-block');
    expect(within(block).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'BlankStart with an empty diagram.',
      'Black & WhiteSharp ink. Crisp shadows.',
      'BlueSoft blue. Rounded details.',
      'Classic UMLPale yellow. Rose-red lines.',
    ]);
    expect(screen.queryByTestId('home-template-basic')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    // Basic is only removed from this row; the template itself is retained.
    expect(TEMPLATES.some((t) => t.id === 'basic')).toBe(true);
  });

  it('creates each quick start directly with the unchanged template payload', async () => {
    const onCreateFromTemplate = vi.fn();
    const onBrowseTemplates = vi.fn();
    render(<HomeView {...makeProps({ onCreateFromTemplate, onBrowseTemplates })} />);
    await userEvent.click(screen.getByTestId('home-template-blank'));
    for (const id of ['black-white', 'blue', 'starUMLTheme'] as const) {
      await userEvent.click(screen.getByTestId(`home-template-${id}`));
    }
    expect(onCreateFromTemplate.mock.calls.map((c) => c[0])).toEqual([
      blankTemplate(),
      TEMPLATES.find((t) => t.id === 'black-white')!.item,
      TEMPLATES.find((t) => t.id === 'blue')!.item,
      TEMPLATES.find((t) => t.id === 'starUMLTheme')!.item,
    ]);
    expect(onBrowseTemplates).not.toHaveBeenCalled();
    expect(QUICK_STARTS.every((q) => q.art.length > 0)).toBe(true);
  });
});

describe('top bar', () => {
  it('New creates a blank diagram directly and has no dropdown', async () => {
    const onNewDiagram = vi.fn();
    render(<HomeView {...makeProps({ onNewDiagram })} />);
    await userEvent.click(screen.getByTestId('home-new'));
    expect(onNewDiagram).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'More new diagram options' })).toBeNull();
  });

  it('toggles appearance through the provided setting callback', async () => {
    const onToggleAppearance = vi.fn();
    const { rerender } = render(<HomeView {...makeProps({ appearance: 'light', onToggleAppearance })} />);
    const toggle = screen.getByTestId('home-appearance');
    expect(toggle).toHaveAccessibleName('Switch to dark appearance');
    await userEvent.click(toggle);
    expect(onToggleAppearance).toHaveBeenCalledTimes(1);
    rerender(<HomeView {...makeProps({ appearance: 'dark', onToggleAppearance })} />);
    expect(screen.getByTestId('home-appearance')).toHaveAccessibleName('Switch to light appearance');
  });

  it('keeps sign-in when signed out and the account button when signed in', async () => {
    const onOpenSignIn = vi.fn();
    const onLogout = vi.fn();
    const { rerender } = render(<HomeView {...makeProps({ onOpenSignIn, onLogout })} />);
    await userEvent.click(screen.getByTestId('home-signin'));
    expect(onOpenSignIn).toHaveBeenCalledTimes(1);
    rerender(<HomeView {...makeProps({ onOpenSignIn, onLogout, user: { uid: 'u', displayName: 'Ada' } })} />);
    expect(screen.queryByTestId('home-signin')).toBeNull();
    await userEvent.click(screen.getByTestId('home-avatar'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Diagrams list', () => {
  it('sorts by Last modified and Name A–Z with two direct choices', async () => {
    render(<HomeView {...makeProps()} />);
    expect(cardTitles()).toEqual(['Checkout flow', 'API request', 'Payment retry']);
    expect(screen.getByTestId('home-sort-updated')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Name A–Z' }));
    expect(cardTitles()).toEqual(['API request', 'Checkout flow', 'Payment retry']);
    expect(screen.getByTestId('home-sort-title')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('filters by title and diagram text, updates the count, and keeps the no-match message', async () => {
    render(<HomeView {...makeProps()} />);
    expect(screen.getByTestId('home-count')).toHaveTextContent('3');
    const search = screen.getByTestId('home-search');
    await userEvent.type(search, 'refund');
    expect(cardTitles()).toEqual(['Payment retry']);
    expect(screen.getByTestId('home-count')).toHaveTextContent('1');
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.queryByTestId('home-grid')).toBeNull();
    expect(screen.getByText('No matches')).toBeInTheDocument();
    // Search stays reachable so the query can be cleared.
    expect(screen.getByTestId('home-search')).toHaveValue('zzz');
    await userEvent.click(screen.getByTestId('search-clear'));
    expect(screen.getByTestId('home-search')).toHaveValue('');
    expect(cardTitles()).toHaveLength(3);
  });

  it('filters by folder from the sidebar labels', async () => {
    render(<HomeView {...makeProps({ readOnly: false })} />);
    expect(screen.getByTestId('folder-all')).toHaveTextContent('All diagrams3');
    expect(screen.getByTestId('folder-unfiled')).toHaveTextContent('Not in a folder2');
    expect(screen.getAllByRole('button', { name: /New folder/ })).toHaveLength(1);
    await userEvent.click(screen.getByTestId('folder-f1'));
    expect(cardTitles()).toEqual(['API request']);
    await userEvent.click(screen.getByTestId('folder-unfiled'));
    expect(cardTitles()).toEqual(['Checkout flow', 'Payment retry']);
  });

  it('places Import diagrams and Export all in the sidebar', async () => {
    const onExportAll = vi.fn();
    render(<HomeView {...makeProps({ onExportAll, onImport: vi.fn() })} />);
    const sidebar = screen.getByTestId('home-sidebar');
    expect(within(sidebar).getByTestId('lib-import')).toHaveTextContent('Import diagrams');
    await userEvent.click(within(sidebar).getByTestId('lib-export-all'));
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it('opens a diagram from its card and shows the Edited date', async () => {
    const onOpen = vi.fn();
    render(<HomeView {...makeProps({ onOpen, items: [item('a', 'Checkout flow', Date.UTC(2026, 9, 20, 12))] })} />);
    const card = screen.getByTestId('home-card-a');
    expect(card).toHaveTextContent('20 Oct 2026');
    await userEvent.click(within(card).getByRole('button', { name: 'Open Checkout flow' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('renders an empty diagram as a placeholder instead of a renderer', () => {
    render(<HomeView {...makeProps({ items: [item('e', 'Untitled', 1, { js: '' })] })} />);
    const card = screen.getByTestId('home-card-e');
    expect(card).toHaveTextContent('Empty diagram');
    expect(card.querySelector('iframe')).toBeNull();
  });

  it('renders a non-interactive real renderer for saved diagrams (not DSL text)', () => {
    render(<HomeView {...makeProps()} />);
    const card = screen.getByTestId('home-card-a');
    const frame = card.querySelector('iframe')!;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('tabindex')).toBe('-1');
    expect(frame.getAttribute('srcdoc')).toContain('mounting-point');
    expect(card).not.toHaveTextContent('A->B');
  });

  it('Fork runs the fork action without opening the diagram', async () => {
    const onOpen = vi.fn();
    const onForkItem = vi.fn();
    render(<HomeView {...makeProps({ onOpen, onForkItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fork Checkout flow' }));
    expect(onForkItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /options/i })).toBeNull();
    expect(screen.queryByText(/Export as HTML/)).toBeNull();
  });
});

describe('delete confirmation', () => {
  it('shows the selected title, focuses Cancel, and Cancel does not delete or open', async () => {
    const onDeleteItem = vi.fn(() => Promise.resolve());
    const onOpen = vi.fn();
    render(<HomeView {...makeProps({ onDeleteItem, onOpen })} />);
    const trash = screen.getByRole('button', { name: 'Delete Payment retry' });
    await userEvent.click(trash);
    const dialog = await screen.findByRole('dialog', { name: 'Delete this diagram?' });
    expect(within(dialog).getByTestId('home-delete-name')).toHaveTextContent('Payment retry');
    expect(dialog).toHaveTextContent('This action cannot be undone.');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDeleteItem).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(trash).toHaveFocus());
  });

  it('Escape cancels without deleting', async () => {
    const onDeleteItem = vi.fn(() => Promise.resolve());
    render(<HomeView {...makeProps({ onDeleteItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Checkout flow' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDeleteItem).not.toHaveBeenCalled();
  });

  it('deletes only after Delete, blocks double submission while pending, then closes', async () => {
    const pending = deferred();
    const onDeleteItem = vi.fn(() => pending.promise);
    render(<HomeView {...makeProps({ onDeleteItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Checkout flow' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByTestId('home-delete-confirm');
    await userEvent.click(confirm);
    expect(confirm).toHaveTextContent('Deleting…');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(confirm);
    await userEvent.keyboard('{Escape}');
    expect(onDeleteItem).toHaveBeenCalledTimes(1);
    expect(onDeleteItem).toHaveBeenCalledWith('a');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { pending.resolve(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog and diagram after a failure and allows retry', async () => {
    const onDeleteItem = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      .mockImplementationOnce(() => Promise.resolve());
    render(<HomeView {...makeProps({ onDeleteItem })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Checkout flow' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByTestId('home-delete-confirm'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not delete this diagram');
    expect(within(dialog).getByTestId('home-delete-confirm')).toHaveTextContent('Delete');
    expect(screen.getByTestId('home-card-a')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByTestId('home-delete-confirm'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDeleteItem).toHaveBeenCalledTimes(2);
  });
});

describe('empty library', () => {
  it('keeps the existing first-run actions', async () => {
    const onNewDiagram = vi.fn();
    const onBrowseTemplates = vi.fn();
    render(<HomeView {...makeProps({ items: [], onNewDiagram, onBrowseTemplates })} />);
    expect(screen.getByTestId('home-empty')).toHaveTextContent('No diagrams yet');
    await userEvent.click(screen.getByTestId('home-empty-new'));
    await userEvent.click(screen.getByTestId('home-empty-templates'));
    expect(onNewDiagram).toHaveBeenCalledTimes(1);
    expect(onBrowseTemplates).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('home-grid')).toBeNull();
  });
});
