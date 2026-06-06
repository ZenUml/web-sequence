import { describe, it, expect } from 'vitest';
import { detectRuntimeMode } from './runtimeMode';

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
