import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { useSettingsStore } from '../../state/settingsStore';
import { ReportBugModal } from './ReportBugModal';

const props = {
  open: true,
  onOpenChange: () => {},
  appVersion: '2026.6.7',
  view: 'editor',
  signedIn: false,
};

describe('ReportBugModal', () => {
  afterEach(() => useSettingsStore.setState((s) => ({ settings: { ...s.settings, appearance: 'light' } })));

  it('labels the description visibly and rejects whitespace without opening an issue', () => {
    const openUrl = vi.fn();
    render(<ReportBugModal {...props} openUrl={openUrl} />);
    const description = screen.getByLabelText('What happened?');
    fireEvent.change(description, { target: { value: '  \n  ' } });
    fireEvent.click(screen.getByTestId('report-bug-submit'));
    expect(screen.getByTestId('report-bug-submit')).toBeDisabled();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('excludes diagram code from the actual issue URL when switched off', async () => {
    const openUrl = vi.fn();
    render(<ReportBugModal {...props} dsl="A -> B: PrivateCodeSentinel" openUrl={openUrl} />);
    await userEvent.type(screen.getByTestId('report-bug-description'), 'Unexpected layout');
    await userEvent.click(screen.getByTestId('report-bug-include-dsl'));
    expect(screen.getByTestId('report-bug-summary')).toHaveTextContent('Diagram code excluded');
    await userEvent.click(screen.getByTestId('report-bug-submit'));
    const body = new URL(openUrl.mock.calls[0][0]).searchParams.get('body');
    expect(body).toContain('Unexpected layout');
    expect(body).not.toContain('PrivateCodeSentinel');
    expect(body).not.toContain('Diagram DSL');
  });

  it.each(['light', 'dark'] as const)('uses explicit %s primitive surfaces', (appearance) => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, appearance } }));
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    for (const id of ['report-bug-description', 'report-bug-include-dsl', 'report-bug-submit']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-ui-surface', appearance);
    }
    expect(screen.getByRole('dialog')).toHaveClass('rb-dialog');
  });

  it('Cancel and Escape restore the opener; reopening clears the draft and resets inclusion', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Report opener</button><ReportBugModal {...props} open={open} onOpenChange={setOpen} dsl="A -> B: x" /></>;
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Report opener' });
    await userEvent.click(opener);
    await userEvent.type(screen.getByTestId('report-bug-description'), 'Discard this');
    await userEvent.click(screen.getByTestId('report-bug-include-dsl'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(opener).toHaveFocus());
    await userEvent.click(opener);
    expect(screen.getByTestId('report-bug-description')).toHaveValue('');
    expect(screen.getByTestId('report-bug-include-dsl')).toHaveAttribute('data-state', 'checked');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('does not render content when closed', () => {
    render(<ReportBugModal {...props} open={false} dsl="A -> B: x" />);
    expect(screen.queryByTestId('report-bug-modal')).toBeNull();
  });

  it('disables submit until a description is entered', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    expect(screen.getByTestId('report-bug-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('report-bug-description'), {
      target: { value: 'RenderGlitch' },
    });
    expect(screen.getByTestId('report-bug-submit')).not.toBeDisabled();
  });

  it('defaults the DSL toggle to ON when there is editor content', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    expect(screen.getByTestId('report-bug-include-dsl').getAttribute('data-state')).toBe('checked');
  });

  it.each(['', '   \n  '])('hides the DSL toggle when content is empty or whitespace (%j)', (dsl) => {
    render(<ReportBugModal {...props} dsl={dsl} />);
    expect(screen.queryByTestId('report-bug-include-dsl')).toBeNull();
  });

  it('opens a GitHub URL containing the description on submit', () => {
    const openUrl = vi.fn();
    render(<ReportBugModal {...props} dsl="A -> B: x" openUrl={openUrl} />);
    fireEvent.change(screen.getByTestId('report-bug-description'), {
      target: { value: 'RenderGlitch' },
    });
    fireEvent.click(screen.getByTestId('report-bug-submit'));
    expect(openUrl).toHaveBeenCalledTimes(1);
    const url = openUrl.mock.calls[0][0] as string;
    expect(url).toContain('github.com/ZenUml/web-sequence/issues/new');
    expect(url).toContain('RenderGlitch');
  });

  it('offers a contact-us fallback for users without GitHub', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    const link = screen.getByRole('link', { name: /contact us/i });
    expect(link.getAttribute('href')).toBe('https://zenuml.com/docs/about/contact-us');
  });
});
