// Standalone extension options page — Chrome loads this OUTSIDE the React SPA
// (from chrome-extension://<id>/options.html), so this file is plain ESM with
// no bundler step: it is copied into the package verbatim by the build script.
// Do NOT import from src/ (e.g. APP_VERSION from src/config/constants.ts) — that
// path does not exist under chrome-extension:// and the browser cannot resolve a
// .ts import at runtime.
//
// Parity with legacy src/extension/options.js: two checkboxes mapped to the SAME
// chrome.storage.sync keys the app reads via syncStore — `preserveLastCode`
// (default true) + `replaceNewTab` (default false). Renaming a key here silently
// desyncs the extension from the app.

// Cosmetic only — kept in sync with src/config/constants.ts APP_VERSION. The
// build script (build-extension) stamps manifest.json from APP_VERSION; this
// heading value is not load-bearing.
export const APP_VERSION = '1.0.25';

// Restores preferences from chrome.storage into the form's checkboxes.
export function restoreOptions() {
  chrome.storage.sync.get(
    {
      preserveLastCode: true,
      replaceNewTab: false,
    },
    function (items) {
      const form = document.forms.optionsForm;
      form.elements.preserveLastCode.checked = items.preserveLastCode;
      form.elements.replaceNewTab.checked = items.replaceNewTab;
    },
  );
}

// Persists the current checkbox state back to chrome.storage with a transient
// "Settings saved." status.
export function saveOptions(e) {
  const form = document.forms.optionsForm;
  const preserveLastCode = form.elements.preserveLastCode.checked;
  const replaceNewTab = form.elements.replaceNewTab.checked;

  chrome.storage.sync.set(
    {
      preserveLastCode: preserveLastCode,
      replaceNewTab: replaceNewTab,
    },
    function () {
      const status = document.getElementById('js-status');
      status.textContent = 'Settings saved.';
      setTimeout(function () {
        status.innerHTML = '&nbsp;';
      }, 750);
    },
  );

  e.preventDefault();
}

// DOM wiring — guarded so importing this module under Vitest has no side effects
// (the unit test builds its own form and calls restoreOptions/saveOptions
// directly). Module scripts are deferred and execute before DOMContentLoaded
// fires on the real page, so the listeners below still run for the live options
// page.
if (typeof document !== 'undefined' && document.forms?.optionsForm) {
  const versionEl = document.getElementById('js-version');
  if (versionEl) versionEl.textContent = 'v' + APP_VERSION;
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.forms.optionsForm.addEventListener('submit', saveOptions);
}
