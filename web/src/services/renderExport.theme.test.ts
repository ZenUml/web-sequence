import { describe, expect, it } from 'vitest';
import type { PreviewExportSnapshot } from '../preview/PreviewFrame';
import { canExportSvg, resolveExportTheme } from './renderExport';

const snapshot: PreviewExportSnapshot = {
  code: 'A->B: Hello', css: '', theme: 'theme-dark', renderMode: 'svg',
};

describe('native dark exports', () => {
  it('matches the visible SVG theme when requested', () => {
    expect(resolveExportTheme(snapshot, 'match')).toBe('theme-dark');
    expect(resolveExportTheme(snapshot, 'light')).toBe('theme-default');
    expect(canExportSvg(snapshot, 'match')).toBe(true);
  });

  it('keeps custom CSS exports on PNG', () => {
    expect(canExportSvg({ ...snapshot, css: '.participant{color:red}' }, 'match')).toBe(false);
  });
});
