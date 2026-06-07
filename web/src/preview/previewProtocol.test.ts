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

  // DISCRIMINATING (embed card shrink-wrap, round-5): the bootstrap posts
  // { type: 'contentSize', width: <px>, height: <px> } after each embed render so
  // the host can shrink-wrap the iframe on BOTH axes (width + height). The width
  // is measured from .bg-skin-canvas.scrollWidth (the inline-block DiagramFrame root)
  // — NOT from #diagram.scrollWidth which equals the full iframe clientWidth.
  // Removing 'contentSize' from FRAME_TYPES makes this test fail; adding it as an
  // unguarded new type that isn't recognised also fails the negative case.
  it('accepts contentSize message (embed iframe width+height sizing)', () => {
    expect(isFrameMessage({ type: 'contentSize', width: 265, height: 344 })).toBe(true);
    expect(isFrameMessage({ type: 'contentSize', width: 0, height: 0 })).toBe(true);
  });
  it('rejects a contentSize-shaped message with wrong type string', () => {
    expect(isFrameMessage({ type: 'ContentSize', width: 265, height: 344 })).toBe(false);
    expect(isFrameMessage({ type: 'content-size', width: 265, height: 344 })).toBe(false);
    // Old contentHeight type is no longer in the protocol — must be rejected.
    expect(isFrameMessage({ type: 'contentHeight', height: 320 })).toBe(false);
  });
});
