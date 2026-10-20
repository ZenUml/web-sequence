import { describe, expect, it } from 'vitest';
import { clampZoom, formatZoom, resolveZoom, zoomIn, zoomOut, MAX_ZOOM, MIN_ZOOM } from './previewZoom';

const content = { width: 500, height: 250 };
const viewport = { width: 1000, height: 800 };

describe('previewZoom', () => {
  it('resolves manual zoom with clamping', () => {
    expect(resolveZoom({ kind: 'manual', scale: 1.5 }, null, null)).toBe(1.5);
    expect(resolveZoom({ kind: 'manual', scale: 99 }, null, null)).toBe(MAX_ZOOM);
    expect(resolveZoom({ kind: 'manual', scale: 0.01 }, null, null)).toBe(MIN_ZOOM);
  });

  it('fits width, height and the whole diagram', () => {
    expect(resolveZoom({ kind: 'fit-width' }, content, viewport)).toBe(2);
    expect(resolveZoom({ kind: 'fit-height' }, content, viewport)).toBe(3.2);
    expect(resolveZoom({ kind: 'fit' }, content, viewport)).toBe(2);
    expect(resolveZoom({ kind: 'fit' }, { width: 2000, height: 400 }, viewport)).toBe(0.5);
  });

  it('falls back to actual size when sizes are unknown or empty', () => {
    expect(resolveZoom({ kind: 'fit' }, null, viewport)).toBe(1);
    expect(resolveZoom({ kind: 'fit-width' }, content, { width: 0, height: 0 })).toBe(1);
  });

  it('steps zoom in and out from the current effective scale', () => {
    expect(zoomIn(1)).toEqual({ kind: 'manual', scale: 1.1 });
    expect(zoomOut(1)).toEqual({ kind: 'manual', scale: 0.9 });
    expect(zoomIn(1.33)).toEqual({ kind: 'manual', scale: 1.5 });
    expect(zoomIn(MAX_ZOOM)).toEqual({ kind: 'manual', scale: MAX_ZOOM });
    expect(zoomOut(MIN_ZOOM)).toEqual({ kind: 'manual', scale: MIN_ZOOM });
  });

  it('formats and clamps', () => {
    expect(formatZoom(1)).toBe('100%');
    expect(formatZoom(0.333)).toBe('33%');
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});
