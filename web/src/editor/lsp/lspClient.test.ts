import { describe, it, expect } from 'vitest';
import { createZenumlLspClient } from './lspClient';

describe('createZenumlLspClient — no-Worker guard', () => {
  // The unit-test runtime is jsdom, which does not define Web Worker. Without the
  // guard, `new Worker(...)` throws `ReferenceError: Worker is not defined` on editor
  // mount and crashes the whole editor (and ~49 CodeEditor/AppRoot tests with it). The
  // factory must degrade to "no LSP" by returning null when Worker is unavailable.
  it('returns null when Worker is unavailable (jsdom / SSR) instead of throwing', () => {
    expect(typeof Worker).toBe('undefined'); // precondition: this env has no Worker
    expect(createZenumlLspClient()).toBeNull();
  });
});
