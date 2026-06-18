import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeView, type HomeViewProps } from './HomeView';
import { useLibraryStore } from '../../state/libraryStore';
import { TEMPLATES, blankTemplate } from '../../domain/templates';
import type { Item } from '../../domain/types';

// Minimal library item so the "Start something new" row renders (it is hidden when
// the library is empty). Shape mirrors what the grid needs (id/title/updatedOn/pages).
const SEED = [{ id: 'd1', title: 'Existing', updatedOn: 1, pages: [] } as unknown as Item];

function makeProps(over: Partial<HomeViewProps> = {}): HomeViewProps {
  return {
    items: SEED,
    folders: [],
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
    ...over,
  };
}

describe('HomeView template quick-picks', () => {
  beforeEach(() => {
    // Default store state shows the start block (empty query, no active folder).
    useLibraryStore.setState({ query: '', activeFolderId: null, sort: 'updated' });
  });

  it('clicking a template quick-pick creates it directly — does NOT reopen the picker', async () => {
    const onCreateFromTemplate = vi.fn();
    const onBrowseTemplates = vi.fn();
    render(<HomeView {...makeProps({ onCreateFromTemplate, onBrowseTemplates })} />);

    const basic = TEMPLATES.find((t) => t.id === 'basic')!;
    await userEvent.click(screen.getByTestId('home-template-basic'));

    // The defect: cards used to call onBrowseTemplates (reopening the CreateNewModal
    // picker), forcing a second template selection. They must now create directly.
    expect(onCreateFromTemplate).toHaveBeenCalledTimes(1);
    expect(onCreateFromTemplate).toHaveBeenCalledWith(basic.item);
    expect(onBrowseTemplates).not.toHaveBeenCalled();
  });

  it('the Blank quick-pick creates a blank diagram directly', async () => {
    const onCreateFromTemplate = vi.fn();
    render(<HomeView {...makeProps({ onCreateFromTemplate })} />);

    await userEvent.click(screen.getByTestId('home-template-blank'));

    expect(onCreateFromTemplate).toHaveBeenCalledTimes(1);
    expect(onCreateFromTemplate).toHaveBeenCalledWith(blankTemplate());
  });
});
