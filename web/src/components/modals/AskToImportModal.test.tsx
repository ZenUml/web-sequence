import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskToImportModal, type AskToImportModalProps } from './AskToImportModal';

// Closing is driven by the controlled `open` prop (useImportOnLogin closes the
// prompt only after a successful save + flag write). The Import button must never
// route through the dismiss / "don't ask again" path.
describe('AskToImportModal', () => {
  const setup = (over: Partial<AskToImportModalProps> = {}) => {
    const props: AskToImportModalProps = {
      open: true,
      onOpenChange: vi.fn(),
      count: 3,
      onImport: vi.fn(),
      onDismiss: vi.fn(),
      ...over,
    };
    const utils = render(<AskToImportModal {...props} />);
    return { props, ...utils };
  };

  it('Import calls onImport and does NOT call onDismiss', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it("Don't ask again calls onDismiss and does NOT call onImport", () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('import-dismiss'));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    expect(props.onImport).not.toHaveBeenCalled();
  });

  it('plural copy for several diagrams', () => {
    setup({ count: 3 });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Import local diagrams?');
    expect(screen.getByTestId('import-lead')).toHaveTextContent('3 diagrams are saved in this browser.');
    expect(screen.getByText(/Add them to your account to access them on other devices\./)).toBeInTheDocument();
    expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 3 diagrams');
    expect(screen.getByTestId('import-dismiss')).toHaveTextContent("Don't ask again");
  });

  it('singular copy for one diagram', () => {
    setup({ count: 1 });
    expect(screen.getByTestId('import-lead')).toHaveTextContent('1 diagram is saved in this browser.');
    expect(screen.getByText(/Add it to your account to access it on other devices\./)).toBeInTheDocument();
    expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 1 diagram');
  });

  it('the dialog is described by the count sentence', () => {
    setup({ count: 2 });
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('2 diagrams are saved in this browser.');
  });

  it('Escape and the close button dismiss when idle', async () => {
    const { props } = setup();
    await userEvent.keyboard('{Escape}');
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText('Close'));
    expect(props.onDismiss).toHaveBeenCalledTimes(2);
  });

  describe('busy', () => {
    it('shows Importing…, disables both actions and the close button', () => {
      setup({ busy: true });
      const confirm = screen.getByTestId('import-confirm');
      expect(confirm).toHaveTextContent('Importing…');
      expect(confirm).toHaveAttribute('aria-busy', 'true');
      expect(confirm).toBeDisabled();
      expect(screen.getByTestId('import-dismiss')).toBeDisabled();
      expect(screen.getByLabelText('Close')).toBeDisabled();
    });

    it('Escape does not dismiss while busy', async () => {
      const { props } = setup({ busy: true });
      await userEvent.keyboard('{Escape}');
      expect(props.onDismiss).not.toHaveBeenCalled();
    });

    it('clicks do not submit or dismiss while busy', () => {
      const { props } = setup({ busy: true });
      fireEvent.click(screen.getByTestId('import-confirm'));
      fireEvent.click(screen.getByTestId('import-dismiss'));
      expect(props.onImport).not.toHaveBeenCalled();
      expect(props.onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('failure', () => {
    const msg = "Couldn't import your diagrams. They're still saved in this browser. Try again.";

    it('shows the error inline and turns Import into a retry', () => {
      const { props } = setup({ error: msg });
      expect(screen.getByTestId('import-error')).toHaveTextContent(msg);
      expect(screen.getByTestId('import-error')).toHaveAttribute('role', 'alert');
      const retry = screen.getByTestId('import-confirm');
      expect(retry).toHaveTextContent('Try again');
      fireEvent.click(retry);
      expect(props.onImport).toHaveBeenCalledTimes(1);
      expect(props.onDismiss).not.toHaveBeenCalled();
    });

    it("Don't ask again stays available after a failure", () => {
      const { props } = setup({ error: msg });
      fireEvent.click(screen.getByTestId('import-dismiss'));
      expect(props.onDismiss).toHaveBeenCalledTimes(1);
    });

    it('no error notice by default', () => {
      setup();
      expect(screen.queryByTestId('import-error')).toBeNull();
    });
  });

  describe('check failure (count unknown)', () => {
    const msg = "Couldn't check for diagrams saved in this browser. Your local diagrams were not changed. Try again.";

    it('shows the failure as the dialog description and makes no count claim', () => {
      setup({ count: 0, checkError: msg, onRetryCheck: vi.fn() });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleDescription(msg);
      expect(screen.getByTestId('import-check-error')).toHaveAttribute('role', 'alert');
      expect(dialog.textContent).not.toMatch(/\d+ diagrams? (is|are) saved/);
      expect(dialog.textContent).not.toMatch(/Import \d/);
    });

    it('Try again re-runs the check, never the import', () => {
      const onRetryCheck = vi.fn();
      const { props } = setup({ count: 0, checkError: msg, onRetryCheck });
      fireEvent.click(screen.getByTestId('import-confirm'));
      expect(onRetryCheck).toHaveBeenCalledTimes(1);
      expect(props.onImport).not.toHaveBeenCalled();
      expect(screen.getByTestId('import-confirm')).toHaveTextContent('Try again');
    });

    it("Don't ask again stays available and calls onDismiss", () => {
      const { props } = setup({ count: 0, checkError: msg, onRetryCheck: vi.fn() });
      fireEvent.click(screen.getByTestId('import-dismiss'));
      expect(props.onDismiss).toHaveBeenCalledTimes(1);
    });

    it('busy while re-checking: Checking…, actions disabled', () => {
      setup({ count: 0, checkError: msg, onRetryCheck: vi.fn(), busy: true });
      expect(screen.getByTestId('import-confirm')).toHaveTextContent('Checking…');
      expect(screen.getByTestId('import-confirm')).toBeDisabled();
      expect(screen.getByTestId('import-dismiss')).toBeDisabled();
    });
  });
});
