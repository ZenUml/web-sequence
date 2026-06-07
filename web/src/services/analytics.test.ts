import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const cf = vi.hoisted(() => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock('./cloudFunctions', () => cf);
import { emit, loadClientAnalytics } from './analytics';

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as { dataLayer?: unknown[] }).dataLayer;
  delete (window as { mixpanel?: unknown }).mixpanel;
});

afterEach(() => {
  delete (window as { dataLayer?: unknown[] }).dataLayer;
  delete (window as { mixpanel?: unknown }).mixpanel;
});

describe('analytics.emit', () => {
  it('posts to /track via cloud trackEvent with the userId + props (non-debug)', () => {
    emit('saveBtnClick', { category: 'ui', label: 'saved' }, { userId: 'u1', debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
  });

  it('carries userId:null for anonymous', () => {
    emit('pageView', {}, { userId: null, debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'pageView', userId: null });
  });

  it('routes to console and does NOT POST in debug mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit('x', { a: 1 }, { userId: 'u1', debug: true, isExtension: false });
    expect(cf.trackEvent).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // --- Discriminating tests beyond the plan's three (per advisor): the plan's
  // tests never exercise the CDN fan-out, so an empty / missing push would pass.

  it('pushes the event to window.dataLayer and window.mixpanel when present (non-debug, non-extension)', () => {
    window.dataLayer = [];
    const track = vi.fn();
    window.mixpanel = { track };
    emit('shareLink', { category: 'ui' }, { userId: 'u1', debug: false, isExtension: false });
    expect(window.dataLayer).toEqual([{ event: 'shareLink', category: 'ui' }]);
    expect(track).toHaveBeenCalledWith('shareLink', { category: 'ui' });
  });

  it('does NOT push to dataLayer in debug mode', () => {
    window.dataLayer = [];
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit('x', { a: 1 }, { userId: 'u1', debug: true, isExtension: false });
    expect(window.dataLayer).toEqual([]);
    spy.mockRestore();
  });

  it('under the extension: still POSTs to /track but skips the CDN globals', () => {
    window.dataLayer = [];
    const track = vi.fn();
    window.mixpanel = { track };
    emit('saveBtnClick', { category: 'ui' }, { userId: 'u1', debug: false, isExtension: true });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'saveBtnClick', userId: 'u1', category: 'ui' });
    expect(window.dataLayer).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it('does not throw when CDN globals are absent (non-debug)', () => {
    expect(() =>
      emit('pageView', {}, { userId: null, debug: false, isExtension: false }),
    ).not.toThrow();
    expect(cf.trackEvent).toHaveBeenCalledTimes(1);
  });

  // Discriminating (REQ-ANL-1 non-blocking contract): a CDN-injected third-party
  // global that throws SYNCHRONOUSLY must NOT propagate out of emit() into the
  // caller — callers run track() before the actual save/share, so an escaped throw
  // would abort the user action. Without the try/catch guard this test throws and
  // fails. The server path must still have fired (proving the throw was contained
  // AFTER the non-blocking server POST, not before it).
  it('swallows a synchronously-throwing window.mixpanel.track (non-blocking)', () => {
    window.dataLayer = [];
    window.mixpanel = { track: vi.fn(() => { throw new Error('CDN script blew up'); }) };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      emit('shareLink', { category: 'share' }, { userId: 'u1', debug: false, isExtension: false }),
    ).not.toThrow();
    // Server path already fired (non-blocking POST happens before the CDN push).
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'shareLink', userId: 'u1', category: 'share' });
    spy.mockRestore();
  });
});

describe('analytics.loadClientAnalytics', () => {
  it('is a no-op that does not throw (web + extension)', () => {
    expect(() => loadClientAnalytics({ isExtension: false })).not.toThrow();
    expect(() => loadClientAnalytics({ isExtension: true })).not.toThrow();
  });
});
