import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CssPanel } from './CssPanel';

const headerControls = <button data-testid="hc">mode</button>;

describe('CssPanel', () => {
  it('defaults to collapsed when CSS is empty, showing the strip + hint', () => {
    render(
      <CssPanel isEmpty headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    const strip = screen.getByTestId('css-panel-strip');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveTextContent('Custom CSS');
    expect(strip).toHaveTextContent('empty · click to expand');
    // Collapsed: neither the header controls nor the editor are mounted.
    expect(screen.queryByTestId('hc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
  });

  it('defaults to expanded when CSS is non-empty, showing controls + children', () => {
    render(
      <CssPanel isEmpty={false} headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    expect(screen.getByTestId('css-panel-expanded')).toBeInTheDocument();
    expect(screen.getByTestId('hc')).toBeInTheDocument();
    expect(screen.getByTestId('editor')).toBeInTheDocument();
    expect(screen.queryByTestId('css-panel-strip')).not.toBeInTheDocument();
  });

  it('clicking the collapsed strip expands it (uncontrolled) and fires onToggle(true)', async () => {
    const onToggle = vi.fn();
    render(
      <CssPanel isEmpty onToggle={onToggle} headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    await userEvent.click(screen.getByTestId('css-panel-strip'));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('css-panel-expanded')).toBeInTheDocument();
    expect(screen.getByTestId('editor')).toBeInTheDocument();
  });

  it('clicking the expanded header collapse control fires onToggle(false) and collapses (uncontrolled)', async () => {
    const onToggle = vi.fn();
    render(
      <CssPanel isEmpty={false} onToggle={onToggle} headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    await userEvent.click(screen.getByTestId('css-panel-collapse'));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('css-panel-strip')).toBeInTheDocument();
  });

  it('is controlled when `collapsed` prop is passed: internal clicks do not change render', async () => {
    const onToggle = vi.fn();
    render(
      <CssPanel isEmpty collapsed onToggle={onToggle} headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    // Still collapsed despite isEmpty default — controlled value wins.
    expect(screen.getByTestId('css-panel-strip')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('css-panel-strip'));
    // Parent was notified, but the render stays collapsed until parent flips `collapsed`.
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('css-panel-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('css-panel-expanded')).not.toBeInTheDocument();
  });

  it('controlled collapsed=false renders expanded regardless of isEmpty', () => {
    render(
      <CssPanel isEmpty collapsed={false} headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    expect(screen.getByTestId('css-panel-expanded')).toBeInTheDocument();
  });

  it('hides the "empty" hint on the strip when CSS is not empty but still collapsed (controlled)', () => {
    render(
      <CssPanel isEmpty={false} collapsed headerControls={headerControls}>
        <div data-testid="editor">editor</div>
      </CssPanel>,
    );
    const strip = screen.getByTestId('css-panel-strip');
    expect(strip).toHaveTextContent('Custom CSS');
    expect(strip).not.toHaveTextContent('empty · click to expand');
  });

  it('exposes accessible expand/collapse affordances via aria-expanded', () => {
    const { rerender } = render(
      <CssPanel isEmpty collapsed headerControls={headerControls}>
        <div>editor</div>
      </CssPanel>,
    );
    expect(screen.getByTestId('css-panel-strip')).toHaveAttribute('aria-expanded', 'false');
    rerender(
      <CssPanel isEmpty collapsed={false} headerControls={headerControls}>
        <div>editor</div>
      </CssPanel>,
    );
    expect(screen.getByTestId('css-panel-collapse')).toHaveAttribute('aria-expanded', 'true');
  });
});
