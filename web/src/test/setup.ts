import '@testing-library/jest-dom/vitest';

// jsdom implements no layout, but CodeMirror 6's view measurement calls
// Range.getClientRects() / getBoundingClientRect() and ResizeObserver during an
// async measure pass. Without these, CM6 throws an *unhandled* error after the
// test body completes ("textRange(...).getClientRects is not a function"), which
// fails the suite's exit code even though every test passes. Provide inert stubs.
if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function getClientRects() {
      return { length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList;
    };
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
    };
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
