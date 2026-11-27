import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmbedView } from './EmbedView';
import type { Item } from '../../domain/types';

vi.mock('../../preview/PreviewFrame', async () => {
  const { forwardRef } = await import('react');
  return {
    PreviewFrame: forwardRef(function PreviewFrame(props: { code: string; css: string }, _ref) {
      return <div data-testid="preview-frame-stub" data-code={props.code} data-css={props.css} />;
    }),
  };
});

const OPEN_URL = 'https://app.zenuml.com/?id=abc';
const item = { id: 'abc', title: 'Order flow', js: 'A->B: hi', css: '', html: '' } as Item;

describe('EmbedView', () => {
  it('renders the header and the preview when the item loaded', () => {
    render(<EmbedView item={item} openUrl={OPEN_URL} previewRef={{ current: null }} css=".x{}" stickyOffset={0} autoPreview theme="theme-default" />);
    expect(screen.getByTestId('embed-root')).toBeInTheDocument();
    expect(screen.getByTestId('embed-title')).toHaveTextContent('Order flow');
    expect(screen.getByTestId('preview-frame-stub')).toHaveAttribute('data-code', 'A->B: hi');
    expect(screen.getByTestId('preview-frame-stub')).toHaveAttribute('data-css', '.x{}');
    expect(screen.queryByTestId('embed-empty')).toBeNull();
  });

  it('renders the empty state linking to openUrl when the item is null', () => {
    render(<EmbedView item={null} openUrl={OPEN_URL} previewRef={{ current: null }} css="" stickyOffset={0} autoPreview theme="theme-default" fallbackTitle="From URL" />);
    expect(screen.getByTestId('embed-title')).toHaveTextContent('From URL');
    expect(screen.getByTestId('embed-empty')).toHaveTextContent('Diagram unavailable');
    expect(screen.getByTestId('embed-empty-link')).toHaveAttribute('href', OPEN_URL);
    expect(screen.queryByTestId('preview-frame-stub')).toBeNull();
  });
});
