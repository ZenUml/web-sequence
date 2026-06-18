import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RendererHeader } from './RendererHeader';

function setup(overrides: Partial<React.ComponentProps<typeof RendererHeader>> = {}) {
  const onPresent = vi.fn();
  const onFit = vi.fn();
  const props = {
    pageTabs: <div data-testid="tabs-slot">tabs</div>,
    onPresent,
    ...overrides,
  };
  render(<RendererHeader {...props} />);
  return { onPresent, onFit, props };
}

describe('RendererHeader', () => {
  it('renders the pageTabs slot content', () => {
    setup();
    expect(screen.getByTestId('tabs-slot')).toHaveTextContent('tabs');
  });

  it('defaults the zoom label to 100%', () => {
    setup();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('respects an explicit zoomLabel', () => {
    setup({ zoomLabel: '75%' });
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });

  it('calls onPresent when the Present control is clicked', () => {
    const { onPresent } = setup();
    fireEvent.click(screen.getByTestId('renderer-present'));
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible name on the Present control', () => {
    setup();
    expect(screen.getByTestId('renderer-present')).toHaveAttribute('aria-label', 'Present');
  });

  it('does not render the Fit control when onFit is omitted', () => {
    setup();
    expect(screen.queryByTestId('renderer-fit')).not.toBeInTheDocument();
  });

  // #824: the manual Refresh control follows the same "render only when wired" rule as
  // Fit, so the default UI (auto-preview ON ⇒ no onRefresh) shows no extra control.
  it('does not render the Refresh control when onRefresh is omitted', () => {
    setup();
    expect(screen.queryByTestId('renderer-refresh')).not.toBeInTheDocument();
  });

  it('renders the Refresh control and calls onRefresh when a handler is provided', () => {
    const onRefresh = vi.fn();
    setup({ onRefresh });
    const refresh = screen.getByTestId('renderer-refresh');
    expect(refresh).toHaveAttribute('aria-label', 'Refresh preview');
    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders the Fit control and calls onFit when a handler is provided', () => {
    const onFit = vi.fn();
    setup({ onFit });
    const fit = screen.getByTestId('renderer-fit');
    expect(fit).toHaveAttribute('aria-label', 'Fit to screen');
    fireEvent.click(fit);
    expect(onFit).toHaveBeenCalledTimes(1);
  });
});
