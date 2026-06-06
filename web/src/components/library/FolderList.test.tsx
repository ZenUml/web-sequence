import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderList } from './FolderList';
import type { Folder } from '../../domain/types';

// Pointer capture / scroll stubs for Radix Dialog (ConfirmDialog renders in a portal).
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

const counts: Record<string, number> = {
  all: 9,
  unfiled: 4,
  'folder-a': 3,
  'folder-b': 2,
};

const baseProps = {
  folders,
  activeFolderId: null as string | null | 'unfiled',
  counts,
  onSelectFolder: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
};

describe('FolderList', () => {
  it('renders All, Unfiled and each folder with their counts', () => {
    render(<FolderList {...baseProps} />);
    expect(screen.getByTestId('folder-all')).toBeInTheDocument();
    expect(screen.getByTestId('folder-unfiled')).toBeInTheDocument();
    expect(screen.getByTestId('folder-folder-a')).toBeInTheDocument();
    expect(screen.getByTestId('folder-folder-b')).toBeInTheDocument();

    expect(screen.getByTestId('folder-all')).toHaveTextContent('9');
    expect(screen.getByTestId('folder-unfiled')).toHaveTextContent('4');
    expect(screen.getByTestId('folder-folder-a')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('folder-folder-a')).toHaveTextContent('3');
    expect(screen.getByTestId('folder-folder-b')).toHaveTextContent('2');
  });

  it('selecting All calls onSelectFolder(null)', async () => {
    const onSelectFolder = vi.fn();
    render(<FolderList {...baseProps} onSelectFolder={onSelectFolder} />);
    await userEvent.click(screen.getByTestId('folder-all'));
    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });

  it('selecting Unfiled calls onSelectFolder("unfiled")', async () => {
    const onSelectFolder = vi.fn();
    render(<FolderList {...baseProps} onSelectFolder={onSelectFolder} />);
    await userEvent.click(screen.getByTestId('folder-unfiled'));
    expect(onSelectFolder).toHaveBeenCalledWith('unfiled');
  });

  it('selecting a folder calls onSelectFolder(id)', async () => {
    const onSelectFolder = vi.fn();
    render(<FolderList {...baseProps} onSelectFolder={onSelectFolder} />);
    await userEvent.click(screen.getByTestId('folder-folder-a'));
    expect(onSelectFolder).toHaveBeenCalledWith('folder-a');
  });

  it('new-folder flow: Enter commits onCreate(name)', async () => {
    const onCreate = vi.fn();
    render(<FolderList {...baseProps} onCreate={onCreate} />);
    await userEvent.click(screen.getByTestId('folder-new'));
    const input = screen.getByTestId('folder-new-input');
    await userEvent.type(input, 'Gamma{Enter}');
    expect(onCreate).toHaveBeenCalledWith('Gamma');
  });

  it('new-folder flow: empty name is ignored', async () => {
    const onCreate = vi.fn();
    render(<FolderList {...baseProps} onCreate={onCreate} />);
    await userEvent.click(screen.getByTestId('folder-new'));
    const input = screen.getByTestId('folder-new-input');
    await userEvent.type(input, '   {Enter}');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rename: double-click then Enter commits onRename(id, name)', async () => {
    const onRename = vi.fn();
    render(<FolderList {...baseProps} onRename={onRename} />);
    await userEvent.dblClick(screen.getByText('Alpha'));
    const input = screen.getByTestId('folder-rename-folder-a');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('folder-a', 'Renamed');
  });

  it('rename: blur commits onRename (positive control for cancelledRef)', async () => {
    const onRename = vi.fn();
    render(<FolderList {...baseProps} onRename={onRename} />);
    await userEvent.dblClick(screen.getByText('Alpha'));
    const input = screen.getByTestId('folder-rename-folder-a');
    await userEvent.clear(input);
    await userEvent.type(input, 'BlurName');
    await userEvent.tab();
    expect(onRename).toHaveBeenCalledWith('folder-a', 'BlurName');
  });

  it('rename: Escape cancels without commit and exits edit mode', async () => {
    const onRename = vi.fn();
    render(<FolderList {...baseProps} onRename={onRename} />);
    await userEvent.dblClick(screen.getByText('Alpha'));
    const input = screen.getByTestId('folder-rename-folder-a');
    await userEvent.clear(input);
    await userEvent.type(input, 'ShouldNotCommit{Escape}');
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('folder-rename-folder-a')).not.toBeInTheDocument();
  });

  it('delete: clicking delete then confirm calls onDelete(id)', async () => {
    const onDelete = vi.fn();
    render(<FolderList {...baseProps} onDelete={onDelete} />);
    await userEvent.click(screen.getByTestId('folder-delete-folder-a'));
    const confirm = await screen.findByTestId('confirm-ok');
    await userEvent.click(confirm);
    expect(onDelete).toHaveBeenCalledWith('folder-a');
  });

  it('delete: Enter/Space on the focused Delete button must NOT select the folder (adversarial review)', () => {
    // The folder row is role="button" with an onKeyDown that preventDefault()s
    // Enter/Space and calls onSelectFolder. The nested Delete IconButton stops onClick
    // but, without an onKeyDown stopPropagation, a keyboard activation bubbles to the
    // row → the row swallows the button's own activation and selects the folder instead
    // of opening the delete confirm. Discriminating signal: a keydown on the Delete
    // button must not reach onSelectFolder. Revert the onKeyDown handler → it does → fails.
    // (jsdom does not synthesize a click from keydown, so we assert the row handler
    // is NOT invoked rather than that the confirm opens.)
    const onSelectFolder = vi.fn();
    render(<FolderList {...baseProps} onSelectFolder={onSelectFolder} />);
    const del = screen.getByTestId('folder-delete-folder-a');
    fireEvent.keyDown(del, { key: 'Enter' });
    fireEvent.keyDown(del, { key: ' ' });
    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  it('readOnly hides New/rename/delete controls but selection still works', async () => {
    const onSelectFolder = vi.fn();
    render(<FolderList {...baseProps} readOnly onSelectFolder={onSelectFolder} />);
    expect(screen.queryByTestId('folder-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('folder-delete-folder-a')).not.toBeInTheDocument();

    // double-click should not open a rename input in readOnly mode
    await userEvent.dblClick(screen.getByText('Alpha'));
    expect(screen.queryByTestId('folder-rename-folder-a')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('folder-folder-a'));
    expect(onSelectFolder).toHaveBeenCalledWith('folder-a');
  });
});
