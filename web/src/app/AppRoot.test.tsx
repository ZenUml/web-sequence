import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './AppRoot';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

describe('AppRoot', () => {
  it('renders editor and preview regions', () => {
    render(<AppRoot />);
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('preview-region')).toBeInTheDocument();
  });

  it('seeds the DSL editor and mounts the preview iframe', async () => {
    const { container } = render(<AppRoot />);
    expect(container.querySelector('[data-testid="dsl-editor"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="preview-iframe"]')).toBeTruthy();
  });

  it('renders js and css mode selects', () => {
    const { container } = render(<AppRoot />);
    expect(container.querySelector('[data-testid="js-mode-select"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="css-mode-select"]')).toBeTruthy();
  });

  it('renders the snippet toolbox', () => {
    const { container } = render(<AppRoot />);
    expect(container.querySelector('[data-testid="snippet-participant"]')).toBeTruthy();
  });

  it('renders the console panel', () => {
    const { container } = render(<AppRoot />);
    expect(container.querySelector('[data-testid="console"]')).toBeTruthy();
  });

  it('fullscreen button toggles the fullscreen ui state', async () => {
    const { getByTestId } = render(<AppRoot />);
    const { useUiStore } = await import('../state/uiStore');
    await userEvent.click(getByTestId('preview-fullscreen'));
    expect(useUiStore.getState().fullscreen).toBe(true);
  });
});
