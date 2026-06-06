import { describe, it, expect } from 'vitest';
import { isFrameMessage } from './previewProtocol';

describe('isFrameMessage', () => {
  it('accepts known frame messages', () => {
    expect(isFrameMessage({ type: 'ready' })).toBe(true);
    expect(isFrameMessage({ type: 'codeChange', code: 'A.b' })).toBe(true);
    expect(isFrameMessage({ type: 'png', id: 1, dataUrl: null })).toBe(true);
  });
  it('rejects non-objects and unknown/foreign messages', () => {
    expect(isFrameMessage(null)).toBe(false);
    expect(isFrameMessage('ready')).toBe(false);
    expect(isFrameMessage({ type: 'somethingElse' })).toBe(false);
    expect(isFrameMessage({ noType: true })).toBe(false);
  });
});
