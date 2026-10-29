import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const cf = vi.hoisted(() => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock('./cloudFunctions', () => cf);
import { emit, loadClientAnalytics } from './analytics';
import { APP_VERSION } from '../config/constants';

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
    emit('diagram_save_clicked', { category: 'ui', label: 'saved' }, { userId: 'u1', anonId: 'anon-1', debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'diagram_save_clicked', userId: 'u1', anonId: 'anon-1', app_version: APP_VERSION, category: 'ui', label: 'saved' });
  });

  it('carries userId:null plus the anonymous id for a signed-out user', () => {
    emit('app_opened', {}, { userId: null, anonId: 'anon-1', debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'app_opened', userId: null, anonId: 'anon-1', app_version: APP_VERSION });
  });

  it('routes to console and does NOT POST in debug mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit('x', { a: 1 }, { userId: 'u1', anonId: 'anon-1', debug: true, isExtension: false });
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
    emit('share_link_created', { category: 'ui' }, { userId: 'u1', anonId: 'anon-1', debug: false, isExtension: false });
    expect(window.dataLayer).toEqual([{ event: 'share_link_created', category: 'ui' }]);
    expect(track).toHaveBeenCalledWith('share_link_created', { category: 'ui' });
  });

  it('does NOT push to dataLayer in debug mode', () => {
    window.dataLayer = [];
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit('x', { a: 1 }, { userId: 'u1', anonId: 'anon-1', debug: true, isExtension: false });
    expect(window.dataLayer).toEqual([]);
    spy.mockRestore();
  });

  it('under the extension: still POSTs to /track but skips the CDN globals', () => {
    window.dataLayer = [];
    const track = vi.fn();
    window.mixpanel = { track };
    emit('diagram_save_clicked', { category: 'ui' }, { userId: 'u1', anonId: 'anon-1', debug: false, isExtension: true });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'diagram_save_clicked', userId: 'u1', anonId: 'anon-1', app_version: APP_VERSION, category: 'ui' });
    expect(window.dataLayer).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it('does not throw when CDN globals are absent (non-debug)', () => {
    expect(() =>
      emit('app_opened', {}, { userId: null, anonId: 'anon-1', debug: false, isExtension: false }),
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
      emit('share_link_created', { category: 'share' }, { userId: 'u1', anonId: 'anon-1', debug: false, isExtension: false }),
    ).not.toThrow();
    // Server path already fired (non-blocking POST happens before the CDN push).
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'share_link_created', userId: 'u1', anonId: 'anon-1', app_version: APP_VERSION, category: 'share' });
    spy.mockRestore();
  });
});

describe('analytics.loadClientAnalytics', () => {
  it('is a no-op that does not throw (web + extension)', () => {
    expect(() => loadClientAnalytics({ isExtension: false })).not.toThrow();
    expect(() => loadClientAnalytics({ isExtension: true })).not.toThrow();
  });

  it('sends anonId and app_version on /track only, not into the CDN payloads', () => {
    window.dataLayer = [];
    const track = vi.fn();
    window.mixpanel = { track };
    emit('share_link_created', { category: 'ui' }, { userId: null, anonId: 'anon-9', debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({
      event: 'share_link_created', userId: null, anonId: 'anon-9', app_version: APP_VERSION, category: 'ui',
    });
    expect(window.dataLayer).toEqual([{ event: 'share_link_created', category: 'ui' }]);
    expect(track).toHaveBeenCalledWith('share_link_created', { category: 'ui' });
  });
});
