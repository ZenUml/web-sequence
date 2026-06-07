import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

// Every binding VERBATIM from requirements §11. The test asserts ALL rows so a
// dropped or altered binding fails (honest coverage given REQ-KB-1: "lists all").
const EXPECTED: Array<[string, string]> = [
  // Global
  ['Save', 'Ctrl/Cmd+S'],
  ['Manual preview refresh', 'Ctrl/Cmd+Shift+5'],
  ['Open library', 'Ctrl/Cmd+O'],
  ['Search/quick-open library', 'Ctrl/Cmd+K'],
  ['Keyboard-shortcuts help', 'Ctrl/Cmd+Shift+?'],
  ['Clear console', 'Ctrl+L'],
  ['Close overlays/modals/library', 'Esc'],
  // Editor
  ['Find', 'Ctrl/Cmd+F'],
  ['Find next', 'Ctrl/Cmd+G'],
  ['Find prev', 'Ctrl/Cmd+Shift+G'],
  ['Find & replace', 'Ctrl/Cmd+Alt/Opt+F'],
  ['Toggle comment', 'Ctrl/Cmd+/'],
  ['Indent right/left', 'Ctrl/Cmd+] / Ctrl/Cmd+['],
  ['Re-indent', 'Shift+Tab'],
  ['Autocomplete', 'Ctrl/Cmd+Space'],
  ['Prettier format', 'Ctrl+Shift+F'],
];

describe('KeyboardShortcutsModal', () => {
  it('does not render content when closed', () => {
    render(<KeyboardShortcutsModal open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId('shortcuts-modal')).toBeNull();
  });

  it('renders Global and Editor sections when open', () => {
    render(<KeyboardShortcutsModal open onOpenChange={() => {}} />);
    const root = screen.getByTestId('shortcuts-modal');
    expect(within(root).getByText('Global')).toBeTruthy();
    expect(within(root).getByText('Editor')).toBeTruthy();
  });

  it('lists every §11 binding verbatim, each action paired with its keys', () => {
    render(<KeyboardShortcutsModal open onOpenChange={() => {}} />);
    const root = screen.getByTestId('shortcuts-modal');
    const rows = Array.from(root.querySelectorAll('tr'));

    for (const [action, keys] of EXPECTED) {
      const row = rows.find((r) => r.querySelector('td')?.textContent === action);
      expect(row, `missing row for "${action}"`).toBeTruthy();
      const cells = row!.querySelectorAll('td');
      expect(cells[1]?.textContent).toBe(keys);
    }
  });

  it('shows the Emmet binding with its CSS-editor qualifier', () => {
    render(<KeyboardShortcutsModal open onOpenChange={() => {}} />);
    const root = screen.getByTestId('shortcuts-modal');
    const rows = Array.from(root.querySelectorAll('tr'));
    const emmet = rows.find((r) =>
      r.querySelector('td')?.textContent?.startsWith('Emmet'),
    );
    expect(emmet, 'missing Emmet row').toBeTruthy();
    expect(emmet!.querySelectorAll('td')[1]?.textContent).toBe('Tab');
  });
});
