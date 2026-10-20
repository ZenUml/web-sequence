import { describe, it, expect } from 'vitest';
import { placeThumbnail, THUMBNAIL_CHROME_CSS } from './thumbnailLayout';

describe('placeThumbnail', () => {
  it('centres a narrow diagram at 70% and puts participants 12px from the top', () => {
    const p = placeThumbnail(352, { left: 17, right: 281, participantTop: 78 });
    expect(p.scale).toBe(0.7);
    expect(p.cropped).toBe(false);
    // Scaled width 184.8 → centred left edge at (352 - 184.8) / 2.
    expect(p.x + 17 * 0.7).toBeCloseTo((352 - 264 * 0.7) / 2);
    expect(p.y + 78 * 0.7).toBeCloseTo(12);
  });

  it('left-aligns and crops a wide diagram instead of fitting its width', () => {
    const p = placeThumbnail(352, { left: 17, right: 1617, participantTop: 78 });
    expect(p.cropped).toBe(true);
    expect(p.scale).toBe(0.7);
    expect(p.x + 17 * 0.7).toBeCloseTo(12);
  });
});

describe('THUMBNAIL_CHROME_CSS', () => {
  it('hides only the outer frame chrome and keeps fragment headers', () => {
    expect(THUMBNAIL_CHROME_CSS).toContain('.header.bg-skin-title{display:none');
    expect(THUMBNAIL_CHROME_CSS).not.toContain('fragment');
    expect(THUMBNAIL_CHROME_CSS).not.toContain('.participant');
  });
});
