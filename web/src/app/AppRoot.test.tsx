import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
