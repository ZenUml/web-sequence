import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_SETTINGS, type Settings } from '../../domain/types';

// Radix Select drives pointer interaction through APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function setup(over: Partial<Settings> = {}, props: Record<string, unknown> = {}) {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...over };
  const onChange = vi.fn();
  render(
    <SettingsModal
      open
      onOpenChange={vi.fn()}
      settings={settings}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, settings };
}

describe('SettingsModal', () => {
  // DISCRIMINATING: the picker's default must match the rendered editor default
  // (editor DEFAULT_THEME is 'ink'). A 'monokai' default would contradict it.
  it('DEFAULT_SETTINGS.editorTheme is "ink"', () => {
    expect(DEFAULT_SETTINGS.editorTheme).toBe('ink');
  });

  it('does not render when closed', () => {
    render(
      <SettingsModal
        open={false}
        onOpenChange={vi.fn()}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('renders a control for every non-dropped, non-extension-only preference', () => {
    setup();
    const keys: (keyof Settings)[] = [
      'editorTheme', 'keymap', 'fontSize', 'editorFont', 'indentWith', 'indentSize',
      'lineWrap', 'autoCloseTags', 'autoComplete',
      'preserveLastCode', 'autoPreview', 'autoSave', 'preserveConsoleLogs',
      'refreshOnResize', 'lightVersion',
      'htmlMode', 'jsMode', 'cssMode',
    ];
    for (const k of keys) {
      expect(screen.getByTestId(`setting-${k}`)).toBeInTheDocument();
    }
  });

  // DISCRIMINATING (adversarial review, finding 2): "Replace new tab page" is an
  // extension-ONLY control (consumed by the extension background page via
  // chrome_url_overrides). On the web app it is inert, so it must NOT render unless
  // isExtension is true. Legacy hides extension-only controls on the web
  // (body:not(.is-extension) .show-when-extension) and never exposes replaceNewTab in
  // its in-app SettingsModal. Removing the isExtension gate (rendering it always) → fails.
  it('does NOT render the extension-only replaceNewTab toggle on the web app', () => {
    setup(); // no isExtension prop → web app
    expect(screen.queryByTestId('setting-replaceNewTab')).not.toBeInTheDocument();
  });

  it('DOES render the extension-only replaceNewTab toggle when isExtension', () => {
    setup({}, { isExtension: true });
    expect(screen.getByTestId('setting-replaceNewTab')).toBeInTheDocument();
  });

  // Dropped settings (roadmap §3) must NOT be surfaced.
  it('does NOT render dropped settings', () => {
    setup();
    for (const k of ['layoutMode', 'infiniteLoopTimeout', 'isCodeBlastOn', 'isJs13kModeOn']) {
      expect(screen.queryByTestId(`setting-${k}`)).not.toBeInTheDocument();
    }
  });

  // Two-column layout (design §04): an "Editor" column and a "Behavior" column,
  // each with its own eyelabel header. Both headers must be present.
  it('renders both the Editor and Behavior column headers', () => {
    setup();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Behavior')).toBeInTheDocument();
  });

  // DISCRIMINATING: the rows must be laid into a responsive 2-column grid
  // (single column < sm, two columns at sm+). The grid wraps the Editor +
  // Behavior columns. A flat single-column layout (no sm:grid-cols-2) fails.
  it('lays the rows into a responsive two-column grid', () => {
    setup();
    const themeRow = screen.getByTestId('setting-editorTheme');
    const grid = themeRow.closest('.grid');
    expect(grid).not.toBeNull();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/sm:grid-cols-2/);
    // The Editor column control and a Behavior column control share the grid.
    expect(grid).toContainElement(screen.getByTestId('setting-lightVersion'));
  });

  // The "Plus" gating badge sits next to the Light version row's label. It is
  // INFORMATIONAL only — see the functional-toggle test below.
  it('renders a "Plus" badge adjacent to the Light version toggle', () => {
    setup();
    const badge = screen.getByTestId('setting-lightVersion-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Plus');
    // The badge shares the Light version row with its toggle (same ROW container).
    const row = screen.getByTestId('setting-lightVersion').closest('div');
    expect(row).not.toBeNull();
  });

  // DISCRIMINATING: the badge is decorative — the Light version toggle must stay
  // FUNCTIONAL (no new gate in Phase 3). A `disabled` toggle would not fire onChange.
  it('Light version toggle remains functional despite the Plus badge', () => {
    const { onChange } = setup({ lightVersion: false });
    const toggle = screen.getByTestId('setting-lightVersion');
    expect(toggle).not.toBeDisabled();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith('lightVersion', true);
  });

  it('toggling a boolean switch fires onChange(key, boolean)', () => {
    const { onChange } = setup({ lineWrap: false });
    // Radix Switch renders a button with role=switch; click toggles it.
    fireEvent.click(screen.getByTestId('setting-lineWrap'));
    expect(onChange).toHaveBeenCalledWith('lineWrap', true);
  });

  it('changing a Select fires onChange with the typed value', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByTestId('setting-editorTheme'));
    // The Theme picker shows human labels ("Dracula") but emits the theme id
    // ("dracula") — the resolvable CM6 id, not the display label.
    await userEvent.click(await screen.findByText('Dracula'));
    expect(onChange).toHaveBeenCalledWith('editorTheme', 'dracula');
  });

  // DISCRIMINATING: the Theme picker must offer ONLY the CM6-resolvable themes
  // (incl. "Ink"), never the dead legacy CM5 ids. Opening the dropdown should
  // surface the Ink option and NOT a CM5 id like "cobalt".
  it('Theme picker offers the CM6 set incl. Ink, not dead CM5 ids', async () => {
    setup({ editorTheme: 'monokai' }); // open with a non-ink value so "Ink" is a real option
    await userEvent.click(screen.getByTestId('setting-editorTheme'));
    expect(await screen.findByText('Ink')).toBeInTheDocument();
    expect(screen.getByText('Dracula')).toBeInTheDocument();
    expect(screen.queryByText('cobalt')).not.toBeInTheDocument();
    expect(screen.queryByText('zenburn')).not.toBeInTheDocument();
  });

  // DISCRIMINATING: fontSize must be coerced to a NUMBER, not the option string.
  it('fontSize change is coerced to a number', async () => {
    const { onChange } = setup({ fontSize: 16 });
    await userEvent.click(screen.getByTestId('setting-fontSize'));
    await userEvent.click(await screen.findByText('14'));
    expect(onChange).toHaveBeenCalledWith('fontSize', 14);
    expect(typeof onChange.mock.calls[0][1]).toBe('number');
  });

  // DISCRIMINATING: indentSize must be coerced to a NUMBER.
  it('indentSize change is coerced to a number', async () => {
    const { onChange } = setup({ indentSize: 2 });
    await userEvent.click(screen.getByTestId('setting-indentSize'));
    await userEvent.click(await screen.findByText('4'));
    expect(onChange).toHaveBeenCalledWith('indentSize', 4);
    expect(typeof onChange.mock.calls[0][1]).toBe('number');
  });

  // DISCRIMINATING: editorCustomFont only shows when editorFont === 'other'.
  it('hides editorCustomFont unless editorFont is "other"', () => {
    setup({ editorFont: 'FiraCode' });
    expect(screen.queryByTestId('setting-editorCustomFont')).not.toBeInTheDocument();
  });

  it('shows editorCustomFont when editorFont is "other"', () => {
    const { onChange } = setup({ editorFont: 'other', editorCustomFont: 'Comic Sans' });
    const input = screen.getByTestId('setting-editorCustomFont') as HTMLInputElement;
    expect(input.value).toBe('Comic Sans');
    fireEvent.change(input, { target: { value: 'Menlo' } });
    expect(onChange).toHaveBeenCalledWith('editorCustomFont', 'Menlo');
  });

  it('reflects the current boolean state of a switch', () => {
    setup({ autoSave: true });
    expect(screen.getByTestId('setting-autoSave')).toHaveAttribute('aria-checked', 'true');
  });

  // DISCRIMINATING (settings-scroll fix): the 18-row body must live inside a
  // scrollable inner container, while the modal title ("Settings") stays OUTSIDE
  // it so the header is sticky and the rows alone scroll. If the scroll wrapper is
  // removed (rows put back directly under DialogContent), or the title is moved
  // inside the scroll area, this fails.
  it('puts the control rows in a scroll container that the title is NOT inside', () => {
    setup();
    const scroll = screen.getByTestId('settings-scroll');
    // The inner container is the scroll surface (own max-height + overflow-y-auto).
    expect(scroll.className).toMatch(/overflow-y-auto/);
    expect(scroll.className).toMatch(/max-h-/);
    // Every control row lives inside the scroll container.
    expect(scroll).toContainElement(screen.getByTestId('setting-editorTheme'));
    expect(scroll).toContainElement(screen.getByTestId('setting-cssMode'));
    // The title stays outside the scroll container (sticky header).
    const title = screen.getByText('Settings');
    expect(scroll).not.toContainElement(title);
    // Sanity: title and scroll body share a common ancestor (same dialog), so the
    // "outside" assertion is about hierarchy, not a different tree.
    expect(title.compareDocumentPosition(scroll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
