import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RendererHeader } from './RendererHeader';

function zoomHandlers(label = '100%') {
  return {
    label,
    onFitWidth: vi.fn(),
    onFitHeight: vi.fn(),
    onFitDiagram: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomIn: vi.fn(),
    onActualSize: vi.fn(),
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof RendererHeader>> = {}) {
  const props = {
    pageTabs: <div data-testid="tabs-slot">tabs</div>,
    ...overrides,
  };
  render(<RendererHeader {...props} />);
  return { props };
}

describe('RendererHeader', () => {
  it('renders the pageTabs slot content', () => {
    setup();
    expect(screen.getByTestId('tabs-slot')).toHaveTextContent('tabs');
  });

  it('has no Present control (Present lives in the app header only)', () => {
    setup({ zoom: zoomHandlers() });
    expect(screen.queryByTestId('renderer-present')).toBeNull();
    expect(screen.queryByRole('button', { name: /present/i })).toBeNull();
  });

  it('renders no zoom controls or fixed zoom text when zoom is not wired', () => {
    setup();
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows the effective zoom label and wires every zoom control', () => {
    const zoom = zoomHandlers('75%');
    setup({ zoom });
    expect(screen.getByTestId('renderer-zoom-label')).toHaveTextContent('75%');
    fireEvent.click(screen.getByRole('button', { name: 'Fit to width' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit to height' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit diagram' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByTestId('renderer-zoom-label'));
    expect(zoom.onFitWidth).toHaveBeenCalledTimes(1);
    expect(zoom.onFitHeight).toHaveBeenCalledTimes(1);
    expect(zoom.onFitDiagram).toHaveBeenCalledTimes(1);
    expect(zoom.onZoomOut).toHaveBeenCalledTimes(1);
    expect(zoom.onZoomIn).toHaveBeenCalledTimes(1);
    expect(zoom.onActualSize).toHaveBeenCalledTimes(1);
  });

  it('orders fit width, fit height, fit diagram, then minus / zoom / plus', () => {
    setup({ zoom: zoomHandlers() });
    const names = Array.from(screen.getByRole('group', { name: 'Zoom' }).querySelectorAll('button')).map(
      (b) => b.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Fit to width', 'Fit to height', 'Fit diagram', 'Zoom out', 'Zoom 100%. Reset to 100%', 'Zoom in']);
  });

  it('renders Download only when a handler is provided', () => {
    const onDownload = vi.fn();
    setup({ onDownload });
    fireEvent.click(screen.getByTestId('renderer-download'));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('does NOT render a Refresh control when no onRefresh handler is provided (#824)', () => {
    setup();
    expect(screen.queryByTestId('renderer-refresh')).toBeNull();
  });

  it('renders a Refresh control and calls onRefresh when wired (#824)', () => {
    const onRefresh = vi.fn();
    setup({ onRefresh });
    fireEvent.click(screen.getByTestId('renderer-refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
