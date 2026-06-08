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

    it('keeps BOTH panes mounted, showing the editor and hiding the preview by default', () => {
      // Both panes stay mounted on mobile (no remount of the PreviewFrame iframe / no
      // dead Present control); the inactive pane is hidden via the `hidden` class.
      render(<Layout editor={editor} preview={preview} />);
      const editorRegion = screen.getByTestId('editor-region');
      const previewRegion = screen.getByTestId('preview-region');
      expect(editorRegion).toBeInTheDocument();
      expect(previewRegion).toBeInTheDocument();
      expect(screen.getByTestId('editor-child')).toBeInTheDocument();
      expect(screen.getByTestId('preview-child')).toBeInTheDocument();
      // classList.contains = exact token match (className.includes would false-match the
      // 'hidden' substring inside 'overflow-hidden').
      expect(editorRegion.classList.contains('hidden')).toBe(false);
      expect(previewRegion.classList.contains('hidden')).toBe(true);
    });

    it('selecting Preview shows the preview pane, hides the editor, updates aria-pressed (no remount)', async () => {
      render(<Layout editor={editor} preview={preview} />);
      await userEvent.click(screen.getByTestId('layout-tab-preview'));

      const editorRegion = screen.getByTestId('editor-region');
      const previewRegion = screen.getByTestId('preview-region');
      // Both still mounted — only visibility flips.
      expect(previewRegion).toBeInTheDocument();
      expect(editorRegion).toBeInTheDocument();
      expect(previewRegion.classList.contains('hidden')).toBe(false);
      expect(editorRegion.classList.contains('hidden')).toBe(true);

      expect(screen.getByTestId('layout-tab-preview')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('layout-tab-edit')).toHaveAttribute('aria-pressed', 'false');
    });

    it('groups the tabs with an accessible role/name', () => {
      render(<Layout editor={editor} preview={preview} />);
      expect(screen.getByRole('group', { name: 'Editor or preview' })).toBeInTheDocument();
    });
  });
});
