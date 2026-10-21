import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavedOnDeviceModal, type SavedOnDeviceModalProps } from './SavedOnDeviceModal';

describe('SavedOnDeviceModal', () => {
  const setup = (over: Partial<SavedOnDeviceModalProps> = {}) => {
    const props: SavedOnDeviceModalProps = { open: true, onOpenChange: vi.fn(), onSignIn: vi.fn(), ...over };
    render(<SavedOnDeviceModal {...props} />);
    return props;
  };

  it('states that the diagram is saved in this browser and makes no cloud claim', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Saved on this device');
    expect(dialog).toHaveAccessibleDescription('Your diagram is saved in this browser.');
    expect(screen.getByText('Sign in to save and sync across devices.')).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/saved to (the )?cloud|saved to your account|synced/i);
  });

  it('Not now closes without signing in', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
    expect(p.onSignIn).not.toHaveBeenCalled();
  });

  it('Sign in closes this prompt, then asks the parent to open sign-in', async () => {
    const calls: string[] = [];
    setup({
      onOpenChange: (o) => calls.push(`open:${o}`),
      onSignIn: () => calls.push('signIn'),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(calls).toEqual(['open:false', 'signIn']);
  });

  it('Escape and the close button close it (acknowledge) without signing in', async () => {
    const p = setup();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByLabelText('Close'));
    expect(p.onOpenChange).toHaveBeenCalledTimes(2);
    expect(p.onOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(p.onSignIn).not.toHaveBeenCalled();
  });

  it('keeps ConfirmDialog test ids (drop-in for the existing AppRoot mount and E2E)', () => {
    setup();
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Not now');
    expect(screen.getByTestId('confirm-ok')).toHaveTextContent('Sign in');
  });

  it('does not reopen by itself after Not now (controlled by the parent)', async () => {
    function Parent() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <textarea aria-label="editor" />
          <SavedOnDeviceModal open={open} onOpenChange={setOpen} onSignIn={() => {}} />
        </>
      );
    }
    render(<Parent />);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Editing continues: the editor is focusable and no dialog returns.
    await userEvent.type(screen.getByLabelText('editor'), 'A->B: hi');
    expect(screen.getByLabelText('editor')).toHaveValue('A->B: hi');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
