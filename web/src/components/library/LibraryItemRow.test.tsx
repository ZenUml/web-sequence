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
    render(
      <LibraryItemRow item={item} folders={folders} {...baseHandlers()} />,
    );

    expect(screen.getByTestId('lib-row-item-1')).toBeInTheDocument();
    expect(screen.getByText('My Diagram')).toBeInTheDocument();
    // Meta line shows the current folder name when item.folderId matches a folder.
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
  });

  it('does not show a folder name in meta when item is unfiled', () => {
    const item = makeItem({ folderId: undefined });
    render(
      <LibraryItemRow item={item} folders={folders} {...baseHandlers()} />,
    );
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
    expect(
      await screen.findByTestId('lib-action-open-item-1'),
    ).toBeInTheDocument();
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
    await userEvent.click(
      await screen.findByTestId('lib-action-exporthtml-item-1'),
    );
    expect(h.onExportHtml).toHaveBeenCalledWith(item);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('moving to a folder calls onMove with the folder id and does NOT fire onOpen', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(
      await screen.findByTestId('lib-move-item-1-folder-b'),
    );
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
    await userEvent.click(
      await screen.findByTestId('lib-action-delete-item-1'),
    );

    // Confirm dialog appears (in portal).
    const confirm = await screen.findByTestId('confirm-ok');
    await userEvent.click(confirm);

    expect(h.onDelete).toHaveBeenCalledWith('item-1');
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('keyboard Enter on the kebab opens the menu and does NOT fire the row onOpen (advisor fix #4)', async () => {
    // Radix Trigger preventDefaults Enter/Space but does not stopPropagation, so
    // without the kebab's onKeyDown the keydown bubbles to the row → onOpen, which
    // unmounts the panel before the menu renders (menu unreachable by keyboard).
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    const kebab = screen.getByTestId('lib-row-menu-item-1');
    kebab.focus();
    await userEvent.keyboard('{Enter}');
    // Menu opened via keyboard...
    expect(
      await screen.findByTestId('lib-action-open-item-1'),
    ).toBeInTheDocument();
    // ...and the row's onOpen did NOT fire from the bubbled keydown.
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('keyboard-activating a menu item (Fork) does NOT bubble to the row onOpen (adversarial review)', async () => {
    // The portaled MenuContent is a React child of the role=button row, so a keydown
    // that Radix does not stopPropagation bubbles to the row's onKeyDown → onOpen.
    // Worst case is Fork: it loads+forks, then the bubbled keydown re-opens the
    // original, clobbering the fork. Keyboard-activate Fork and assert onOpen never
    // fires. Revert MenuContent's onKeyDown stopPropagation → this fails.
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    const kebab = screen.getByTestId('lib-row-menu-item-1');
    kebab.focus();
    await userEvent.keyboard('{Enter}');
    // Move focus from the first item (Open) to Fork, then activate via keyboard.
    await screen.findByTestId('lib-action-fork-item-1');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(h.onFork).toHaveBeenCalledWith(item);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('Delete action uses the danger token, not signal-amber (design system; advisor fix #5)', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    const del = await screen.findByTestId('lib-action-delete-item-1');
    expect(del.className).toContain('text-danger');
    expect(del.className).not.toContain('signal-amber');
  });

  it('Delete highlight wins deterministically: the danger item carries ONLY the danger highlight, not the base accent-tint (adversarial review)', async () => {
    // `cn` is bare clsx with NO tailwind-merge, so two `data-[highlighted]:bg-*` classes
    // would both survive and the winner would be decided by compiled-CSS source order —
    // the destructive Delete could render the same cobalt accent-tint as every neutral
    // item, losing its danger affordance. The tone="danger" variant must SWAP the base
    // highlight, not append: assert the delete item carries the danger highlight and NOT
    // `data-[highlighted]:bg-accent-tint`, while a neutral sibling (Fork) still does.
    // Revert tone="danger" back to an appended override className → both bg-* classes
    // present on the delete item → this test fails on the `.not.toContain` assertion.
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);
    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));

    const del = await screen.findByTestId('lib-action-delete-item-1');
    expect(del.className).toContain('data-[highlighted]:bg-danger/20');
    expect(del.className).not.toContain('data-[highlighted]:bg-accent-soft');

    // Positive control: a neutral action still uses the base accent-soft highlight (the
    // dark-menu base highlight), so the assertion above is about the conflict being
    // removed, not the class vanishing.
    const fork = await screen.findByTestId('lib-action-fork-item-1');
    expect(fork.className).toContain('data-[highlighted]:bg-accent-soft');
    expect(fork.className).not.toContain('data-[highlighted]:bg-danger/20');
  });

  it('delete then cancel does not call onDelete', async () => {
    const item = makeItem();
    const h = baseHandlers();
    render(<LibraryItemRow item={item} folders={folders} {...h} />);

    await userEvent.click(screen.getByTestId('lib-row-menu-item-1'));
    await userEvent.click(
      await screen.findByTestId('lib-action-delete-item-1'),
    );

    const cancel = await screen.findByTestId('confirm-cancel');
    await userEvent.click(cancel);

    expect(h.onDelete).not.toHaveBeenCalled();
    expect(h.onOpen).not.toHaveBeenCalled();
  });
});
