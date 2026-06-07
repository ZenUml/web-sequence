import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openApp, handleTabCreated, handleInstalled } from './eventPage.js';

let chromeMock;
beforeEach(() => {
  chromeMock = {
    tabs: { create: vi.fn(), update: vi.fn(), onCreated: { addListener: vi.fn() } },
    runtime: { getURL: vi.fn((p) => `chrome-extension://id/${p}`), onInstalled: { addListener: vi.fn() }, setUninstallURL: vi.fn() },
    storage: { sync: { get: vi.fn((defaults, cb) => cb({ replaceNewTab: true })) } },
    action: { onClicked: { addListener: vi.fn() } },
  };
  globalThis.chrome = chromeMock;
});

describe('extension service worker', () => {
  it('openApp creates a tab at index.html', () => {
    openApp();
    expect(chromeMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'chrome-extension://id/index.html' }));
  });
  it('new-tab override fires only when replaceNewTab is true', () => {
    handleTabCreated({ id: 7, url: 'chrome://newtab/' });
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, expect.objectContaining({ url: 'chrome-extension://id/index.html' }), expect.any(Function));
  });
  it('new-tab override does NOT fire when replaceNewTab is false', () => {
    chromeMock.storage.sync.get = vi.fn((d, cb) => cb({ replaceNewTab: false }));
    handleTabCreated({ id: 7, url: 'chrome://newtab/' });
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });
  it('onInstalled(install) opens the app', () => {
    handleInstalled({ reason: 'install' });
    expect(chromeMock.tabs.create).toHaveBeenCalled();
  });
});
