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

  it('open-link reads as an accent CTA, not muted text (#12)', () => {
    render(<EmbedHeader title="Demo" openUrl={OPEN_URL} />);
    const link = screen.getByTestId('embed-open-link');
    // Labeled as a clear action.
    expect(link).toHaveTextContent('Edit in ZenUML');
    // Styled as the cobalt accent button with white text on a rounded, focus-ringed
    // control. The RESTING fill is `accent-press` (#1E50D8, ~6.6:1 on white), not
    // `accent` (4.5:1 floor) — a comfortable contrast margin for the embed's only
    // CTA (#12 fix).
    expect(link).toHaveClass('bg-accent-press', 'text-white', 'rounded', 'ring-draft');
    // NOT the WCAG-AA-floor accent fill, and NOT the old muted ghost treatment.
    expect(link).not.toHaveClass('bg-accent');
    expect(link).not.toHaveClass('text-accent');
  });

  it('title uses the UI grotesque (font-sans), not the serif display face (#11)', () => {
    render(<EmbedHeader title="Order Flow" openUrl={OPEN_URL} />);
    const title = screen.getByTestId('embed-title');
    // Instrument Serif (font-serif) is reserved for large editorial moments; the
    // dense 14px chrome-bar title uses Hanken Grotesk (font-sans).
    expect(title).toHaveClass('font-sans');
    expect(title).not.toHaveClass('font-serif');
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
