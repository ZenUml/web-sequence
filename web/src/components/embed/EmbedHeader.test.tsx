import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmbedHeader } from './EmbedHeader';

const OPEN_URL = 'https://app.zenuml.com/?id=abc123';

describe('EmbedHeader (REQ-EMB-1)', () => {
  it('renders the given title', () => {
    render(<EmbedHeader title="Order Flow" openUrl={OPEN_URL} />);
    expect(screen.getByTestId('embed-title')).toHaveTextContent('Order Flow');
  });

  it('falls back to a default title when omitted or blank', () => {
    const { rerender } = render(<EmbedHeader openUrl={OPEN_URL} />);
    expect(screen.getByTestId('embed-title')).toHaveTextContent('ZenUML Diagram');

    rerender(<EmbedHeader title="   " openUrl={OPEN_URL} />);
    expect(screen.getByTestId('embed-title')).toHaveTextContent('ZenUML Diagram');
  });

  it('open-link points at the given openUrl and opens safely in a new tab', () => {
    render(<EmbedHeader title="Demo" openUrl={OPEN_URL} />);
    const link = screen.getByTestId('embed-open-link');
    expect(link).toHaveAttribute('href', OPEN_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('carries the embed testids and NO app-chrome save/auth/library controls', () => {
    render(<EmbedHeader title="Demo" openUrl={OPEN_URL} />);
    expect(screen.getByTestId('embed-header')).toBeInTheDocument();
    expect(screen.getByTestId('embed-title')).toBeInTheDocument();
    expect(screen.getByTestId('embed-open-link')).toBeInTheDocument();
    // Embed strips all save/auth/library chrome (REQ-EMB-1).
    expect(screen.queryByTestId('header-save')).toBeNull();
    expect(screen.queryByTestId('header-login')).toBeNull();
    expect(screen.queryByTestId(/^sidebar-/)).toBeNull();
  });
});
