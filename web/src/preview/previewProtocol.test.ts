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

  // DISCRIMINATING (embed card-hugging, round-4): the bootstrap posts
  // { type: 'contentHeight', height: <px> } after each embed render so the host
  // can shrink-wrap the iframe. Removing 'contentHeight' from FRAME_TYPES makes
  // this test fail; adding it as an unguarded new type that isn't recognised here
  // also fails the negative case.
  it('accepts contentHeight message (embed iframe sizing)', () => {
    expect(isFrameMessage({ type: 'contentHeight', height: 320 })).toBe(true);
    expect(isFrameMessage({ type: 'contentHeight', height: 0 })).toBe(true);
  });
  it('rejects a contentHeight-shaped message with wrong type string', () => {
    expect(isFrameMessage({ type: 'ContentHeight', height: 320 })).toBe(false);
    expect(isFrameMessage({ type: 'content-height', height: 320 })).toBe(false);
  });
});
