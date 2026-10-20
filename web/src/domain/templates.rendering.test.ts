import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { previewThemeFor } from '../app/appearance';
import { TEMPLATES } from './templates';
import { computeCss } from '../preview/transpilers';

let Core: any;
beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ measureText: (text: string) => ({ width: text.length * 8 }) } as unknown as CanvasRenderingContext2D);

  const module = { exports: {} as any };
  const source = readFileSync(createRequire(import.meta.url).resolve('@zenuml/core'), 'utf8');
  new Function('module', 'exports', source)(module, module.exports);
  Core = module.exports.default;
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
afterEach(() => { document.body.innerHTML = ''; document.querySelector('#template-css')?.remove(); });

describe('styled templates on the installed preview renderer', () => {
  it.each([
    { id: 'blue', edit: '@messageLineColor: #032C72;', variable: '@messageLineColor: #123456;', selector: '.message svg', property: 'color', expected: 'rgb(18, 52, 86)' },
    { id: 'blue', edit: '@participantLineColor: #032C72;', variable: '@participantLineColor: #123456;', selector: '.lifeline .line', property: '--color-border-base', expected: '#123456' },
    { id: 'starUMLTheme', edit: '@borderColor: #b94065;', variable: '@borderColor: #123456;', selector: '.message svg', property: 'color', expected: 'rgb(18, 52, 86)' },
  ])('$id edited palette drives $selector $property', async ({ id, edit, variable, selector, property, expected }) => {
    const item = TEMPLATES.find(t => t.id === id)!.item;
    const source = item.css!.replace(edit, variable);
    expect(source).not.toBe(item.css);
    const compiled = await computeCss(source, 'less', undefined);
    expect(compiled.errors).toBeUndefined();
    document.body.innerHTML = '<div id="diagram"><div id="template-mount"></div></div>';
    const app = new Core('#template-mount');
    await app.render(item.js, { theme: previewThemeFor('dark', source), enableMultiTheme: false });
    await waitFor(() => expect(document.querySelector(selector)).not.toBeNull());
    const style = document.createElement('style'); style.id = 'template-css'; style.textContent = compiled.code; document.head.append(style);
    expect(getComputedStyle(document.querySelector(selector)!).getPropertyValue(property).trim()).toBe(expected);
    if (id === 'starUMLTheme') {
      expect(getComputedStyle(document.querySelector('.participant')!).borderTopColor).toBe('rgb(18, 52, 86)');
      expect(getComputedStyle(document.querySelector('.lifeline .line')!).getPropertyValue('--color-border-base').trim()).toBe('#123456');
    }
  });

  it.each((['light', 'dark'] as const).flatMap(theme => [
    ['black-white', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)'],
    ['blue', 'rgba(146, 192, 240, 0.3)', 'rgb(3, 44, 114)'],
    ['starUMLTheme', 'rgb(255, 254, 200)', 'rgb(185, 64, 101)'],
  ].map(([id, fill, border]) => ({ theme, id, fill, border }))))('$id $theme preserves canvas, names and participant styles after real Less compilation', async ({ theme, id, fill, border }) => {
    const item = TEMPLATES.find(t => t.id === id)!.item;
    const compiled = await computeCss(item.css!, item.cssMode!, item.cssSettings);
    expect(compiled.errors).toBeUndefined();
    document.body.innerHTML = '<div id="diagram"><div id="template-mount"></div></div>';
    const app = new Core('#template-mount');
    await app.render(item.js, { theme: previewThemeFor(theme, item.css), enableMultiTheme: false });
    await waitFor(() => expect(document.querySelector('.participant')).not.toBeNull());
    const style = document.createElement('style');
    style.id = 'template-css'; style.textContent = compiled.code; document.head.append(style);
    const participant = document.querySelector('.participant')!;
    expect(getComputedStyle(document.querySelector('.bg-skin-canvas')!).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(document.querySelector('.participant-name')!).color).toBe(id === 'blue' ? 'rgb(3, 44, 114)' : 'rgb(0, 0, 0)');
    expect(getComputedStyle(document.querySelector('.message .name')!).color).toBe(id === 'blue' ? 'rgb(3, 44, 114)' : 'rgb(0, 0, 0)');
    expect(getComputedStyle(document.querySelector('.participant-name')!).textDecoration).toContain('underline');
    if (id !== 'starUMLTheme') {
      const divider = document.querySelector('.divider .name')!;
      const matching = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => 'selectorText' in rule && divider.matches((rule as CSSStyleRule).selectorText));
      const override = matching.find(rule => rule.style.getPropertyPriority('border-color') === 'important')!;
      expect(override).toBeDefined();
      expect(override.style.getPropertyValue('border-color').toLowerCase()).toBe(id === 'blue' ? 'rgb(226, 133, 83)' : 'rgb(0, 0, 0)');
      expect(override.style.getPropertyPriority('border-radius')).toBe('important');
      expect(override.style.getPropertyPriority('padding')).toBe('important');
      const line = document.querySelector('.divider .left')!;
      expect([...style.sheet!.cssRules].some(rule => 'selectorText' in rule && line.matches((rule as CSSStyleRule).selectorText) && (rule as CSSStyleRule).style.getPropertyPriority('background') === 'important')).toBe(true);
    }
    expect(getComputedStyle(document.querySelector('.message svg')!).color).toBe(id === 'blue' ? 'rgb(3, 44, 114)' : id === 'starUMLTheme' ? 'rgb(185, 64, 101)' : 'rgb(0, 0, 0)');
    expect(getComputedStyle(document.querySelector('.lifeline .line')!).getPropertyValue('--color-border-base').trim().toLowerCase()).toBe(id === 'blue' ? '#032c72' : id === 'starUMLTheme' ? '#b94065' : 'rgba(0,0,0,0.4)');
    expect(getComputedStyle(document.querySelector('.frame.bg-skin-frame')!).backgroundColor).not.toBe('rgb(43, 43, 43)');
    expect(getComputedStyle(participant).backgroundColor).toBe(fill);
    expect(getComputedStyle(participant).borderTopColor).toBe(border);
  });
});
