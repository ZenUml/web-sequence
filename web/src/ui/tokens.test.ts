import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'tokens.css'),
  'utf8',
);

function block(selector: string, until: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf(until, start + selector.length);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

describe('primitive tokens', () => {
  it('defines the approved action, light, and dark palette once', () => {
    const palette: Record<string, string> = {
      '--ui-brand': '#2E94D4',
      '--ui-action-primary': '#217BB3',
      '--ui-action-on-primary': '#FFFFFF',
      '--ui-action-primary-hover': '#1C6D9F',
      '--ui-action-primary-pressed': '#175D89',
      '--ui-page': '#EFF6FB',
      '--ui-surface': '#FFFFFF',
      '--ui-pocket': '#F7FAFD',
      '--ui-border': '#E3E8ED',
      '--ui-text': '#1C2024',
      '--ui-text-secondary': '#60646C',
      '--ui-button-secondary': '#FFFFFF',
      '--ui-button-text': '#1C2024',
      '--ui-button-border': '#D5DCE5',
      '--ui-selected': '#E5F1FA',
      '--ui-control': '#FFFFFF',
      '--ui-focus-ring': '#176593',
      '--ui-secondary-hover': '#EAF2F8',
      '--ui-secondary-pressed': '#DCE8F1',
      '--ui-disabled-surface': '#E8EDF2',
      '--ui-disabled-text': '#7A8794',
      '--ui-disabled-border': '#DCE3EA',
      '--ui-danger': '#E0524A',
      '--ui-danger-strong': '#B23A33',
      '--ui-danger-highlight-text': '#B23A33',
    };
    for (const [name, value] of Object.entries(palette)) {
      expect(css).toContain(`${name}: ${value};`);
    }

    const dark = css.slice(css.indexOf("[data-ui-surface='dark']"));
    const darkPalette: Record<string, string> = {
      '--ui-page': '#303944',
      '--ui-surface': '#343F4B',
      '--ui-pocket': '#424F5E',
      '--ui-border': '#516071',
      '--ui-text': '#EEF2F6',
      '--ui-text-secondary': '#B8C3CF',
      '--ui-button-secondary': '#3B424E',
      '--ui-button-text': '#EDF0F5',
      '--ui-button-border': '#444B57',
      '--ui-selected': '#304F69',
      '--ui-control': '#2D3743',
      '--ui-focus-ring': '#9ACDFA',
      '--ui-secondary-hover': '#485465',
      '--ui-secondary-pressed': '#526175',
      '--ui-disabled-surface': '#39424D',
      '--ui-disabled-text': '#8794A3',
      '--ui-disabled-border': '#46515F',
      '--ui-danger': '#E0524A',
      '--ui-danger-strong': '#E0524A',
      '--ui-danger-highlight-text': '#E8EEF7',
    };
    for (const [name, value] of Object.entries(darkPalette)) {
      expect(dark).toContain(`${name}: ${value};`);
    }
  });

  it('defines the approved control dimensions', () => {
    expect(css).toContain('--ui-control-compact: 32px;');
    expect(css).toContain('--ui-control-default: 36px;');
    expect(css).toContain('--ui-icon-default: 16px;');
    expect(css).toContain('--ui-icon-action: 18px;');
    expect(css).toContain('--ui-radius-control: 6px;');
    expect(css).toContain('--ui-radius-menu: 8px;');
    expect(css).toContain('--ui-stroke-focus: 2px;');
    expect(css).toContain('--ui-type-control: 14px;');
    expect(css).toContain('--ui-line-control: 20px;');
  });

  it('points button, field, menu, and switch rules at those variables', () => {
    const button = block(':where(.ui-button) {', ':where(.ui-button--sm)');
    expect(button).toContain('height: var(--ui-control-default)');
    expect(button).toContain('border-radius: var(--ui-radius-control)');
    expect(button).not.toMatch(/#[0-9A-Fa-f]{3,8}/);

    const paint = block('.ui-button {', ':where(.ui-button) {');
    expect(paint).toContain('font-size: var(--ui-type-control)');
    expect(paint).toContain('line-height: var(--ui-line-control)');
    expect(paint).not.toMatch(/^\s*height:/m);

    const primary = block('.ui-button--primary {', '.ui-button--primary:hover');
    expect(primary).toContain('background: var(--ui-action-primary)');
    expect(primary).toContain('color: var(--ui-action-on-primary)');
    expect(primary).not.toMatch(/#[0-9A-Fa-f]{3,8}/);

    const icon = block('.ui-button svg {', '.ui-button:focus-visible');
    expect(icon).toContain('width: var(--ui-icon-action)');
    expect(icon).toContain('height: var(--ui-icon-action)');

    const field = block('.ui-field {', '.ui-field::placeholder');
    expect(field).toContain('background: var(--ui-control)');
    expect(field).toContain('color: var(--ui-text)');
    expect(field).toContain('border-radius: var(--ui-radius-control)');

    const menu = block(".ui-menu-item[data-highlighted], .ui-select-item[data-highlighted]", '.ui-menu-item[data-disabled]');
    expect(menu).toContain('background: var(--ui-selected)');

    const on = block(".ui-switch[data-state='checked'] {", '.ui-switch:focus-visible');
    expect(on).toContain('background: var(--ui-action-primary)');
    expect(on).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
  });

  it('keeps surface colors off :root so the diagram palette is unchanged', () => {
    const rootStart = css.indexOf('\n:root {');
    const rootEnd = css.indexOf('\n.ui-surface-light,');
    const root = css.slice(rootStart, rootEnd);
    expect(root).toContain('--ui-action-primary');
    expect(root).not.toContain('--ui-page');
    expect(root).not.toContain('--ui-surface:');
  });
});
