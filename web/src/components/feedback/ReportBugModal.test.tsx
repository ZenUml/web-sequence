import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportBugModal } from './ReportBugModal';

const props = {
  open: true,
  onOpenChange: () => {},
  appVersion: '2026.6.7',
  view: 'editor',
  signedIn: false,
};

describe('ReportBugModal', () => {
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

  it('hides the DSL toggle when there is no editor content', () => {
    render(<ReportBugModal {...props} dsl="" />);
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
