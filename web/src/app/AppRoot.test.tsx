import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppRoot } from './AppRoot';

describe('AppRoot', () => {
  it('renders editor and preview regions', () => {
    render(<AppRoot />);
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('preview-region')).toBeInTheDocument();
  });
});
