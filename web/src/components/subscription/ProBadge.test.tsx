import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProBadge } from './ProBadge';

describe('ProBadge', () => {
  it('renders a badge for a paid plan (basic)', () => {
    render(<ProBadge planType="basic-monthly" />);
    const badge = screen.getByTestId('pro-badge');
    expect(badge.textContent).toBe('BASIC');
  });

  it('renders the Plus tier label', () => {
    render(<ProBadge planType="plus-yearly" />);
    expect(screen.getByTestId('pro-badge').textContent).toBe('PLUS');
  });

  it('renders the Enterprise tier label', () => {
    render(<ProBadge planType="enterprise" />);
    expect(screen.getByTestId('pro-badge').textContent).toBe('ENTERPRISE');
  });

  it('renders NOTHING for the free plan', () => {
    render(<ProBadge planType="free" />);
    expect(screen.queryByTestId('pro-badge')).toBeNull();
  });

  it('uses the signal-amber accent (font-mono badge)', () => {
    render(<ProBadge planType="plus-monthly" />);
    const badge = screen.getByTestId('pro-badge');
    expect(badge.className).toContain('font-mono');
    expect(badge.className).toContain('signal-amber');
  });
});
