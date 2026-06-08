// MV3 service worker for the ZenUML Chrome extension.
// Plain JS — runs in the extension worker context, NOT bundled by Vite.
// Handlers are exported so the test can drive them with a mocked `chrome`.
// Parity with legacy src/extension/eventPage.js.

export function openApp() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html'),
    selected: true,
  });
}

export function handleTabCreated(tab) {
  // A new tab opened without a URL → honour the user's replaceNewTab setting.
  // Default is false (do NOT hijack the new-tab page unless opted in).
  if (tab.url === 'chrome://newtab/') {
    chrome.storage.sync.get(
      {
        replaceNewTab: false,
      },
      function (items) {
        if (items.replaceNewTab) {
          chrome.tabs.update(
            tab.id,
            {
              url: chrome.runtime.getURL('index.html'),
            },
            function callback() {},
          );
        }
      },
    );
  }
}

export function handleInstalled(details) {
  if (details.reason === 'install') {
    openApp();
  }
}

// Register listeners at module load. Guarded so importing this file in the
// test (where `chrome.action` is mocked but we don't want registration to
// throw under partial mocks) is safe.
if (typeof chrome !== 'undefined' && chrome.action) {
  chrome.action.onClicked.addListener(openApp);
  chrome.tabs.onCreated.addListener(handleTabCreated);
  chrome.runtime.onInstalled.addListener(handleInstalled);
  chrome.runtime.setUninstallURL('https://goo.gl/forms/eKJSpdvMjehCBy332');
}
