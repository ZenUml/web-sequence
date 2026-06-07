import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpModal } from './HelpModal';

describe('HelpModal', () => {
  it('does not render content when closed', () => {
    render(<HelpModal open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId('help-modal')).toBeNull();
  });

  it('renders title and the three help links when open', () => {
    render(<HelpModal open onOpenChange={() => {}} />);
    expect(screen.getByTestId('help-modal')).toBeTruthy();
    expect(screen.getByText('ZenUML Sequence')).toBeTruthy();

    const docs = screen.getByRole('link', { name: /documentation/i });
    expect(docs.getAttribute('href')).toBe('https://www.zenuml.com/help.html');
    const contact = screen.getByRole('link', { name: /contact/i });
    expect(contact.getAttribute('href')).toBe(
      'https://zenuml.com/docs/about/contact-us',
    );
    const github = screen.getByRole('link', { name: /github/i });
    expect(github.getAttribute('href')).toBe(
      'https://github.com/ZenUml/web-sequence',
    );
  });

  it('shows the version when supplied, omits it otherwise', () => {
    const { rerender } = render(
      <HelpModal open onOpenChange={() => {}} version="3.49.2" />,
    );
    expect(screen.getByTestId('help-version').textContent).toContain('3.49.2');

    rerender(<HelpModal open onOpenChange={() => {}} />);
    expect(screen.queryByTestId('help-version')).toBeNull();
  });
});
