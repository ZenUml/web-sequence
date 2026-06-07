import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateNewModal } from './CreateNewModal';
import { TEMPLATES, blankTemplate } from '../../domain/templates';

// Radix Dialog renders in a portal — open the modal then query within document.
describe('CreateNewModal', () => {
  const setup = (over = {}) => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      onSelect: vi.fn(),
      ...over,
    };
    render(<CreateNewModal {...props} />);
    return props;
  };

  it('renders the blank option plus one card per template', () => {
    setup();
    expect(screen.getByTestId('create-blank')).toBeTruthy();
    for (const t of TEMPLATES) {
      expect(screen.getByTestId(`create-template-${t.id}`)).toBeTruthy();
    }
  });

  it('selecting blank calls onSelect with the empty starter, then closes', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('create-blank'));
    expect(p.onSelect).toHaveBeenCalledTimes(1);
    expect(p.onSelect).toHaveBeenCalledWith(blankTemplate());
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('selecting a template card calls onSelect with THAT template item (right card → right content)', () => {
    const p = setup();
    const basic = TEMPLATES.find((t) => t.id === 'basic')!;
    fireEvent.click(screen.getByTestId('create-template-basic'));
    expect(p.onSelect).toHaveBeenCalledTimes(1);
    // Discriminates wrong-card wiring: arg must carry basic's exact js.
    const arg = p.onSelect.mock.calls[0][0];
    expect(arg.js).toBe(basic.item.js);
    expect(arg).not.toHaveProperty('layoutMode');
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('each template card wires its own distinct content', () => {
    const p = setup();
    for (const t of TEMPLATES) {
      p.onSelect.mockClear();
      fireEvent.click(screen.getByTestId(`create-template-${t.id}`));
      expect(p.onSelect.mock.calls[0][0].js).toBe(t.item.js);
    }
  });
});
