import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the media-query hook so we can drive desktop vs mobile deterministically,
// rather than dispatching matchMedia events (jsdom has no matchMedia by default).
vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(),
}));

import { Layout } from './Layout';
import { useIsMobile } from '../hooks/useMediaQuery';

const mockedIsMobile = vi.mocked(useIsMobile);

const editor = <div data-testid="editor-child">EDITOR</div>;
const preview = <div data-testid="preview-child">PREVIEW</div>;

describe('Layout', () => {
  beforeEach(() => {
    mockedIsMobile.mockReset();
  });

  describe('desktop (≥ md)', () => {
    beforeEach(() => mockedIsMobile.mockReturnValue(false));

    it('renders both regions in a split (no segmented control)', () => {
      render(<Layout editor={editor} preview={preview} />);
      expect(screen.getByTestId('editor-region')).toBeInTheDocument();
      expect(screen.getByTestId('preview-region')).toBeInTheDocument();
      expect(screen.getByTestId('editor-child')).toBeInTheDocument();
      expect(screen.getByTestId('preview-child')).toBeInTheDocument();
      // No mobile tabs on desktop.
      expect(screen.queryByTestId('layout-tab-edit')).toBeNull();
      expect(screen.queryByTestId('layout-tab-preview')).toBeNull();
    });
  });

  describe('mobile (< md)', () => {
    beforeEach(() => mockedIsMobile.mockReturnValue(true));

    it('renders the segmented Edit | Preview control with aria-pressed', () => {
      render(<Layout editor={editor} preview={preview} />);
      const edit = screen.getByTestId('layout-tab-edit');
      const previewTab = screen.getByTestId('layout-tab-preview');
      expect(edit).toBeInTheDocument();
      expect(previewTab).toBeInTheDocument();
      // Default segment is 'edit'.
      expect(edit).toHaveAttribute('aria-pressed', 'true');
      expect(previewTab).toHaveAttribute('aria-pressed', 'false');
    });

    it('mounts only the editor pane by default (preview is not in the tree)', () => {
      render(<Layout editor={editor} preview={preview} />);
      expect(screen.getByTestId('editor-region')).toBeInTheDocument();
      expect(screen.getByTestId('editor-child')).toBeInTheDocument();
      expect(screen.queryByTestId('preview-region')).toBeNull();
      expect(screen.queryByTestId('preview-child')).toBeNull();
    });

    it('selecting Preview swaps to the preview pane and updates aria-pressed', async () => {
      render(<Layout editor={editor} preview={preview} />);
      await userEvent.click(screen.getByTestId('layout-tab-preview'));

      expect(screen.getByTestId('preview-region')).toBeInTheDocument();
      expect(screen.getByTestId('preview-child')).toBeInTheDocument();
      expect(screen.queryByTestId('editor-region')).toBeNull();
      expect(screen.queryByTestId('editor-child')).toBeNull();

      expect(screen.getByTestId('layout-tab-preview')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('layout-tab-edit')).toHaveAttribute('aria-pressed', 'false');
    });

    it('groups the tabs with an accessible role/name', () => {
      render(<Layout editor={editor} preview={preview} />);
      expect(screen.getByRole('group', { name: 'Editor or preview' })).toBeInTheDocument();
    });
  });
});
