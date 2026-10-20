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

// jsdom's getClientRects() is always empty. A browser returns at least one box for
// rendered inline text and spans, and CodeMirror's click-to-position scan relies on
// that for highlighted (multi-span) lines; with no rects it throws inside the
// mousedown handler. Inside CodeMirror content, return the (zero) bounding box as
// one rect, for elements and for text ranges. Other components keep jsdom's
// behaviour.
const oneRect = (rect: DOMRect) =>
  ({ length: 1, 0: rect, item: (i: number) => (i === 0 ? rect : null), [Symbol.iterator]: function* () { yield rect; } }) as unknown as DOMRectList;
const inCmContent = (node: Node | null) =>
  !!(node && (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('.cm-content'));
if (typeof Element !== 'undefined') {
  const nativeGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function getClientRects(this: Element) {
    return inCmContent(this) ? oneRect(this.getBoundingClientRect()) : nativeGetClientRects.call(this);
  };
}
if (typeof Range !== 'undefined') {
  const rangeGetClientRects = Range.prototype.getClientRects;
  Range.prototype.getClientRects = function getClientRects(this: Range) {
    return inCmContent(this.startContainer) ? oneRect(this.getBoundingClientRect()) : rangeGetClientRects.call(this);
  };
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
