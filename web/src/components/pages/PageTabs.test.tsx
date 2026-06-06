import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageTabs } from './PageTabs';
import type { Page } from '../../domain/types';

// Radix Dialog (used by ConfirmDialog) needs pointer capture stubs in jsdom.
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

const pageA: Page = { id: 'p1', title: 'Page 1', js: '', css: '', isDefault: true };
const pageB: Page = { id: 'p2', title: 'Page 2', js: '', css: '' };
const pageC: Page = { id: 'p3', title: 'Page 3', js: '', css: '' };

const defaultProps = {
  pages: [pageA, pageB],
  currentPageId: 'p1',
  onSwitch: vi.fn(),
  onAdd: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks for each test
  Object.values(props).forEach((v) => {
    if (typeof v === 'function' && 'mockReset' in v) (v as ReturnType<typeof vi.fn>).mockReset();
  });
  render(<PageTabs {...props} />);
  return props;
}

describe('PageTabs', () => {
  it('renders one tab per page', () => {
    setup();
    expect(screen.getByTestId('page-tab-p1')).toBeInTheDocument();
    expect(screen.getByTestId('page-tab-p2')).toBeInTheDocument();
  });

  it('active tab has aria-selected=true; inactive tab has aria-selected=false', () => {
    setup({ currentPageId: 'p1' });
    expect(screen.getByTestId('page-tab-p1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('page-tab-p2')).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab calls onSwitch with its id', async () => {
    const onSwitch = vi.fn();
    render(<PageTabs {...defaultProps} onSwitch={onSwitch} />);
    await userEvent.click(screen.getByTestId('page-tab-p2'));
    expect(onSwitch).toHaveBeenCalledWith('p2');
  });

  it('page-add button calls onAdd', async () => {
    const onAdd = vi.fn();
    render(<PageTabs {...defaultProps} onAdd={onAdd} />);
    await userEvent.click(screen.getByTestId('page-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('first page (isDefault) has no delete button', () => {
    setup();
    expect(screen.queryByTestId('page-delete-p1')).not.toBeInTheDocument();
  });

  it('non-first page has a delete button', () => {
    setup();
    expect(screen.getByTestId('page-delete-p2')).toBeInTheDocument();
  });

  it('confirming delete calls onDelete with the page id', async () => {
    const onDelete = vi.fn();
    render(<PageTabs {...defaultProps} onDelete={onDelete} />);

    // Click the delete icon on page 2
    await userEvent.click(screen.getByTestId('page-delete-p2'));

    // Dialog should appear — use findBy since it renders in a portal
    const confirmBtn = await screen.findByTestId('confirm-ok');
    await userEvent.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledWith('p2');
  });

  it('cancelling the delete dialog does NOT call onDelete', async () => {
    const onDelete = vi.fn();
    render(<PageTabs {...defaultProps} onDelete={onDelete} />);

    await userEvent.click(screen.getByTestId('page-delete-p2'));
    const cancelBtn = await screen.findByTestId('confirm-cancel');
    await userEvent.click(cancelBtn);

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('double-clicking a tab enters rename mode and shows the text input', async () => {
    setup();
    await userEvent.dblClick(screen.getByTestId('page-tab-p1'));
    expect(screen.getByTestId('page-rename-p1')).toBeInTheDocument();
  });

  it('pressing Enter in rename input calls onRename with new value', async () => {
    const onRename = vi.fn();
    render(<PageTabs {...defaultProps} onRename={onRename} />);

    await userEvent.dblClick(screen.getByTestId('page-tab-p1'));
    const input = screen.getByTestId('page-rename-p1');

    await userEvent.clear(input);
    await userEvent.type(input, 'New Name{Enter}');

    expect(onRename).toHaveBeenCalledWith('p1', 'New Name');
    // Input should be gone after commit
    expect(screen.queryByTestId('page-rename-p1')).not.toBeInTheDocument();
  });

  it('pressing Escape in rename input cancels without calling onRename', async () => {
    const onRename = vi.fn();
    render(<PageTabs {...defaultProps} onRename={onRename} />);

    await userEvent.dblClick(screen.getByTestId('page-tab-p1'));
    const input = screen.getByTestId('page-rename-p1');

    await userEvent.type(input, 'Ignored{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('page-rename-p1')).not.toBeInTheDocument();
  });

  it('blurring rename input commits the rename', async () => {
    const onRename = vi.fn();
    render(<PageTabs {...defaultProps} onRename={onRename} />);

    await userEvent.dblClick(screen.getByTestId('page-tab-p1'));
    const input = screen.getByTestId('page-rename-p1');
    await userEvent.clear(input);
    await userEvent.type(input, 'Blurred');
    fireEvent.blur(input);

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('p1', 'Blurred'));
  });

  it('readOnly hides add button, delete buttons, and prevents rename on double-click', async () => {
    render(<PageTabs {...defaultProps} readOnly />);
    expect(screen.queryByTestId('page-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-delete-p2')).not.toBeInTheDocument();

    // Double-click should NOT enter rename mode when readOnly
    await userEvent.dblClick(screen.getByTestId('page-tab-p1'));
    expect(screen.queryByTestId('page-rename-p1')).not.toBeInTheDocument();
  });

  it('renders three tabs when given three pages', () => {
    render(<PageTabs {...defaultProps} pages={[pageA, pageB, pageC]} currentPageId="p1" />);
    expect(screen.getByTestId('page-tab-p1')).toBeInTheDocument();
    expect(screen.getByTestId('page-tab-p2')).toBeInTheDocument();
    expect(screen.getByTestId('page-tab-p3')).toBeInTheDocument();
    // Only p1 has isDefault; both p2 and p3 should have delete buttons
    expect(screen.queryByTestId('page-delete-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-delete-p2')).toBeInTheDocument();
    expect(screen.getByTestId('page-delete-p3')).toBeInTheDocument();
  });
});
