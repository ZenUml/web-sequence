import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Item } from '../../domain/types';
import { ItemListStub } from './ItemListStub';

// ConfirmDialog uses a Radix portal — it renders into document.body,
// not the container. Query via screen (document scope) after opening.

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Diagram',
    js: '',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    updatedOn: 1_700_000_000_000,
    ...overrides,
  };
}

describe('ItemListStub', () => {
  it('renders one row per item', () => {
    const items = [
      makeItem({ id: 'a', title: 'Alpha' }),
      makeItem({ id: 'b', title: 'Beta' }),
    ];
    render(<ItemListStub items={items} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('library-item-a')).toBeInTheDocument();
    expect(screen.getByTestId('library-item-b')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onOpen with the item when the row is clicked', async () => {
    const onOpen = vi.fn();
    const item = makeItem({ id: 'x', title: 'Open Me' });
    render(<ItemListStub items={[item]} onOpen={onOpen} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByTestId('library-item-x'));
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens ConfirmDialog on delete button click; confirm calls onDelete; row onOpen NOT fired', async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const item = makeItem({ id: 'del-1', title: 'To Delete' });
    render(<ItemListStub items={[item]} onOpen={onOpen} onDelete={onDelete} />);

    // Click the delete icon — stops propagation, so onOpen must not fire
    await userEvent.click(screen.getByTestId('library-delete-del-1'));
    expect(onOpen).not.toHaveBeenCalled();

    // ConfirmDialog renders in a portal; query document scope for the confirm button
    const confirmBtn = await screen.findByTestId('confirm-ok');
    expect(confirmBtn).toBeInTheDocument();

    // Confirm the deletion
    await userEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledWith('del-1');
    expect(onDelete).toHaveBeenCalledTimes(1);

    // Row click must still not have fired from the portal interaction
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows the empty-state headline when items is empty', () => {
    render(<ItemListStub items={[]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    expect(screen.getByText('No saved diagrams yet')).toBeInTheDocument();
  });

  it('omits the updatedOn metadata when absent', () => {
    const item = makeItem({ id: 'no-date', title: 'No Date', updatedOn: undefined });
    render(<ItemListStub items={[item]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    // Row still renders; no date string visible
    expect(screen.getByTestId('library-item-no-date')).toBeInTheDocument();
    // There should be no second text node inside the title area that looks like a date
    const row = screen.getByTestId('library-item-no-date');
    expect(within(row).queryByText(/\d{4}/)).toBeNull();
  });

  it('renders the delete button with the correct accessible label', () => {
    const item = makeItem({ id: 'a11y', title: 'A11y Test' });
    render(<ItemListStub items={[item]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    const btn = screen.getByTestId('library-delete-a11y');
    expect(btn).toHaveAttribute('aria-label', 'Delete diagram');
  });
});
