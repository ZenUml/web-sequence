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

  it('toggling a boolean switch fires onChange(key, boolean)', () => {
    const { onChange } = setup({ lineWrap: false });
    // Radix Switch renders a button with role=switch; click toggles it.
    fireEvent.click(screen.getByTestId('setting-lineWrap'));
    expect(onChange).toHaveBeenCalledWith('lineWrap', true);
  });

  it('changing a Select fires onChange with the typed value', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByTestId('setting-editorTheme'));
    await userEvent.click(await screen.findByText('dracula'));
    expect(onChange).toHaveBeenCalledWith('editorTheme', 'dracula');
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
