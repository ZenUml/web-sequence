import { describe, it, expect, afterEach } from 'vitest';
import { detectRuntimeMode, detectFromEnv } from './runtimeMode';

describe('detectRuntimeMode', () => {
  it('embed when ?embed present', () => {
    expect(detectRuntimeMode({ search: '?embed=1', isExtension: false, isDesktop: false }).isEmbed).toBe(true);
  });
  it('shared read-only when id + share-token present', () => {
    const m = detectRuntimeMode({ search: '?id=abc&share-token=xyz', isExtension: false, isDesktop: false });
    expect(m.isShared).toBe(true);
    expect(m.itemId).toBe('abc');
    expect(m.shareToken).toBe('xyz');
  });
  it('extension/desktop flags pass through', () => {
    expect(detectRuntimeMode({ search: '', isExtension: true, isDesktop: false }).isExtension).toBe(true);
    expect(detectRuntimeMode({ search: '', isExtension: false, isDesktop: true }).isDesktop).toBe(true);
  });
  it('standard mode when no flags', () => {
    const m = detectRuntimeMode({ search: '', isExtension: false, isDesktop: false });
    expect(m.isEmbed || m.isShared || m.isExtension || m.isDesktop).toBe(false);
  });
});

describe('detectRuntimeMode — embed inline params (contract §8)', () => {
  it('parses ?code and ?title for embed-by-value', () => {
    const m = detectRuntimeMode({ search: '?embed&code=A.method()&title=Demo', isExtension: false, isDesktop: false });
    expect(m.isEmbed).toBe(true);
    expect(m.embedCode).toBe('A.method()');
    expect(m.embedTitle).toBe('Demo');
  });
  it('embedCode/embedTitle are null when absent', () => {
    const m = detectRuntimeMode({ search: '?embed', isExtension: false, isDesktop: false });
    expect(m.embedCode).toBeNull();
    expect(m.embedTitle).toBeNull();
  });
  it('embed composes with shared read-only (?embed&id=&share-token=)', () => {
    const m = detectRuntimeMode({ search: '?embed&id=x&share-token=t', isExtension: false, isDesktop: false });
    expect(m.isEmbed).toBe(true);
    expect(m.isShared).toBe(true);
    expect(m.itemId).toBe('x');
  });
});

// M05 Task 10: confirm the packaged extension is detected WITHOUT any injected
// window.IS_EXTENSION global — purely from the chrome-extension: protocol (runtimeMode.ts
// line 33). This is the load-bearing claim that lets us skip an ext-boot.js / index.html
// mutation. Case 1 is discriminating: revert the `|| protocol === 'chrome-extension:'`
// clause and it fails.
describe('detectFromEnv — extension detection (no IS_EXTENSION global needed)', () => {
  const realLocation = window.location;
  // jsdom's window.location is read-only; replace it via defineProperty and restore after.
  const setLocation = (loc: { protocol: string; search: string }) => {
    Object.defineProperty(window, 'location', { value: loc, configurable: true, writable: true });
  };

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true, writable: true });
    delete (window as { IS_EXTENSION?: boolean }).IS_EXTENSION;
    delete (window as { zenumlDesktop?: boolean }).zenumlDesktop;
  });

  it('isExtension via chrome-extension: protocol alone (IS_EXTENSION unset)', () => {
    setLocation({ protocol: 'chrome-extension:', search: '' });
    expect((window as { IS_EXTENSION?: boolean }).IS_EXTENSION).toBeUndefined();
    expect(detectFromEnv().isExtension).toBe(true);
  });

  it('isExtension via window.IS_EXTENSION global on https: protocol', () => {
    setLocation({ protocol: 'https:', search: '' });
    (window as { IS_EXTENSION?: boolean }).IS_EXTENSION = true;
    expect(detectFromEnv().isExtension).toBe(true);
  });

  it('not extension on plain https: with neither signal', () => {
    setLocation({ protocol: 'https:', search: '' });
    expect(detectFromEnv().isExtension).toBe(false);
  });
});
